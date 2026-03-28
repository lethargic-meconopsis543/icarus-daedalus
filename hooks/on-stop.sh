#!/usr/bin/env bash
# on-stop.sh -- Claude Code Stop hook.
# Captures what was built/decided this session, writes to fabric.
# Runs automatically after every Claude Code response.
#
# Receives JSON on stdin: { session_id, cwd, response, stop_hook_active }

set -euo pipefail

FABRIC_DIR="${FABRIC_DIR:-$HOME/fabric}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Read hook input
INPUT=$(cat)

# Don't loop: if stop_hook_active is true, this is a re-run after blocking
ACTIVE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stop_hook_active','false'))" 2>/dev/null || echo "false")
[ "$ACTIVE" = "true" ] || [ "$ACTIVE" = "True" ] && exit 0

# Extract response and session info
RESPONSE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('response','')[:2000])" 2>/dev/null || echo "")
SESSION_ID=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id','unknown'))" 2>/dev/null || echo "unknown")
CWD=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null || echo "")

# Skip if response is too short to be worth remembering
[ ${#RESPONSE} -lt 100 ] && exit 0

# Skip if it's just a greeting or simple answer
echo "$RESPONSE" | grep -qi "^hello\|^hi\|^sure\|^yes\|^no\|^ok" && [ ${#RESPONSE} -lt 200 ] && exit 0

# Write to fabric
source "$SCRIPT_DIR/../fabric-adapter.sh"

PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")

fabric_write \
    "claude-code" \
    "cli" \
    "session" \
    "$RESPONSE" \
    "hot" \
    "" \
    "$PROJECT" \
    "claude-code session in $PROJECT" \
    "" > /dev/null 2>&1

exit 0
