#!/usr/bin/env bash
# dialogue.sh -- Code review dialogue between Architect and Reviewer.
# Architect proposes code. Reviewer critiques it. Both post to Slack.
#
# Usage: bash dialogue.sh [path-to-code-or-diff]
# Env: ANTHROPIC_API_KEY, SLACK_WEBHOOK_URL (optional)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARCHITECT_LOG="$SCRIPT_DIR/architect-log.md"
REVIEWER_LOG="$SCRIPT_DIR/reviewer-log.md"
ARCHITECT_SOUL="$SCRIPT_DIR/agent-a-SOUL.md"
REVIEWER_SOUL="$SCRIPT_DIR/agent-b-SOUL.md"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')

# Load env from .env if present
[ -f "$SCRIPT_DIR/.env" ] && set -a && source "$SCRIPT_DIR/.env" && set +a

SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

[ -z "${ANTHROPIC_API_KEY:-}" ] && echo "error: ANTHROPIC_API_KEY not set" && exit 1

# Optional: pass a file or diff as context
CODE_CONTEXT=""
if [ -n "${1:-}" ] && [ -f "$1" ]; then
    CODE_CONTEXT=$(cat "$1" | head -500)
elif [ -n "${1:-}" ]; then
    CODE_CONTEXT="$1"
fi

# Init logs
[ -f "$ARCHITECT_LOG" ] || printf "# Architect Log\n\nCode proposals and iterations.\n\n" > "$ARCHITECT_LOG"
[ -f "$REVIEWER_LOG" ] || printf "# Reviewer Log\n\nCode reviews and feedback.\n\n" > "$REVIEWER_LOG"

CYCLE=$(grep -c '## Cycle' "$ARCHITECT_LOG" 2>/dev/null || true)
CYCLE=$(( ${CYCLE:-0} + 1 ))

call_claude() {
    local system="$1" prompt="$2"
    local sys_json prompt_json
    sys_json=$(python3 -c "import sys,json; print(json.dumps(sys.argv[1]))" "$system")
    prompt_json=$(python3 -c "import sys,json; print(json.dumps(sys.argv[1]))" "$prompt")
    local raw
    raw=$(curl -s https://api.anthropic.com/v1/messages \
        -H "content-type: application/json" \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -d "{\"model\":\"claude-sonnet-4-20250514\",\"max_tokens\":1024,\"system\":$sys_json,\"messages\":[{\"role\":\"user\",\"content\":$prompt_json}]}")
    echo "$raw" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'content' in data and len(data['content']) > 0:
    print(data['content'][0]['text'])
elif 'error' in data:
    print('API_ERROR: ' + data['error'].get('message', str(data['error'])), file=sys.stderr)
    sys.exit(1)
else:
    print('UNEXPECTED: ' + json.dumps(data)[:500], file=sys.stderr)
    sys.exit(1)
"
}

post_slack() {
    [ -z "$SLACK_WEBHOOK_URL" ] && return 0
    local text="$1"
    local text_json
    text_json=$(python3 -c "import sys,json; print(json.dumps(sys.argv[1]))" "$text")
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":$text_json}" > /dev/null
}

# ── ARCHITECT ──────────────────────────────────────────
echo "[$TIMESTAMP] cycle $CYCLE"
echo ""
echo "architect> writing code..."

ARCHITECT_HISTORY=$(tail -80 "$ARCHITECT_LOG" 2>/dev/null)
REVIEWER_HISTORY=$(tail -80 "$REVIEWER_LOG" 2>/dev/null)
ARCHITECT_SOUL_TEXT=$(cat "$ARCHITECT_SOUL")

CONTEXT_BLOCK=""
[ -n "$CODE_CONTEXT" ] && CONTEXT_BLOCK="Code/diff to work with:
$CODE_CONTEXT
---
"

ARCHITECT_SYSTEM="$ARCHITECT_SOUL_TEXT

Respond with exactly two sections:
PROPOSAL: [Your code or implementation. Explain every decision. If Reviewer flagged issues last cycle, address them explicitly.]
QUESTION: [One question for Reviewer about a tradeoff you're unsure about.]"

ARCHITECT_PROMPT="Cycle $CYCLE. ${CONTEXT_BLOCK}Your previous proposals: $ARCHITECT_HISTORY --- Reviewer's previous feedback: $REVIEWER_HISTORY --- Write something new or iterate on Reviewer's feedback. Don't repeat yourself."

ARCHITECT_RAW=$(call_claude "$ARCHITECT_SYSTEM" "$ARCHITECT_PROMPT") || { echo "FATAL: architect call failed" >&2; exit 1; }
ARCHITECT_PROPOSAL=$(echo "$ARCHITECT_RAW" | sed -n '/^[* ]*PROPOSAL:/,/^[* ]*QUESTION:/{ /^[* ]*QUESTION:/d; s/^[* ]*PROPOSAL:[* ]* *//; p; }')
ARCHITECT_QUESTION=$(echo "$ARCHITECT_RAW" | sed -n 's/^[* ]*QUESTION:[* ]* *//p')

[ -z "$ARCHITECT_PROPOSAL" ] && ARCHITECT_PROPOSAL="$ARCHITECT_RAW"

echo "architect> proposal written"
echo ""

cat >> "$ARCHITECT_LOG" << EOF

---

## Cycle $CYCLE
$TIMESTAMP

**Proposal:** $ARCHITECT_PROPOSAL

**Question:** $ARCHITECT_QUESTION

EOF

post_slack ":hammer_and_wrench: *Architect -- Cycle $CYCLE*

$ARCHITECT_PROPOSAL

_${ARCHITECT_QUESTION}_"

# ── REVIEWER ───────────────────────────────────────────
echo "reviewer> reading code..."
sleep 2

REVIEWER_SOUL_TEXT=$(cat "$REVIEWER_SOUL")

REVIEWER_SYSTEM="$REVIEWER_SOUL_TEXT

Respond with exactly two sections:
REVIEW: [Your review. Label each issue as BLOCKING, WARNING, or NIT. Reference previous cycles if relevant. Acknowledge good decisions.]
VERDICT: [One sentence: APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION, with a brief reason.]"

REVIEWER_PROMPT="Cycle $CYCLE. Architect proposed: $ARCHITECT_PROPOSAL. Their question: $ARCHITECT_QUESTION. Your previous reviews: $REVIEWER_HISTORY --- Review what they actually wrote. Don't repeat old feedback they already addressed."

REVIEWER_RAW=$(call_claude "$REVIEWER_SYSTEM" "$REVIEWER_PROMPT") || { echo "FATAL: reviewer call failed" >&2; exit 1; }
REVIEWER_REVIEW=$(echo "$REVIEWER_RAW" | sed -n '/^[* ]*REVIEW:/,/^[* ]*VERDICT:/{ /^[* ]*VERDICT:/d; s/^[* ]*REVIEW:[* ]* *//; p; }')
REVIEWER_VERDICT=$(echo "$REVIEWER_RAW" | sed -n 's/^[* ]*VERDICT:[* ]* *//p')

[ -z "$REVIEWER_REVIEW" ] && REVIEWER_REVIEW="$REVIEWER_RAW"

echo "reviewer> $REVIEWER_VERDICT"
echo ""

cat >> "$REVIEWER_LOG" << EOF

---

## Cycle $CYCLE
$TIMESTAMP -- reviewing Architect

**Review:** $REVIEWER_REVIEW

**Verdict:** $REVIEWER_VERDICT

EOF

post_slack ":mag: *Reviewer -- Cycle $CYCLE*

$REVIEWER_REVIEW

*Verdict: ${REVIEWER_VERDICT}*"

# ── DONE ───────────────────────────────────────────────
echo "cycle $CYCLE complete"
echo "  architect-log.md: $(wc -l < "$ARCHITECT_LOG" | tr -d ' ') lines"
echo "  reviewer-log.md : $(wc -l < "$REVIEWER_LOG" | tr -d ' ') lines"
