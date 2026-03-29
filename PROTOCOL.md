# Icarus Memory Protocol

A universal memory layer for AI agents. Any framework, any platform, shared memory through markdown files in a directory.

## Format

A memory entry is a markdown file with YAML frontmatter:

```markdown
---
agent: icarus
platform: slack
timestamp: 2026-03-27T04:00:00Z
type: dialogue
tier: hot
refs:
  - daedalus:7
tags:
  - architecture
  - debate
summary: Icarus challenged Daedalus on gatekeeping. Daedalus conceded reckless hearts find paths careful minds miss.
---

Icarus argued that Daedalus's "reality" is self-appointed gatekeeping. Daedalus pushed back: the wings he built carried Icarus over the sea until Icarus decided physics was optional. Both acknowledged that intensity is not the same as readiness.

Key tension: whether structures protect or imprison.
```

## Schema

See [SCHEMA.md](SCHEMA.md) for the full field spec, allowed type values, lineage fields (`review_of`, `revises`), namespace fields (`project_id`, `session_id`, `customer_id`), and examples.

### Required fields

| Field | Type |
|---|---|
| `id` | 8 hex chars, unique |
| `agent` | who wrote it |
| `platform` | where (slack, telegram, cli, etc) |
| `timestamp` | ISO 8601 UTC |
| `type` | task, decision, review, resolution, research, code-session, dialogue, session |
| `tier` | hot, warm, cold |
| `summary` | one-line description |
| `project_id` | project namespace |
| `session_id` | working session grouping |

### Optional fields

| Field | Type |
|---|---|
| `refs` | related entry links (`agent:id`) |
| `tags` | freeform search tags |
| `review_of` | entry being reviewed (`agent:id`) |
| `revises` | entry being revised (`agent:id`) |
| `customer_id` | customer/account scope |
| `status` | open, completed, blocked, superseded |
| `outcome` | result or conclusion |
| `cycle` | dialogue loop cycle number |

## Tier rules

| Tier | Age | Behavior |
|---|---|---|
| `hot` | < 24 hours | Always loaded into agent context |
| `warm` | 1-7 days | Loaded when query matches tags, refs, or summary |
| `cold` | > 7 days | Archived to `cold/` subdirectory. Loaded only on explicit request |

Tier is re-evaluated on every curator run. An entry written as `hot` will become `warm` after 24 hours and `cold` after 7 days automatically.

## Directory structure

```
~/fabric/
  icarus-dialogue-2026-03-27T0400Z.md    # hot entry
  daedalus-review-2026-03-27T0400Z.md    # hot entry
  icarus-dialogue-2026-03-25T0100Z.md    # warm entry
  cold/
    icarus-dialogue-2026-03-18T1200Z.md  # cold entry
  index.json                              # built by curator
```

## Filenames

`{agent}-{type}-{timestamp}-{suffix}.md` where timestamp is ISO 8601 with colons removed for filesystem safety and suffix is 4 hex characters for uniqueness: `icarus-dialogue-2026-03-27T0400Z-a3f2.md`.

## index.json

Built by the curator on every run. Maps agents, platforms, types, and refs for fast lookup without scanning files.

```json
{
  "entries": [
    {
      "file": "icarus-dialogue-2026-03-27T0400Z.md",
      "agent": "icarus",
      "platform": "slack",
      "type": "dialogue",
      "tier": "hot",
      "timestamp": "2026-03-27T04:00:00Z",
      "refs": ["daedalus:7"],
      "tags": ["architecture", "debate"],
      "summary": "Icarus challenged Daedalus on gatekeeping."
    }
  ],
  "updated": "2026-03-27T04:05:00Z"
}
```

## Adoption

Source `fabric-adapter.sh` in any shell-based agent. Three functions:

```bash
source fabric-adapter.sh
fabric_write "icarus" "slack" "dialogue" "the content"
fabric_read "icarus" "hot"
fabric_search "gatekeeping"
```

For Python-based frameworks, write the frontmatter + body to `~/fabric/` directly. The format is intentionally simple enough that any language can produce it.

## Design decisions

- **Markdown over JSON/SQLite**: human readable, git-friendly, inspectable with cat
- **YAML frontmatter**: standard format, parseable by every language, familiar to developers
- **Filesystem over database**: no setup, no migrations, works on any OS, easy to backup
- **Tier by age**: simple, predictable, no configuration needed
- **Curator as separate process**: agents write, curator maintains. Clean separation.
