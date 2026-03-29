# Memory Entry Schema v1

Defines the structure of fabric memory entries. Markdown files with YAML frontmatter in `~/fabric/`.

## Required fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Stable unique entry ID. 8 hex chars, generated on write. |
| `agent` | string | Who wrote this entry. |
| `platform` | string | Where the work happened (slack, telegram, discord, cli, etc). |
| `timestamp` | string | ISO 8601 UTC. When the entry was created. |
| `type` | string | Entry type. See allowed values below. |
| `tier` | string | hot, warm, or cold. Assigned on write, re-evaluated by curator. |
| `summary` | string | One-line description. Used by retrieval for ranking and display. |
| `project_id` | string | Stable namespace for the project. Use repo name or slug, not display name. |
| `session_id` | string | Groups entries from the same working session. Use the hermes session ID or a generated value. |

## Optional fields

| Field | Type | Description |
|---|---|---|
| `refs` | array | General cross-references to related entries. Format: `agent:id` or `agent:cycle`. |
| `tags` | array | Freeform tags for retrieval. |
| `customer_id` | string | Scopes entries to a customer/account. For support, billing, onboarding contexts. |
| `status` | string | Lightweight state: open, completed, blocked, superseded. |
| `outcome` | string | What happened. For tasks and decisions: the result or conclusion. |
| `review_of` | string | Points to the entry being reviewed. Format: `agent:id`. Use this instead of putting review refs in the generic refs field. |
| `revises` | string | Points to the entry being revised or fixed. Format: `agent:id`. Creates an explicit revision chain. |
| `cycle` | integer | Cycle number for dialogue loop entries. |

## Allowed type values

| Type | When to use |
|---|---|
| `task` | Agent completed a task or work item. |
| `decision` | A choice was made. Records the reasoning and outcome. |
| `review` | An agent reviewed another agent's work. Use `review_of` to link to the original. |
| `resolution` | A customer or system issue was resolved. Use `customer_id` if applicable. |
| `research` | Investigation or analysis. Findings, not actions. |
| `code-session` | Code was written, reviewed, or deployed. |
| `dialogue` | Multi-agent conversation entry. |
| `session` | Auto-generated session summary (written by plugin on session end). |

## Why these fields exist

- `id`: deterministic ref linking. Without it, refs use fragile agent:cycle or agent:timestamp matching.
- `project_id`: retrieval scoping. Entries from the same project score higher. Without it, project matching relies on keyword heuristics.
- `session_id`: groups related entries. A coding session produces multiple entries; session_id connects them without explicit refs.
- `summary`: retrieval ranking. The retriever scores summaries alongside body text. Entries without summaries rank worse.
- `review_of` / `revises`: training data extraction. export-training.py needs explicit links to build review-correction pairs. Generic refs are ambiguous.
- `customer_id`: namespace scoping. Support agents handle multiple customers; this field prevents cross-contamination in retrieval.
- `status`: lifecycle tracking. A task marked `superseded` should rank lower than an `open` task in retrieval.
- `outcome`: training signal. The outcome of a decision or task is the highest-value field for fine-tuning.

## Examples

### Decision

```yaml
---
id: a3f29b01
agent: daedalus
platform: telegram
timestamp: 2026-03-28T16:00:00Z
type: decision
tier: hot
summary: chose Fastify over Express for new services
project_id: api-gateway
session_id: sess-2026-03-28-1545
tags: [framework, performance]
status: completed
outcome: Fastify delivers 3x throughput. Switching for new services. Express stays for existing.
---

After benchmarking both frameworks under production-like load, Fastify
handles 3x more requests per second for our API patterns. The plugin
ecosystem is smaller but covers our needs. Decision: new services use
Fastify, existing Express services stay until next major refactor.
```

### Task

```yaml
---
id: b1c4e8d9
agent: icarus
platform: slack
timestamp: 2026-03-28T10:00:00Z
type: task
tier: hot
summary: built rate limiter middleware for Express
project_id: api-gateway
session_id: sess-2026-03-28-0945
tags: [rate-limiter, express, redis]
status: completed
outcome: sliding window rate limiter with per-route config, Redis backend
---

Built a rate limiter middleware for Express with sliding window algorithm
using Redis sorted sets. Supports per-route configuration. Handles
connection failures with exponential backoff retry.
```

### Review

```yaml
---
id: c2d5f0a1
agent: daedalus
platform: telegram
timestamp: 2026-03-28T11:00:00Z
type: review
tier: hot
summary: reviewed rate limiter, found race condition
project_id: api-gateway
session_id: sess-2026-03-28-1100
review_of: icarus:b1c4e8d9
tags: [rate-limiter, review]
status: completed
outcome: MUST FIX race condition, SHOULD FIX connection handling
---

MUST FIX: race condition in request counting. zadd runs before zcard,
causing off-by-one errors under concurrent load.

SHOULD FIX: Redis connection error handling. Current retry logic
doesn't cap the number of attempts.
```

### Resolution

```yaml
---
id: d8e9f1b2
agent: support-agent
platform: slack
timestamp: 2026-03-28T14:00:00Z
type: resolution
tier: hot
summary: resolved billing dispute for customer X
project_id: customer-support
session_id: sess-2026-03-28-1355
customer_id: cust-x-12345
tags: [billing, refund]
status: completed
outcome: refund issued, root cause was payment gateway timeout
---

Customer X was double-charged $47.50. Root cause: payment gateway
timeout triggered a retry that created a duplicate charge. Issued
refund. Added idempotency key to prevent recurrence.
```

### Session

```yaml
---
id: e9f0a2c3
agent: icarus
platform: cli
timestamp: 2026-03-28T18:00:00Z
type: session
tier: hot
summary: implemented auth middleware and wrote tests
project_id: api-gateway
session_id: sess-2026-03-28-1730
tags: [auth, jwt, testing]
status: completed
---

Implemented JWT authentication middleware. Access tokens expire in 15
minutes, refresh tokens in 7 days. Refresh token rotation on every use.
Wrote 12 tests covering happy path, expired tokens, and rotation edge
cases. All passing.
```

## Migration from old entries

Old entries (before schema v1) remain readable. The retriever, curator, and export tools handle missing fields gracefully:

- Missing `id`: refs fall back to agent:cycle or agent:timestamp matching.
- Missing `project_id`: project matching uses keyword heuristics on body and tags.
- Missing `session_id`: entries are treated as standalone.
- Missing `summary`: retrieval uses the first 80 chars of body.
- Missing `review_of` / `revises`: export-training.py uses the generic refs field with the existing resolver.
- Missing `status` / `outcome`: treated as unknown.

New writes should prefer the v1 schema. The transition is gradual -- as agents write new entries with the full schema, retrieval and training quality improve automatically.
