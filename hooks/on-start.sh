#!/usr/bin/env bash
# on-start.sh -- Claude Code SessionStart hook.
# Loads relevant fabric context and injects it into the session.
# Outputs text to stdout which Claude Code adds to context.
#
# Receives JSON on stdin: { session_id, cwd, source }

set -euo pipefail

FABRIC_DIR="${FABRIC_DIR:-$HOME/fabric}"

# Read hook input
INPUT=$(cat)

CWD=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null || echo "")
PROJECT=$(basename "$CWD" 2>/dev/null || echo "")

# Check if fabric has anything
[ -d "$FABRIC_DIR" ] || exit 0

# Smart context loading: find entries relevant to this project
# 1. Hot entries tagged with this project name
# 2. Hot entries from claude-code agent
# 3. Most recent entries from any agent (capped at 5)
CONTEXT=""

# Search for project-relevant entries
if [ -n "$PROJECT" ]; then
    MATCHES=$(grep -rl "$PROJECT" "$FABRIC_DIR" --include="*.md" 2>/dev/null | head -5)
    if [ -n "$MATCHES" ]; then
        for f in $MATCHES; do
            # Extract summary or first line of body
            SUMMARY=$(head -20 "$f" | grep "^summary:" | head -1 | sed 's/^summary: //')
            if [ -z "$SUMMARY" ]; then
                # Get first non-frontmatter line
                SUMMARY=$(awk '/^---$/{n++; next} n>=2{print; exit}' "$f" 2>/dev/null | head -1)
            fi
            AGENT=$(head -10 "$f" | grep "^agent:" | head -1 | sed 's/^agent: //')
            TS=$(head -10 "$f" | grep "^timestamp:" | head -1 | sed 's/^timestamp: //')
            [ -n "$SUMMARY" ] && CONTEXT="${CONTEXT}
[${TS}] ${AGENT}: ${SUMMARY}"
        done
    fi
fi

# Add recent hot entries from claude-code sessions
for f in $(ls -t "$FABRIC_DIR"/claude-code-*.md 2>/dev/null | head -3); do
    [ -f "$f" ] || continue
    SUMMARY=$(head -20 "$f" | grep "^summary:" | head -1 | sed 's/^summary: //')
    TS=$(head -10 "$f" | grep "^timestamp:" | head -1 | sed 's/^timestamp: //')
    [ -n "$SUMMARY" ] && CONTEXT="${CONTEXT}
[${TS}] claude-code: ${SUMMARY}"
done

# If we found relevant context, output it
if [ -n "$CONTEXT" ]; then
    echo "Recent work from fabric memory:${CONTEXT}"
fi

exit 0
