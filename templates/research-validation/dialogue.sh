#!/usr/bin/env bash
# dialogue.sh -- Research dialogue between Explorer and Validator.
# Explorer investigates a topic. Validator fact-checks. Both post to Slack.
#
# Usage: bash dialogue.sh [topic]
# Env: ANTHROPIC_API_KEY, SLACK_WEBHOOK_URL (optional)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPLORER_LOG="$SCRIPT_DIR/explorer-log.md"
VALIDATOR_LOG="$SCRIPT_DIR/validator-log.md"
EXPLORER_SOUL="$SCRIPT_DIR/agent-a-SOUL.md"
VALIDATOR_SOUL="$SCRIPT_DIR/agent-b-SOUL.md"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')

[ -f "$SCRIPT_DIR/.env" ] && set -a && source "$SCRIPT_DIR/.env" && set +a

SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
RESEARCH_TOPIC="${1:-${RESEARCH_TOPIC:-}}"

[ -z "${ANTHROPIC_API_KEY:-}" ] && echo "error: ANTHROPIC_API_KEY not set" && exit 1
[ -z "$RESEARCH_TOPIC" ] && echo "error: pass a topic as arg or set RESEARCH_TOPIC in .env" && exit 1

[ -f "$EXPLORER_LOG" ] || printf "# Explorer Log\n\nResearch on: $RESEARCH_TOPIC\n\n" > "$EXPLORER_LOG"
[ -f "$VALIDATOR_LOG" ] || printf "# Validator Log\n\nFact-checking research on: $RESEARCH_TOPIC\n\n" > "$VALIDATOR_LOG"

CYCLE=$(grep -c '## Cycle' "$EXPLORER_LOG" 2>/dev/null || true)
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

# ── EXPLORER ───────────────────────────────────────────
echo "[$TIMESTAMP] cycle $CYCLE -- topic: $RESEARCH_TOPIC"
echo ""
echo "explorer> researching..."

EXPLORER_HISTORY=$(tail -80 "$EXPLORER_LOG" 2>/dev/null)
VALIDATOR_HISTORY=$(tail -80 "$VALIDATOR_LOG" 2>/dev/null)
EXPLORER_SOUL_TEXT=$(cat "$EXPLORER_SOUL")

EXPLORER_SYSTEM="$EXPLORER_SOUL_TEXT

Research topic: $RESEARCH_TOPIC

Respond with exactly two sections:
FINDING: [2-5 sentences. A specific claim, insight, or connection you've found. Cite sources or data where possible. If Validator challenged something last cycle, address it.]
QUESTION: [One question for Validator -- something you want them to verify or push back on.]"

EXPLORER_PROMPT="Cycle $CYCLE. Your previous findings: $EXPLORER_HISTORY --- Validator's previous checks: $VALIDATOR_HISTORY --- Find something new. If Validator debunked something, move on to new ground."

EXPLORER_RAW=$(call_claude "$EXPLORER_SYSTEM" "$EXPLORER_PROMPT") || { echo "FATAL: explorer call failed" >&2; exit 1; }
EXPLORER_FINDING=$(echo "$EXPLORER_RAW" | sed -n 's/^[* ]*FINDING:[* ]* *//p')
EXPLORER_QUESTION=$(echo "$EXPLORER_RAW" | sed -n 's/^[* ]*QUESTION:[* ]* *//p')

[ -z "$EXPLORER_FINDING" ] && EXPLORER_FINDING="$EXPLORER_RAW"

echo "explorer> $EXPLORER_FINDING"
echo ""

cat >> "$EXPLORER_LOG" << EOF

---

## Cycle $CYCLE
$TIMESTAMP

**Finding:** $EXPLORER_FINDING

**Question:** $EXPLORER_QUESTION

EOF

post_slack ":telescope: *Explorer -- Cycle $CYCLE*

$EXPLORER_FINDING

_${EXPLORER_QUESTION}_"

# ── VALIDATOR ──────────────────────────────────────────
echo "validator> checking claims..."
sleep 2

VALIDATOR_SOUL_TEXT=$(cat "$VALIDATOR_SOUL")

VALIDATOR_SYSTEM="$VALIDATOR_SOUL_TEXT

Research topic: $RESEARCH_TOPIC

Respond with exactly two sections:
CHECK: [2-5 sentences. Fact-check Explorer's finding. Label issues as FACTUAL_ERROR, LOGICAL_ERROR, or GAP. If the claim holds up, say so.]
CHALLENGE: [One statement that reframes or deepens Explorer's finding. Not a question -- a provocation.]"

VALIDATOR_PROMPT="Cycle $CYCLE. Explorer claimed: $EXPLORER_FINDING. Their question: $EXPLORER_QUESTION. Your previous checks: $VALIDATOR_HISTORY --- Check what they actually said. Track consistency with previous cycles."

VALIDATOR_RAW=$(call_claude "$VALIDATOR_SYSTEM" "$VALIDATOR_PROMPT") || { echo "FATAL: validator call failed" >&2; exit 1; }
VALIDATOR_CHECK=$(echo "$VALIDATOR_RAW" | sed -n 's/^[* ]*CHECK:[* ]* *//p')
VALIDATOR_CHALLENGE=$(echo "$VALIDATOR_RAW" | sed -n 's/^[* ]*CHALLENGE:[* ]* *//p')

[ -z "$VALIDATOR_CHECK" ] && VALIDATOR_CHECK="$VALIDATOR_RAW"

echo "validator> $VALIDATOR_CHECK"
echo ""

cat >> "$VALIDATOR_LOG" << EOF

---

## Cycle $CYCLE
$TIMESTAMP -- checking Explorer

**Check:** $VALIDATOR_CHECK

**Challenge:** $VALIDATOR_CHALLENGE

EOF

post_slack ":shield: *Validator -- Cycle $CYCLE*

$VALIDATOR_CHECK

_${VALIDATOR_CHALLENGE}_"

# ── DONE ───────────────────────────────────────────────
echo "cycle $CYCLE complete"
echo "  explorer-log.md : $(wc -l < "$EXPLORER_LOG" | tr -d ' ') lines"
echo "  validator-log.md: $(wc -l < "$VALIDATOR_LOG" | tr -d ' ') lines"
