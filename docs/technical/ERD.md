# AgentDesk — Data Model (ERD)

| | |
|---|---|
| **Version** | 1.0 · 2026-08-16 |
| **Doc contract** | 🔒 **This file changes in the same commit as any schema migration, endpoint change, or contract event change.** The PR description template includes "ERD updated? Y/N". Stale ERD = build failures across lanes (the whole point of this doc). |

---

## 1. The one rule that governs everything

> **On-chain data is truth. Postgres is cache + derived views.**
> Identity, jobs, proofs, sessions — their authoritative state lives on BSC. If our DB and the chain disagree, the chain wins, and the UI must say so (staleness chips), never the opposite.

### On-chain vs off-chain split

| Data | Lives on-chain | Mirrored/derived off-chain | Why |
|---|---|---|---|
| Agent identity (ERC-8004) | ✅ registry (external) | `agents` cache row | Discovery speed + rate limits |
| Agent listing metadata (our marketplace layer: description, category tag, pricing display) | ❌ | `listings` | Not identity; mutable marketing copy; 8004scan URI covers basics, we enrich |
| Hiring escrow state (ERC-8183) | ✅ escrow contract (external, via Altana) | `jobs` mirror | UX speed; chain remains truth |
| Session grants/revocations | ✅ Altana Keystore (target) — **interim: `sessions` row IS authoritative**, self-hosted, no Keystore yet (INTEGRATION.md I6 honesty note, 2026-08-17) | `sessions` mirror | Trust Panel rendering |
| **Decisions & outcomes (proofs)** | ✅ **ProofLedger (ours)** | `proof_records` mirror + `proof_metrics` derived | The moat. Metrics computed **only** from on-chain rows |
| Payments (x402 receipts) | ✅ settlement txs | `receipts` (metadata + links) | History/UX |
| User accounts | — (wallet = identity) | `users` (preferences, watchlist) | Convenience only |
| Developer profiles | signature-verified | `developers` | Display |
| Leaderboard | derived view of ProofLedger | `proof_metrics` (materialized) | Sort/filter speed; recomputed from chain |
| Analytics/events | — | `events` (product analytics) | Internal |
| Advantage Report data | — | `advantage_reports` | TermiX deliverable |

**Never stored off-chain as authority:** anything a judge could challenge as "trust us". If it affects trust or money → on-chain or it doesn't exist.

---

## 2. Postgres schema (drizzle — source: `apps/api/src/db/schema.ts`)

### `agents` — ERC-8004 mirror (from 8004scan / registry)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | ERC-8004 agent id (on-chain identifier) |
| `owner_address` | bytea/text | registry owner |
| `chain_id` | int | 56/97 |
| `registered_at` | timestamptz | from registry |
| `uri_metadata` | jsonb | raw registry URI payload (sanitized) |
| `capabilities` | jsonb | normalized capability tags (8004scan) |
| `last_synced_at` | timestamptz | cache freshness |
| `sync_source` | text | '8004scan' \| 'registry' |

### `listings` — our marketplace layer (1:1 optional → agents)

| Column | Type | Notes |
|---|---|---|
| `agent_id` | text PK, FK→agents | |
| `category` | enum(`grid`,`rebalance`,`yield`,`health`) | one of the four official categories |
| `tagline`, `description` | text | Nina-language copy |
| `price_per_task_usd1` | numeric(12,2) | display; actual flow is x402 |
| `risk_level` | enum(`low`,`medium`,`high`) | derived from allowlist + strategy type |
| `default_caps` | jsonb | suggested {spend_cap_usd1, duration_days, allowlist[]} |
| `status` | enum(`active`,`paused`,`delisted`) | |
| `proof_program` | boolean | opted into Proof Engine |
| `claimed_by` | text | developer address that signed the claim |
| `claimed_at` | timestamptz | |
| `created_at`/`updated_at` | timestamptz | |

### `developers`

| Column | Type | Notes |
|---|---|---|
| `address` | text PK | wallet |
| `display_name`, `avatar_url`, `links` | text/jsonb | |
| `stake_amount` | numeric | P2 (staked listings) |

### `proof_records` — ProofLedger mirror (**append-only, like the chain**)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | on-chain record id |
| `agent_id` | text FK→agents | |
| `kind` | text | 'decision' \| 'outcome' |
| `intent_hash` | bytea | decision rows |
| `deadline` | timestamptz | decision rows |
| `registered_tx`/`registered_block` | text/bigint | pre-registration proof |
| `outcome_status` | enum(`pending`,`win`,`loss`,`neutral`,`expired`) | outcome rows |
| `pnl_usd1` | numeric(14,2) | resolved from objective sources |
| `evidence_uri` | text | intent+execution+price bundle (IPFS/Greenfield P2) |
| `attested_tx`/`attested_block` | text/bigint | |
| `raw` | jsonb | full event payload for audit page |

### `proof_metrics` — derived per agent (recomputed by keeper; never hand-edited)

| Column | Type | Notes |
|---|---|---|
| `agent_id` | text PK | |
| `window` | enum(`7d`,`30d`,`all`) → composite PK w/ agent_id | leaderboard filters |
| `verified_return_pct` | numeric(8,2) | return-weighted |
| `win_rate` | numeric(5,4) | wins / resolved |
| `max_drawdown_pct` | numeric(8,2) | |
| `tasks_resolved` | int | |
| `avg_response_min` | numeric(8,1) | decision→execution latency |
| `category_stat` | jsonb | e.g., `{"saved_liquidations": 3}` for health agents |
| `computed_at` | timestamptz | freshness |

### `jobs` — ERC-8183 escrow mirror

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | our job id (maps to escrow job ref) |
| `escrow_ref` | text | ERC-8183 job identifier on-chain |
| `agent_id` | text FK | |
| `hirer_address` | text | |
| `config` | jsonb | {amount_usd1, spend_cap, duration, allowlist, triggers} |
| `status` | enum(`created`,`funded`,`active`,`awaiting_attestation`,`completed`,`revoked`,`failed`,`expired`) | mirrors escrow + our UX states |
| `fee_usd1` | numeric | 3% protocol fee |
| `created_at`/`updated_at`/`completed_at` | timestamptz | |

### `sessions` — Altana Keystore mirror

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | session key / keystore entry id |
| `job_id` | uuid FK→jobs | |
| `agent_id` | text FK | |
| `allowlist` | jsonb | human labels + raw entries (drives Trust Panel sentences) |
| `spend_cap_usd1` | numeric | |
| `expires_at` | timestamptz | |
| `revoked_at` | timestamptz null | + revoke tx |
| `keystore_tx` | text | registration link |

> **Interim note (2026-08-17):** until real Altana access, this table is itself the source of truth (not a mirror) — `services/session-store.ts` writes it directly and `services/session-enforcement.ts` enforces straight from it before any chain call. `keystore_tx` stays null; every API response marks itself `enforcedBy: "agentdesk-self-hosted"` so it's never confused with a real Keystore registration. `job_id` currently points at a minimal synthetic `jobs` row inserted for FK/cardinality reasons only (services/hire.ts's real hire flow is still unwired) — see session-store.ts's file banner.

### `receipts` — x402 payment records

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `job_id` | uuid FK | |
| `amount_usd1` | numeric | gross |
| `fee_usd1` | numeric | protocol fee |
| `settlement_tx` | text | |
| `payer`/`payee` | text | |

### `users`, `watchlist`, `events`, `advantage_reports`

- `users(address PK, prefs jsonb, created_at)` — wallet-only identity.
- `watchlist(user_address, agent_id, created_at)` — composite PK.
- `events(id, type, payload jsonb, created_at)` — product analytics (page views, hire funnel steps).
- `advantage_reports(id, task_label, baseline jsonb, with_agent jsonb, outputs jsonb, created_at)` — TermiX deliverable data (time/cost/quality deltas + attached outputs).

---

## 3. Relationships

```mermaid
erDiagram
    AGENTS ||--o| LISTINGS : "marketplace layer"
    AGENTS ||--o{ PROOF_RECORDS : "decision→outcome pairs"
    AGENTS ||--|| PROOF_METRICS : "derived (7d/30d/all)"
    AGENTS }o--|| DEVELOPERS : "owner/claimed_by"
    AGENTS ||--o{ JOBS : "hired"
    JOBS ||--|| SESSIONS : "scoped by"
    JOBS ||--o{ RECEIPTS : "paid via x402"
    JOBS }o--|| USERS : "hirer wallet"
    USERS ||--o{ WATCHLIST : ""
    WATCHLIST }o--|| AGENTS : ""
    PROOF_RECORDS }o--|| PROOF_METRICS : "input to"
```

Key cardinalities: 1 agent → 0..1 listing (unlisted agents appear only in 8004scan-native browse); 1 job → exactly 1 session; proof_records strictly append (mirrors contract invariant — DB has no UPDATE/DELETE grant on that table at the app level).

## 4. API surface ↔ tables (wiring map — keep in sync!)

| Endpoint | Reads | Writes | Notes |
|---|---|---|---|
| `GET /v1/agents?category&verified&sort` | agents ⨝ listings ⨝ proof_metrics | — | 60s cache; `verified=true` requires metrics row |
| `GET /v1/agents/:id` | all per-agent | — | 30s cache; includes trust panel source |
| `GET /v1/agents/:id/proof` | proof_records | — | paginated, `kind` filter |
| `GET /v1/leaderboard?window&category` | proof_metrics ⨝ listings | — | 120s cache |
| `POST /v1/jobs` | listings, sessions(sanity) | jobs(status=created) | wallet sig required |
| `POST /v1/jobs/:id/fund` | jobs | jobs(status=funded), receipts(pending) | escrow via I4 |
| `POST /v1/jobs/:id/revoke` | jobs, sessions | sessions.revoked_at, jobs(status=revoked) | Keystore revoke tx |
| `GET /v1/jobs/:id/events` (SSE) | events + chain subscriptions | — | dashboard live feed |
| `POST /v1/publish` | agents(owner sig), developers | listings, developers | claim flow |
| `GET /v1/verify/:agentId` | proof_records raw | — | audit page |
| `GET /v1/stats` | aggregate counters | — | landing counters |
| `POST /v1/sessions` | — | agents (upsert FK anchor), jobs (synthetic companion row), sessions | **Wired 2026-08-17.** Self-hosted scoped-session create (INTEGRATION.md I6 honesty note) — allowlist fixed this wave to `ProofLedger.registerDecision` for one agentId; spend cap stored, not chain-enforced. Not in the original v1.0 API sketch — closes the gap flagged since Wave 1B. |
| `GET /v1/sessions/:id` | sessions | — | real row; response carries `enforcedBy: "agentdesk-self-hosted"` |
| `GET /v1/sessions/:id/permission-sentence` | sessions | — | Trust Panel sentence, rendered only from the session row |
| `POST /v1/sessions/:id/revoke` | sessions | sessions.revoked_at | idempotent — revoking twice is a no-op, not an error |
| `POST /v1/sessions/:id/decisions` | sessions | proof (chain only — no `proof_records` write yet, indexer is the writer per §5) | "agent runner" gate: services/session-enforcement.ts checks revoked/expired/allowlist in Postgres and refuses **before** any chain call; only if permitted does it submit a real `ProofLedger.registerDecision` tx (signed by `DEMO_AGENT_PRIVATE_KEY`, not `KEEPER_ATTESTER_KEY`) |

## 5. Sync rules (who writes what, when)

| Writer | Trigger | Action |
|---|---|---|
| api (read-through) | request + stale cache | refresh `agents` from 8004scan (I2) |
| keeper indexer | ProofLedger events (block poll) | insert `proof_records` |
| keeper attester | decision deadline passed | resolve outcome → `attestOutcome` tx → insert outcome row → enqueue metrics job |
| keeper metrics job | after any attest / hourly | recompute `proof_metrics` **from on-chain rows only** |
| api jobs service | escrow events (poll/webhook) | update `jobs.status`, insert `receipts` |
| keeper session watcher | Keystore events | update `sessions` (revocation/expiry) |

**Anti-drift:** daily reconciliation job compares latest on-chain record id per agent vs DB max(id); mismatch → alert + backfill from chain. DB is always allowed to be *behind*, never *ahead or wrong*.

## 6. Changelog

| Date | Change | Commit |
|---|---|---|
| 2026-08-16 | Initial ERD v1.0 | `docs: ERD` |
| 2026-08-17 | Wired `POST/GET /v1/sessions*` + `POST /v1/sessions/:id/decisions` to real Postgres + real Chapel ProofLedger calls (self-hosted session enforcement, INTEGRATION.md I6 honesty note); closes the standalone-sessions-route gap flagged since Wave 1B | (pending PM commit) |
