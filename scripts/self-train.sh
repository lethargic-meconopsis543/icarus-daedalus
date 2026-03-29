#!/usr/bin/env bash
# self-train.sh -- Export fabric data, upload to Together AI, fine-tune.
#
# Usage: bash scripts/self-train.sh
# Env: TOGETHER_API_KEY (required)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MIN_PAIRS=20
POLL_INTERVAL=60
TIMEOUT=3600
LOCKDIR="/tmp/icarus-self-train.lock"

# ── Lock (mkdir is atomic on all POSIX systems) ──
if ! mkdir "$LOCKDIR" 2>/dev/null; then
    # check for stale lock
    if [ -f "$LOCKDIR/pid" ]; then
        STALE_PID=$(cat "$LOCKDIR/pid" 2>/dev/null)
        if [ -n "$STALE_PID" ] && kill -0 "$STALE_PID" 2>/dev/null; then
            echo "error: another training job is running (pid $STALE_PID)"
            exit 1
        fi
        # stale lock, reclaim
        rm -rf "$LOCKDIR"
        mkdir "$LOCKDIR" 2>/dev/null || { echo "error: cannot acquire lock"; exit 1; }
    else
        rm -rf "$LOCKDIR"
        mkdir "$LOCKDIR" 2>/dev/null || { echo "error: cannot acquire lock"; exit 1; }
    fi
fi
echo $$ > "$LOCKDIR/pid"
cleanup() { rm -rf "$LOCKDIR"; [ -n "${OUTPUT_DIR:-}" ] && rm -rf "$OUTPUT_DIR"; }
trap cleanup EXIT

# ── Unique temp dir per run ──
OUTPUT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/icarus-training-XXXXXX")

# ── Load TOGETHER_API_KEY from hermes .env if not set ──
if [ -z "${TOGETHER_API_KEY:-}" ]; then
    for d in "$HOME"/.hermes-*; do
        [ -f "$d/.env" ] || continue
        val=$(grep "^TOGETHER_API_KEY=" "$d/.env" 2>/dev/null | head -1 | cut -d'=' -f2-)
        if [ -n "$val" ]; then
            export TOGETHER_API_KEY="$val"
            break
        fi
    done
fi

if [ -z "${TOGETHER_API_KEY:-}" ]; then
    echo "error: TOGETHER_API_KEY not set"
    echo "set it in your .env or: export TOGETHER_API_KEY=your-key"
    exit 1
fi

# ── HTTP helper ──
# Appends HTTP status code as last line. Caller splits body and code.
http_post() {
    curl -s -w '\n%{http_code}' "$@"
}
http_get() {
    curl -s -w '\n%{http_code}' "$@"
}
check_http() {
    local response="$1" label="$2"
    local http_code body
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then
        echo "error: $label returned HTTP $http_code"
        echo "$body"
        exit 1
    fi
    echo "$body"
}

# ── Step 1: Export ──
echo "step 1: exporting training data..."
EXPORT_OUTPUT=$(python3 "$REPO_DIR/export-training.py" --output "$OUTPUT_DIR" 2>&1)
echo "$EXPORT_OUTPUT"

if [ ! -f "$OUTPUT_DIR/openai.jsonl" ]; then
    echo "error: export failed, no openai.jsonl produced"
    exit 1
fi

# ── Step 2: Check pair count ──
PAIR_COUNT=$(echo "$EXPORT_OUTPUT" | grep "total pairs:" | sed 's/[^0-9]//g')
PAIR_COUNT="${PAIR_COUNT:-0}"
echo ""
echo "total pairs: $PAIR_COUNT"

if [ "$PAIR_COUNT" -lt "$MIN_PAIRS" ]; then
    echo "warning: only $PAIR_COUNT pairs. minimum $MIN_PAIRS recommended."
    echo "run more agent sessions to generate more training data."
    exit 1
fi

# ── Step 3: Upload ──
echo ""
echo "step 2: uploading to Together AI..."
UPLOAD_RAW=$(http_post -X POST "https://api.together.xyz/files/upload" \
    -H "Authorization: Bearer $TOGETHER_API_KEY" \
    -F "purpose=fine-tune" \
    -F "file_name=openai.jsonl" \
    -F "file=@$OUTPUT_DIR/openai.jsonl")

UPLOAD_BODY=$(check_http "$UPLOAD_RAW" "upload")

FILE_ID=$(echo "$UPLOAD_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")

if [ -z "$FILE_ID" ]; then
    echo "error: upload succeeded but no file ID in response"
    echo "$UPLOAD_BODY"
    exit 1
fi

echo "uploaded: $FILE_ID"

# ── Step 4: Fine-tune ──
echo ""
echo "step 3: starting fine-tune..."
FT_RAW=$(http_post -X POST "https://api.together.xyz/v1/fine-tunes" \
    -H "Authorization: Bearer $TOGETHER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"training_file\": \"$FILE_ID\", \"model\": \"meta-llama/Meta-Llama-3.1-8B-Instruct-Reference\", \"n_epochs\": 3, \"suffix\": \"icarus-v1\"}")

FT_BODY=$(check_http "$FT_RAW" "fine-tune")

JOB_ID=$(echo "$FT_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")

if [ -z "$JOB_ID" ]; then
    echo "error: fine-tune request accepted but no job ID"
    echo "$FT_BODY"
    exit 1
fi

echo "job started: $JOB_ID"

# Save job ID so the skill can check later
JOB_FILE="$REPO_DIR/training-job.txt"
echo "$JOB_ID" > "$JOB_FILE"
echo "job ID saved to $JOB_FILE"

# ── Step 5: Poll ──
echo ""
echo "step 4: polling status every ${POLL_INTERVAL}s (timeout: ${TIMEOUT}s)..."
ELAPSED=0

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
    sleep "$POLL_INTERVAL"
    ELAPSED=$((ELAPSED + POLL_INTERVAL))

    STATUS_RAW=$(http_get "https://api.together.xyz/v1/fine-tunes/$JOB_ID" \
        -H "Authorization: Bearer $TOGETHER_API_KEY")

    STATUS_CODE=$(echo "$STATUS_RAW" | tail -1)
    STATUS_BODY=$(echo "$STATUS_RAW" | sed '$d')

    if [ "$STATUS_CODE" != "200" ]; then
        echo "  [${ELAPSED}s] poll error: HTTP $STATUS_CODE"
        continue
    fi

    STATUS=$(echo "$STATUS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unknown")
    echo "  [${ELAPSED}s] status: $STATUS"

    if [ "$STATUS" = "completed" ]; then
        MODEL_ID=$(echo "$STATUS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('model_output_name',''))" 2>/dev/null || echo "")
        echo ""
        echo "fine-tune complete"
        echo "model: $MODEL_ID"
        echo ""
        echo "to switch, add to your agent's .env:"
        echo "  OPENAI_BASE_URL=https://api.together.xyz/v1"
        echo "  OPENAI_API_KEY=\$TOGETHER_API_KEY"
        echo "  LLM_MODEL=$MODEL_ID"
        exit 0
    fi

    if [ "$STATUS" = "failed" ] || [ "$STATUS" = "cancelled" ] || [ "$STATUS" = "error" ] || [ "$STATUS" = "cancel_requested" ]; then
        ERROR=$(echo "$STATUS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','unknown error'))" 2>/dev/null || echo "unknown")
        echo ""
        echo "fine-tune $STATUS: $ERROR"
        exit 1
    fi
done

echo ""
echo "timeout: fine-tune did not complete in ${TIMEOUT}s"
echo "check manually: curl -s https://api.together.xyz/v1/fine-tunes/$JOB_ID -H 'Authorization: Bearer \$TOGETHER_API_KEY'"
exit 1
