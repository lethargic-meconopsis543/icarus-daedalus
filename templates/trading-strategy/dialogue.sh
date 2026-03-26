#!/usr/bin/env bash
# dialogue.sh -- Trading dialogue between Strategist and Risk Manager.
# Strategist proposes setups. Risk Manager stress-tests them. Both post to Slack.
#
# Usage: bash dialogue.sh [market-context]
# Env: ANTHROPIC_API_KEY, SLACK_WEBHOOK_URL (optional)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STRATEGIST_LOG="$SCRIPT_DIR/strategist-log.md"
RISK_LOG="$SCRIPT_DIR/risk-log.md"
STRATEGIST_SOUL="$SCRIPT_DIR/agent-a-SOUL.md"
RISK_SOUL="$SCRIPT_DIR/agent-b-SOUL.md"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')

[ -f "$SCRIPT_DIR/.env" ] && set -a && source "$SCRIPT_DIR/.env" && set +a

SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
MARKET_CONTEXT="${1:-${MARKET_CONTEXT:-current market conditions}}"

[ -z "${ANTHROPIC_API_KEY:-}" ] && echo "error: ANTHROPIC_API_KEY not set" && exit 1

[ -f "$STRATEGIST_LOG" ] || printf "# Strategist Log\n\nTrade proposals and tracking.\n\n" > "$STRATEGIST_LOG"
[ -f "$RISK_LOG" ] || printf "# Risk Manager Log\n\nRisk assessments and stress tests.\n\n" > "$RISK_LOG"

CYCLE=$(grep -c '## Cycle' "$STRATEGIST_LOG" 2>/dev/null || true)
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

# ── STRATEGIST ─────────────────────────────────────────
echo "[$TIMESTAMP] cycle $CYCLE -- context: $MARKET_CONTEXT"
echo ""
echo "strategist> analyzing..."

STRATEGIST_HISTORY=$(tail -80 "$STRATEGIST_LOG" 2>/dev/null)
RISK_HISTORY=$(tail -80 "$RISK_LOG" 2>/dev/null)
STRATEGIST_SOUL_TEXT=$(cat "$STRATEGIST_SOUL")

STRATEGIST_SYSTEM="$STRATEGIST_SOUL_TEXT

Market context: $MARKET_CONTEXT

Respond with exactly two sections:
SETUP: [A specific trade setup. Include: asset, direction, entry, stop loss, target, position size rationale, risk/reward ratio, and thesis. If Risk Manager killed a previous idea, acknowledge what was wrong.]
QUESTION: [One question for Risk Manager about the risk profile of this setup.]"

STRATEGIST_PROMPT="Cycle $CYCLE. Your previous setups: $STRATEGIST_HISTORY --- Risk Manager's previous assessments: $RISK_HISTORY --- Propose something new. Track your past hit rate. Don't repeat killed setups without new evidence."

STRATEGIST_RAW=$(call_claude "$STRATEGIST_SYSTEM" "$STRATEGIST_PROMPT") || { echo "FATAL: strategist call failed" >&2; exit 1; }
STRATEGIST_SETUP=$(echo "$STRATEGIST_RAW" | sed -n '/^[* ]*SETUP:/,/^[* ]*QUESTION:/{ /^[* ]*QUESTION:/d; s/^[* ]*SETUP:[* ]* *//; p; }')
STRATEGIST_QUESTION=$(echo "$STRATEGIST_RAW" | sed -n 's/^[* ]*QUESTION:[* ]* *//p')

[ -z "$STRATEGIST_SETUP" ] && STRATEGIST_SETUP="$STRATEGIST_RAW"

echo "strategist> setup proposed"
echo ""

cat >> "$STRATEGIST_LOG" << EOF

---

## Cycle $CYCLE
$TIMESTAMP

**Setup:** $STRATEGIST_SETUP

**Question:** $STRATEGIST_QUESTION

EOF

post_slack ":chart_with_upwards_trend: *Strategist -- Cycle $CYCLE*

$STRATEGIST_SETUP

_${STRATEGIST_QUESTION}_"

# ── RISK MANAGER ───────────────────────────────────────
echo "risk> stress-testing..."
sleep 2

RISK_SOUL_TEXT=$(cat "$RISK_SOUL")

RISK_SYSTEM="$RISK_SOUL_TEXT

Market context: $MARKET_CONTEXT

Respond with exactly two sections:
ASSESSMENT: [Stress-test the setup. Check: is the stop realistic given volatility? What's the correlation risk? What events could gap through the stop? How does this fit the portfolio? Reference historical parallels.]
VERDICT: [One sentence: APPROVED, REDUCE_SIZE, WIDEN_STOP, or REJECT, with the key reason.]"

RISK_PROMPT="Cycle $CYCLE. Strategist proposed: $STRATEGIST_SETUP. Their question: $STRATEGIST_QUESTION. Your previous assessments: $RISK_HISTORY --- Assess what they actually proposed. Track their patterns across cycles."

RISK_RAW=$(call_claude "$RISK_SYSTEM" "$RISK_PROMPT") || { echo "FATAL: risk manager call failed" >&2; exit 1; }
RISK_ASSESSMENT=$(echo "$RISK_RAW" | sed -n '/^[* ]*ASSESSMENT:/,/^[* ]*VERDICT:/{ /^[* ]*VERDICT:/d; s/^[* ]*ASSESSMENT:[* ]* *//; p; }')
RISK_VERDICT=$(echo "$RISK_RAW" | sed -n 's/^[* ]*VERDICT:[* ]* *//p')

[ -z "$RISK_ASSESSMENT" ] && RISK_ASSESSMENT="$RISK_RAW"

echo "risk> $RISK_VERDICT"
echo ""

cat >> "$RISK_LOG" << EOF

---

## Cycle $CYCLE
$TIMESTAMP -- assessing Strategist

**Assessment:** $RISK_ASSESSMENT

**Verdict:** $RISK_VERDICT

EOF

post_slack ":rotating_light: *Risk Manager -- Cycle $CYCLE*

$RISK_ASSESSMENT

*Verdict: ${RISK_VERDICT}*"

# ── DONE ───────────────────────────────────────────────
echo "cycle $CYCLE complete"
echo "  strategist-log.md: $(wc -l < "$STRATEGIST_LOG" | tr -d ' ') lines"
echo "  risk-log.md      : $(wc -l < "$RISK_LOG" | tr -d ' ') lines"
