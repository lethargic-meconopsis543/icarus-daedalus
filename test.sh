#!/usr/bin/env bash
# test.sh -- test fabric-adapter, curator, and dialogue integration
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

pass() { PASS=$((PASS + 1)); echo "  pass: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $1"; }

echo "fabric-adapter"
echo ""

FABRIC_DIR="$TEST_DIR/fabric" source "$SCRIPT_DIR/fabric-adapter.sh"

# write
fp=$(FABRIC_DIR="$TEST_DIR/fabric" fabric_write "test-agent" "cli" "task" "built a websocket broker" "hot" "other:1" "websocket, node" "ws broker" "1")
[ -f "$fp" ] && pass "fabric_write creates file" || fail "fabric_write creates file"
head -10 "$fp" | grep -q "^agent: test-agent" && pass "frontmatter has agent" || fail "frontmatter has agent"
head -10 "$fp" | grep -q "^tier: hot" && pass "frontmatter has tier" || fail "frontmatter has tier"
head -10 "$fp" | grep -q "^refs: \[other:1\]" && pass "frontmatter has refs" || fail "frontmatter has refs"
grep -q "websocket broker" "$fp" && pass "body has content" || fail "body has content"

# write uniqueness
fp2=$(FABRIC_DIR="$TEST_DIR/fabric" fabric_write "test-agent" "cli" "task" "second entry")
[ "$fp" != "$fp2" ] && pass "two writes produce unique files" || fail "two writes produce unique files"

# read
output=$(FABRIC_DIR="$TEST_DIR/fabric" fabric_read "test-agent" "hot")
echo "$output" | grep -q "websocket broker" && pass "fabric_read returns matching entries" || fail "fabric_read returns matching entries"

# read filters by agent
FABRIC_DIR="$TEST_DIR/fabric" fabric_write "other-agent" "slack" "dialogue" "unrelated entry" > /dev/null
output=$(FABRIC_DIR="$TEST_DIR/fabric" fabric_read "test-agent" "hot")
echo "$output" | grep -q "unrelated" && fail "fabric_read filters by agent" || pass "fabric_read filters by agent"

# search
results=$(FABRIC_DIR="$TEST_DIR/fabric" fabric_search "websocket")
[ -n "$results" ] && pass "fabric_search finds matching files" || fail "fabric_search finds matching files"

# search miss
results=$(FABRIC_DIR="$TEST_DIR/fabric" fabric_search "nonexistent_xyz_123" || true)
[ -z "$results" ] && pass "fabric_search returns empty on miss" || fail "fabric_search returns empty on miss"

echo ""
echo "curator"
echo ""

# curator tiering
FABRIC_DIR="$TEST_DIR/fabric" python3 "$SCRIPT_DIR/curator.py" --once 2>/dev/null
[ -f "$TEST_DIR/fabric/index.json" ] && pass "curator builds index.json" || fail "curator builds index.json"
python3 -c "
import json
idx = json.load(open('$TEST_DIR/fabric/index.json'))
assert len(idx['entries']) >= 3, f'expected >= 3 entries, got {len(idx[\"entries\"])}'
assert all(e['tier'] == 'hot' for e in idx['entries']), 'expected all hot'
print('  pass: index has correct entries and tiers')
" || fail "index has correct entries and tiers"

echo ""
echo "dialogue integration"
echo ""

# check dialogue.sh sources fabric-adapter
grep -q "source.*fabric-adapter.sh" "$SCRIPT_DIR/dialogue.sh" && pass "dialogue.sh sources fabric-adapter" || fail "dialogue.sh sources fabric-adapter"
grep -q "fabric_write" "$SCRIPT_DIR/dialogue.sh" && pass "dialogue.sh calls fabric_write" || fail "dialogue.sh calls fabric_write"

# check compact.sh is sourced
grep -q "source.*compact.sh" "$SCRIPT_DIR/dialogue.sh" && pass "dialogue.sh sources compact.sh" || fail "dialogue.sh sources compact.sh"

echo ""
echo "────────────────────────"
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "  all tests pass" || echo "  FAILURES DETECTED"
exit "$FAIL"
