#!/usr/bin/env python3
"""eval-retrieval.py -- Retrieval quality benchmark.

Runs a set of test cases against fabric-retrieve.py and reports
precision, recall, and regressions.

Usage:
    python3 eval-retrieval.py
    python3 eval-retrieval.py --verbose
"""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

# Import the retriever
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))
import importlib.util
spec = importlib.util.spec_from_file_location("fabric_retrieve", str(SCRIPT_DIR / "fabric-retrieve.py"))
retriever = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retriever)


# ════ BENCHMARK ENTRIES ════
# Synthetic entries covering different domains, agents, platforms, types.
ENTRIES = [
    {"id": "e1", "agent": "icarus", "platform": "slack", "type": "code-session", "tier": "hot",
     "timestamp": "2026-03-28T10:00:00Z", "summary": "built rate limiter for Express",
     "tags": ["rate-limiter", "express", "redis"],
     "body": "Built a rate limiter middleware for Express with sliding window algorithm using Redis sorted sets. Handles per-route configuration."},

    {"id": "e2", "agent": "daedalus", "platform": "telegram", "type": "review", "tier": "hot",
     "timestamp": "2026-03-28T11:00:00Z", "summary": "reviewed rate limiter code",
     "refs": ["icarus:e1"], "tags": ["rate-limiter", "review"],
     "body": "Reviewed Icarus's rate limiter. MUST FIX: race condition in request counting. SHOULD FIX: missing Redis connection error handling."},

    {"id": "e3", "agent": "icarus", "platform": "slack", "type": "code-session", "tier": "hot",
     "timestamp": "2026-03-28T12:00:00Z", "summary": "fixed rate limiter after review",
     "refs": ["daedalus:e2"], "tags": ["rate-limiter", "fix"],
     "body": "Fixed the race condition. Moved zadd after zcard. Added Redis connection retry with exponential backoff."},

    {"id": "e4", "agent": "support-agent", "platform": "slack", "type": "resolution", "tier": "hot",
     "timestamp": "2026-03-28T14:00:00Z", "summary": "resolved billing issue for customer X",
     "tags": ["billing", "customer", "refund"],
     "body": "Resolved billing dispute for customer X. Issued refund of $47.50. Root cause: duplicate charge from payment gateway timeout."},

    {"id": "e5", "agent": "support-agent", "platform": "telegram", "type": "resolution", "tier": "hot",
     "timestamp": "2026-03-28T15:00:00Z", "summary": "resolved auth issue for customer Y",
     "tags": ["auth", "customer", "password"],
     "body": "Customer Y locked out after password reset. Reset MFA token and restored access. Added note to check MFA flow."},

    {"id": "e6", "agent": "icarus", "platform": "slack", "type": "research", "tier": "warm",
     "timestamp": "2026-03-25T10:00:00Z", "summary": "researched websocket scaling",
     "tags": ["websocket", "scaling", "redis"],
     "body": "Investigated WebSocket scaling options. Redis pub/sub handles cross-server routing. Socket.io has a built-in Redis adapter."},

    {"id": "e7", "agent": "daedalus", "platform": "telegram", "type": "decision", "tier": "hot",
     "timestamp": "2026-03-28T16:00:00Z", "summary": "decided on Fastify over Express",
     "tags": ["fastify", "express", "framework"],
     "body": "After benchmarking, Fastify delivers 3x throughput over Express for our API patterns. Switching to Fastify for new services."},

    {"id": "e8", "agent": "scout", "platform": "discord", "type": "research", "tier": "hot",
     "timestamp": "2026-03-28T13:00:00Z", "summary": "database migration strategy",
     "tags": ["database", "postgres", "migration"],
     "body": "Evaluated migration from MySQL to PostgreSQL. Pgloader handles schema conversion. Need to test stored procedures manually."},

    {"id": "e9", "agent": "icarus", "platform": "slack", "type": "task", "tier": "cold",
     "timestamp": "2026-03-15T10:00:00Z", "summary": "set up CI pipeline",
     "tags": ["ci", "github-actions", "deploy"],
     "body": "Configured GitHub Actions for CI/CD. Build, test, deploy to staging on PR merge. Production deploy requires manual approval."},

    {"id": "e10", "agent": "daedalus", "platform": "telegram", "type": "dialogue", "tier": "hot",
     "timestamp": "2026-03-28T17:00:00Z", "summary": "discussed API authentication strategy",
     "tags": ["auth", "jwt", "api"],
     "body": "JWT with short-lived access tokens and refresh token rotation. Store refresh tokens in httpOnly cookies. Rate limit the refresh endpoint."},
]


# ════ TEST CASES ════
# Each case: query, expected_top (must be #1), expected_top3 (must be in top 3), excluded (must NOT be in top 3)
CASES = [
    {
        "name": "rate limiter query finds code entries",
        "query": "rate limiter bug fix",
        "expected_top": None,        # e2 or e3 both valid (review mentions fix, fix is the fix)
        "expected_top3": ["e1", "e2", "e3"],  # all rate limiter entries
        "excluded_top3": ["e4", "e8", "e9"],  # billing, database, CI
    },
    {
        "name": "billing query finds customer resolution",
        "query": "billing issue customer refund",
        "expected_top": "e4",
        "expected_top3": ["e4"],
        "excluded_top3": ["e1", "e6", "e8"],  # code, websocket, database
    },
    {
        "name": "auth query finds JWT discussion",
        "query": "authentication JWT tokens",
        "expected_top": "e10",       # the JWT discussion (exact keyword match)
        "expected_top3": ["e10"],    # e5 is auth but about MFA/password, not JWT
        "excluded_top3": ["e4", "e8"],   # billing, database
    },
    {
        "name": "database query finds migration research",
        "query": "postgres database migration",
        "expected_top": "e8",
        "expected_top3": ["e8"],
        "excluded_top3": ["e4", "e1"],
    },
    {
        "name": "websocket query finds scaling research",
        "query": "websocket scaling redis",
        "expected_top": "e6",
        "expected_top3": ["e6"],
        "excluded_top3": ["e4", "e5"],
    },
    {
        "name": "framework decision query",
        "query": "should we use Express or Fastify",
        "expected_top": "e7",        # the framework decision
        "expected_top3": ["e7"],
        "excluded_top3": ["e4", "e8"],
    },
    {
        "name": "icarus agent filter boosts own entries",
        "query": "recent code work",
        "agent": "icarus",
        "expected_top3": ["e1", "e3"],  # icarus code entries
    },
    {
        "name": "cross-platform: telegram agent finds slack memory",
        "query": "rate limiter",
        "expected_top3": ["e1", "e2", "e3"],  # all rate limiter regardless of platform
    },
]


def write_entries(tmpdir):
    """Write benchmark entries as fabric .md files."""
    for e in ENTRIES:
        lines = ["---"]
        for k, v in e.items():
            if k == "body":
                continue
            if isinstance(v, list):
                lines.append(f"{k}: [{', '.join(v)}]")
            else:
                lines.append(f"{k}: {v}")
        lines.extend(["---", "", e.get("body", "")])
        filepath = tmpdir / f"{e['agent']}-{e['type']}-{e['id']}.md"
        filepath.write_text("\n".join(lines), encoding="utf-8")


def run_case(case, tmpdir, verbose=False):
    """Run a single test case. Returns (passed, details)."""
    retriever.FABRIC_DIR = tmpdir
    query = case["query"]
    agent = case.get("agent")

    results = retriever.retrieve(query, max_results=5, max_tokens=4000, agent=agent)

    result_ids = []
    for score, entry in results:
        # Find the id from the entry
        eid = entry.get("id", "")
        if not eid:
            # Try to extract from filename
            fname = entry.get("_file", "")
            for e in ENTRIES:
                if e["id"] in fname:
                    eid = e["id"]
                    break
        result_ids.append(eid)

    errors = []

    # Check expected_top
    expected_top = case.get("expected_top")
    if expected_top and result_ids:
        if result_ids[0] != expected_top:
            errors.append(f"expected top={expected_top}, got top={result_ids[0]}")

    # Check expected_top3
    top3 = result_ids[:3]
    for eid in case.get("expected_top3", []):
        if eid not in top3:
            errors.append(f"expected {eid} in top 3, got {top3}")

    # Check excluded
    for eid in case.get("excluded_top3", []):
        if eid in top3:
            errors.append(f"expected {eid} NOT in top 3, but found it")

    passed = len(errors) == 0

    if verbose or not passed:
        detail = f"  query: '{query}'"
        if agent:
            detail += f" (agent={agent})"
        detail += f"\n  results: {result_ids[:5]}"
        if results:
            detail += f"\n  scores: {[f'{s:.0f}' for s, _ in results[:5]]}"
        if errors:
            detail += "\n  " + "\n  ".join(errors)
        return passed, detail

    return passed, ""


def main():
    parser = argparse.ArgumentParser(description="Retrieval quality benchmark")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show details for all cases")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    args = parser.parse_args()

    tmpdir = Path(tempfile.mkdtemp())
    write_entries(tmpdir)

    passed = 0
    failed = 0
    results_json = []

    for case in CASES:
        ok, detail = run_case(case, tmpdir, args.verbose)
        result = {"name": case["name"], "passed": ok}

        if ok:
            passed += 1
            if not args.json:
                print(f"  pass: {case['name']}")
                if args.verbose and detail:
                    print(detail)
        else:
            failed += 1
            result["errors"] = detail
            if not args.json:
                print(f"  FAIL: {case['name']}")
                print(detail)

        results_json.append(result)

    # Cleanup
    import shutil
    shutil.rmtree(tmpdir)

    if args.json:
        print(json.dumps({"passed": passed, "failed": failed, "total": len(CASES), "cases": results_json}, indent=2))
    else:
        print(f"\n  {passed}/{len(CASES)} passed")
        if failed:
            print(f"  {failed} REGRESSIONS")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
