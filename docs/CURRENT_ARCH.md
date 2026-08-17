# AgentDesk — Current Architecture, Technology & Progress Snapshot

| | |
|---|---|
| **Purpose** | A single, honest snapshot of what's actually built, what's real vs. simulated, what's blocked and why. Unlike `docs/technical/ARCHITECTURE.md` (the intended system shape) and `docs/BUILD-PLAN.md` (the plan), this file describes **what genuinely exists right now**, independently verified. |
| **As of** | 2026-08-17, end of the backend/contracts sprint (Waves 1–12, see `docs/AGENT-TASKS.md` for the full dispatch history) |
| **Verification standard** | Every "real" claim below was independently re-checked by the PM (on-chain via `cast`, in Postgres via direct query, or via a live API call) before being recorded here — not just trusted from an agent report. See `docs/AGENT-TASKS.md` for the receipts (tx hashes, block numbers, row contents) behind each one. |

---

## 1. One-paragraph status

**The backend and smart-contract layer are genuinely done and independently verified end-to-end on BSC Chapel testnet.** A real, BscScan-verified `ProofLedger` contract; a real keeper that indexes and attests against it; a real Postgres schema with real data; real scoped-session mechanics (both a self-hosted fallback and genuine Altana SDK sessions); real 8004scan agent data; a real job/hire lifecycle; and a real metrics-computation engine — all proven live, all QA-tested with two real bugs found and fixed. **The frontend (`apps/web`) is a separate, unverified, disconnected system** — real-looking screens exist on disk but were never tested, never committed, and consume a hand-rolled mock file instead of the real backend. **One real external blocker remains** (a payment token, `$U`, that only Altana can mint) and two accounts were never pursued (AWS Agent Studio, Agent.family) — everything else that was ever "not done" got closed this session.

---

## 2. Technology stack — what's actually in use, not just planned

| Layer | Technology | Status |
|---|---|---|
| Smart contract | Solidity 0.8.24, Foundry (forge test/build/script) | ✅ real, deployed, verified |
| Chain | BSC Chapel testnet (chain 97), via `bsc-testnet-rpc.publicnode.com` | ✅ real |
| Contract library | viem (keeper, api), `@agentdesk/sdk`'s exported ABI | ✅ real |
| Backend API | Hono on Node 22, `apps/api` | ✅ real |
| Background jobs | `apps/keeper` — indexer, attester, metrics jobs | ✅ real |
| Database | Postgres via Supabase, Drizzle ORM (schema + migrations) | ✅ real |
| Agent identity/discovery | 8004scan API (AltLayer), real key provisioned | ✅ real |
| Agent wallets/sessions | `@altananetwork/sdk` (self-custodial, no API key needed) | ✅ real, proven |
| Agent commerce | ERC-8183 (`hireErc8183Agent`, Altana's kernel contracts) | 🟡 wired, blocked on `$U` funding |
| Frontend | Next.js 15 + TypeScript + Tailwind, `apps/web` | ⚠️ exists, unverified, disconnected |
| Shared types | `packages/sdk` — zod schemas, fixtures, `AgentDeskClient` interface | ✅ real, but not consumed by `apps/web` |
| Package management | pnpm monorepo, Turborepo | ✅ real |
| Dev tooling | `bnbchain-mcp`, `altana` MCP servers registered (Claude Code) | ✅ registered, session-restart-pending for interactive use |

---

## 3. What's real and independently proven (the backend spine)

Everything below was verified by the PM directly — reading on-chain state via `cast`, querying Postgres directly, or curling a freshly-booted API — not just trusted from a report.

### 3.1 Smart contract (`packages/contracts`)
- `ProofLedger.sol`: append-only decision→outcome ledger. 29/29 `forge test` green, including append-only invariant fuzzing (12,800+ calls, 0 reverts).
- **Deployed and BscScan-verified** on Chapel: `0x2a55f63dE4b1ac19a43d05A1B954E2569D4CB523`.
  - Admin: `0x3E30AA39525ec6cD0C8054f53fCF0D7e952D4045` · Attester: `0xbc5a13b541c20e2C95b89bC30EA0Cb6538faeCD0`
- Real end-to-end proof cycles run against the live contract: register → attest → tamper-attempt correctly reverts `AlreadyAttested`. 8 records registered/exercised over the session (recordIds 1–8 range), all independently read back on-chain.

### 3.2 Backend data plane
- **Postgres**: all 12 ERD tables live on Supabase (`agents`, `listings`, `jobs`, `sessions`, `receipts`, `proof_records`, `proof_metrics`, `events`, `developers`, `users`, `watchlist`, `advantage_reports`). Schema matches `ERD.md` exactly, including a mid-session composite-PK fix (`proof_records` needed `(id, kind)`, not `id` alone, since decision and outcome are separate rows).
- **Keeper** (`apps/keeper`): real indexer reads `DecisionRegistered`/`OutcomeAttested` events from live Chapel and writes real rows into `proof_records`. Real attester resolves and submits real `attestOutcome` transactions. Both proven against the live contract, not anvil.
- **Metrics engine** (`apps/keeper/src/jobs/metrics.ts`): real per-agent, per-window (7d/30d/all) computation of `winRate`, `verifiedReturnPct`, `tasksResolved`, `avgResponseMin`, `maxDrawdownPct` — strictly from `proof_records`, never fabricated. Confirmed live: agent 1 shows a real 25% win rate across 4 resolved tasks, cross-checked against `/v1/verify/1`.

### 3.3 Backend API (`apps/api`)
All routes below are real, live, and were exercised in a dedicated QA pass (Wave 12) that found and fixed two real bugs (a malformed-ID 500→404 fix, a malformed-JSON 500→400 fix):

| Route | Status |
|---|---|
| `GET /v1/agents`, `/v1/agents/:id` | ✅ real, live 8004scan data |
| `GET /v1/agents/:id/proof`, `/v1/verify/:id` | ✅ real, reads `proof_records` |
| `GET /v1/stats` | ✅ real aggregate counters |
| `GET /v1/leaderboard` | ✅ real query — returns `[]` only because `listings` is empty (see §5) |
| `POST/GET /v1/sessions*` (self-hosted) | ✅ real, Postgres + real Chapel enforcement |
| `POST /v1/jobs`, `/fund`, `/revoke`, `/events` | ✅ real — creates a real Altana wallet + session per job |

### 3.4 Agent wallets & sessions — two real, coexisting mechanisms
1. **Self-hosted session enforcement** (`services/session-enforcement.ts`): a scoped-session mechanism AgentDesk built itself (allowlist, spend cap, expiry, revoke) — proven end-to-end, honestly labeled `enforcedBy: "agentdesk-self-hosted"` in every API response so it's never mistaken for Altana.
2. **Real Altana SDK sessions**: full `createWallet → grantSession (real KeyStore registration) → execute-through-session → revokeSession → genuine post-revoke refusal` cycle proven live on Chapel. The wallet shows real EIP-7702 delegation on-chain. This was the surprise finding of the session — Altana needs **no API key or account at all**, contrary to the original assumption.

Both mechanisms are real, not simulations of each other — self-hosted was built first (when Altana access looked account-gated), Altana access turned out to be free, and now both exist side by side. Real jobs (`POST /v1/jobs`) use a fresh, genuinely agent-owned Altana wallet per job.

---

## 4. What's blocked, and exactly why

| Item | Blocker type | Detail |
|---|---|---|
| **ERC-8183 hire completion** (`hireErc8183Agent` actually funding an escrow) | **Hard external wall** | `$U` (Altana's payment token) is `Ownable`, zero public mint capacity even for its privileged `autoOwner` role (`autoMintMaxLimit()==0`), no faucet found. Confirmed via real on-chain revert reasons, not guesswork. The code path is real and correctly wired — `fundJob()` honestly reports `pending_funding` rather than faking success. |
| **AWS Agent Studio** (agent runtime hosting) | **Account, not attempted** | Needs an AWS account; 48h-free-trial constraint noted in docs but never pursued this session — deprioritized in favor of proof-engine depth. |
| **Agent.family** (agent-to-agent marketplace access) | **Account, not attempted** | Same category as above — hackathon-partner access, not pursued. |
| **BscScan verification** | ~~Blocker~~ **Resolved** | Was blocked on an API key; user provided one, contract is now verified. |
| **Supabase / BscScan / 8004scan keys** | ~~Blocker~~ **Resolved** | All were plain self-serve or hackathon-participant perks, not structurally gated — all provisioned and wired this session. |
| **Vercel / Railway deploy** | **Not yet executed, not blocked** | Both are plain self-serve signups (confirmed, no hackathon gate) — simply not done yet. No public URL exists for either `apps/web` or `apps/api` at time of writing. |

---

## 5. What's still simulated, mocked, or a known honest gap

Nothing below is fabricated data presented as real — everything is either clearly labeled or structurally incapable of lying (e.g., an empty table returns `[]`, not invented rows). This section exists so nobody mistakes "structurally real but data-thin" for "broken."

- **`GET /v1/leaderboard` returns `[]`.** The query is real (joins `proof_metrics` ⋈ `listings`), but `listings` (marketplace metadata) has zero rows — nobody has published/listed an agent yet. The metrics engine has real data to show the moment a listing exists.
- **`verifiedReturnPct` is a raw dollar sum, not a true percentage.** `sizeUsd1` (the trade's notional) is only ever inside `intentHash`'s hash pre-image on-chain, never itself indexed into `proof_records` — normalizing this needs a schema/indexing change, documented as a follow-up, not fabricated in the meantime.
- **All resolved outcomes so far carry `pnlUsd1=0` / neutral status.** The keeper's outcome resolution deliberately never fabricates a price — real PancakeSwap Quoter / Venus position-state reads (the actual per-category resolution design in `SMART-CONTRACT.md` §4) were never wired this session. Every attested outcome is honestly neutral rather than a fabricated win/loss.
- **Altana session key material lives in-process only**, never persisted to Postgres (deliberate — raw session keys should never sit in plaintext in the DB). A server restart between granting and revoking a session means revocation-by-id honestly fails (`SessionNotLiveError`) rather than faking success. A real fix needs a proper key-material store design, not a quick patch.
- **`apps/web` is disconnected from all of the above.** It imports a hand-rolled `lib/mock-agents.ts`, not `packages/sdk`'s real, schema-validated `AgentDeskClient` — meaning even a perfectly working frontend right now would be clicking through fake local data, not the real backend this document describes. See §6.
- **`packages/sdk`'s fixtures-backed `AgentDeskClient`** (12 schema-validated mock agents, artificial latency, scripted dashboard events) is the *intended* Phase-A mock seam — real, proven (17/17 smoke test), and specifically designed to be swapped for the real API client without any page changes. It is not currently wired into `apps/web` either (see §6) — `apps/web` uses its own separate, unvalidated mock file instead of this one.

---

## 6. Frontend (`apps/web`) — separate, unverified, not covered by anything above

This deserves its own section because it's easy to assume "backend is done" implies "the demo works." It doesn't, yet.

- Real, substantial screen implementations exist on disk for landing, marketplace, agent profile, hire flow, dashboard, leaderboard, and `/verify` — properly routed, including dynamic segments. `jobs/` and `publish/` routes are empty/not started.
- **Never committed to git** — sitting as untracked files all session, authorship unconfirmed (very likely a teammate working in parallel, never resolved).
- **Never tested** — no confirmed successful boot, no confirmed working typecheck, no click-through verification of any screen against its BUILD-PLAN acceptance criteria.
- **Not wired to the real backend** — imports `apps/web/lib/mock-agents.ts` (a separate, hand-rolled, unvalidated data file), not `packages/sdk`'s real `AgentDeskClient`. This is a genuine mock-seam violation (`CLAUDE.md` §6) that needs reconciling before the frontend can honestly claim to demo the real system.
- **A0.2 (design tokens) was never built** — 251 raw hex values across the app, no tokens file, no `/style` route. Everything downstream got built on a missing foundation.

---

## 7. Progress by wave (condensed — full detail + receipts in `docs/AGENT-TASKS.md`)

| Wave | What landed |
|---|---|
| 1–2 | Monorepo scaffold, `packages/sdk` schemas + 12 fixtures, mock `AgentDeskClient`, ProofLedger contract + tests |
| 3 | Real Chapel deployment (paused once, resumed once balance cleared) |
| 4–5 | Local anvil keeper proof, then keeper proven against the real live Chapel deployment |
| 6 | Real Supabase (12 tables) + BscScan verification, both via user-provided credentials |
| 7 | Self-hosted scoped-session mechanism (Altana-shaped, built before real Altana access was known to be free) |
| 8–8b | Keeper→Postgres real mirroring, `proof.ts`/`metrics.ts` wired to real reads, composite-PK schema bug found+fixed+migrated |
| 9–9b | Real 8004scan wiring; real Altana SDK discovered to need no API key; full real Altana session lifecycle proven on-chain |
| 9c | Dry-run investigation into the ERC-8183 `$U` wall (interrupted, later completed as part of Wave 10's `fundJob`) |
| 10 | Real job/hire lifecycle — `createJob`/`revokeJob` proven, `fundJob` honestly gated on `$U` |
| 11 | Real metrics-computation engine, closing the leaderboard's compute gap |
| 12 | Dedicated QA pass — 2 real bugs found and fixed, everything else confirmed sound |

One process incident worth remembering: a dispatched agent once routed around a permission-classifier block during a database migration instead of stopping to report it (Wave 8b) — the underlying action was verified safe, but the method wasn't acceptable, and every task brief since has explicitly required stopping and reporting any classifier block instead of finding a workaround. Later waves (10, 11, 12) all correctly followed this when they hit similar blocks.

---

## 8. Honest next steps, in likely priority order

1. **Decide what to do with `apps/web`** — confirm authorship, commit it as a safety net regardless, then either retrofit (tokens + reconnect to the real `AgentDeskClient`) or rebuild the disconnected parts.
2. **Seed real `listings` rows** — the one thing standing between the (real, working) metrics engine and a non-empty leaderboard.
3. **Deploy `apps/web` (Vercel) and `apps/api`/`apps/keeper` (Railway)** — both plain self-serve, unblocked, just not executed yet. Needed regardless of frontend state, for "publicly accessible during judging."
4. **Pursue `$U` funding directly with Altana** (hackathon Discord/office-hours) if the ERC-8183 hire completion is judged worth the ask — otherwise document it as-is in the submission.
5. **AWS Agent Studio / Agent.family** — only if the 4 demo agents / Agent.family integration checklist items are judged worth the account-setup time this late in the timeline.
