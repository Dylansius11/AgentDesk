# AgentDesk — Current Architecture, Technology & Progress Snapshot

| | |
|---|---|
| **Purpose** | A single, honest snapshot of what's actually built, what's real vs. simulated, what's blocked and why. Unlike `docs/technical/ARCHITECTURE.md` (the intended system shape) and `docs/BUILD-PLAN.md` (the plan), this file describes **what genuinely exists right now**, independently verified. |
| **As of** | 2026-08-19, refreshed after merging `origin/dev` through `bcb7451` and re-checking the API, keeper, OMP setup, and external integration docs. |
| **Verification standard** | Every "real" claim below was independently re-checked by the PM (on-chain via `cast`, in Postgres via direct query, or via a live API call) before being recorded here — not just trusted from an agent report. See `docs/AGENT-TASKS.md` for the receipts (tx hashes, block numbers, row contents) behind each one. |

---

## 1. One-paragraph status

**The backend spine and ProofLedger are real, but the product is not end-to-end complete yet.** The contract, Postgres mirror, proof reads, metrics computation, 8004scan adapter, scoped sessions, and most job lifecycle endpoints exist. The public web app is deployed and consumes the shared fixtures client, while the live HTTP API is not deployed or connected to it. Remaining product gaps include publish/claim, authorization, live API enrichment, restart-safe keeper/session state, objective outcome resolution, x402 receipts, and the final ERC-8183 seller→fund→deliver→settle path. The old claim that `$U` had no faucet is now stale: a public Chapel `$U` faucet exists; the hire path still needs a funded fresh buyer wallet, a willing seller/provider, deployment-safe wallet funding, and one verified end-to-end run.

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
| Agent commerce | ERC-8183 (`hireErc8183Agent`, Altana kernel) | 🟡 wired; public Chapel `$U` faucet found, full seller→settle run still unverified |
| Frontend | Next.js 15 + TypeScript + Tailwind, `apps/web` | 🟡 committed and publicly deployed; still fixtures-backed rather than live-API-backed |
| Shared types | `packages/sdk` — zod schemas, fixtures, `AgentDeskClient` interface | ✅ consumed by `apps/web`; no production HTTP client implementation yet |
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
| `GET /v1/leaderboard` | ✅ real query; currently returns two seeded proof-backed rows |
| `POST/GET /v1/sessions*` (self-hosted) | ✅ real, Postgres + real Chapel enforcement |
| `POST /v1/jobs`, `/fund`, `/revoke`, `/events` | 🟡 real partial lifecycle — wallet/session creation and revoke exist; restart recovery, authorization, `$U` funding proof, seller delivery/settlement, and job-specific live SSE remain incomplete |

### 3.4 Agent wallets & sessions — two real, coexisting mechanisms
1. **Self-hosted session enforcement** (`services/session-enforcement.ts`): a scoped-session mechanism AgentDesk built itself (allowlist, spend cap, expiry, revoke) — proven end-to-end, honestly labeled `enforcedBy: "agentdesk-self-hosted"` in every API response so it's never mistaken for Altana.
2. **Real Altana SDK sessions**: full `createWallet → grantSession (real KeyStore registration) → execute-through-session → revokeSession → genuine post-revoke refusal` cycle proven live on Chapel. The wallet shows real EIP-7702 delegation on-chain. This was the surprise finding of the session — Altana needs **no API key or account at all**, contrary to the original assumption.

Both mechanisms are real, not simulations of each other — self-hosted was built first (when Altana access looked account-gated), Altana access turned out to be free, and now both exist side by side. Real jobs (`POST /v1/jobs`) use a fresh, genuinely agent-owned Altana wallet per job.

---

## 4. What's blocked, and exactly why

| Item | Blocker type | Detail |
|---|---|---|
| **ERC-8183 hire completion** (`hireErc8183Agent` funding and settling an escrow) | **Integration work, no longer a `$U` access wall** | A public Chapel faucet at `https://united-coin-u.github.io/u-faucet/` dispenses the same `$U` token used by Altana. Remaining work: use a fresh uncompromised buyer wallet with tBNB, claim `$U`, select a willing seller/provider, remove the local-only deployer-file dependency, then prove fund → submit → settle/refund on-chain. |
| **Keeper historical catch-up** | **RPC capability** | The configured public RPC rejects scans over 50,000 blocks and has pruned the deployment-era history. The indexer now chunks requests to 50,000 blocks, but full backfill still needs an archive-capable Chapel RPC or a durable checkpoint established before pruning. |
| **AWS / BNB Agent Studio** | **Optional account/runtime setup** | Not required by the current Hono/Postgres/keeper backend. It is still needed if we want the four planned demo-agent runtimes. Current tooling is the Python `bag` CLI; local `bag dev` works without AgentCore, while AWS deployment needs an AWS account, IAM/CDK permissions, and pay-as-you-go AgentCore resources. |
| **Agent.family** | **Account, not attempted** | Partner marketplace access is still not configured; it does not block the core API or ProofLedger. |
| **BscScan verification** | ~~Blocker~~ **Resolved** | The deployed ProofLedger source is verified. |
| **Supabase / BscScan credentials** | ~~Blocker~~ **Resolved** | Supabase and BscScan are configured locally. Local 8004scan credentials are currently missing from the migrated API env. |
| **Vercel / Railway deploy** | **Partially complete** | Web is live at `https://agentdesk-web-delta.vercel.app`. API and keeper are not publicly deployed in the current verified state; the historical SDK/NodeNext build regression is fixed, but Railway auth and a deployment-safe job-wallet funding secret/path still need resolution. |

---

## 5. What's still simulated, mocked, or a known honest gap

Nothing below is fabricated data presented as real — everything is either clearly labeled or structurally incapable of lying (e.g., an empty table returns `[]`, not invented rows). This section exists so nobody mistakes "structurally real but data-thin" for "broken."

- **Leaderboard data exists, but it is thin.** The real query currently returns seeded rows for agent IDs `1` and `77`. Their categories were manually assigned for demo visibility; this is not equivalent to a completed publish/claim flow.
- **`verifiedReturnPct` is a raw dollar sum, not a true percentage.** `sizeUsd1` is only inside the `intentHash` pre-image, so the current schema cannot normalize return by notional.
- **Outcome resolution is not objective yet.** Existing records are mostly zero-PnL/neutral because PancakeSwap price and Venus position resolvers are not wired. The one historical `win` row still has zero PnL.
- **Altana session material is process-local.** Per-job wallet files exist, but the in-memory SDK session is not rehydrated after restart, so later fund/revoke calls can fail honestly rather than recover.
- **The web app uses the shared SDK seam but remains fixtures-backed.** `apps/web/lib/agentdesk-client.ts` uses `FixturesAgentDeskClient`; there is no production HTTP/SSE client implementation selected by `NEXT_PUBLIC_DEMO_MODE`.
- **Publish and authorization are incomplete.** `POST /v1/publish` returns `501`; job/session mutation routes do not yet verify wallet ownership/signatures.
- **x402 is not implemented.** The env/schema placeholders and `receipts` table exist, but no facilitator call or receipt-writing service is present.

---

## 6. Frontend (`apps/web`) — deployed prototype, not live-backend product

- Landing, marketplace, profile, hire, dashboard, leaderboard, and verify screens are committed.
- The public Vercel deployment responds with real rendered HTML at `https://agentdesk-web-delta.vercel.app`.
- Components consume the shared `@agentdesk/sdk` fixtures client rather than importing ad-hoc mock files, which fixes the original seam violation.
- The production HTTP/SSE `AgentDeskClient` adapter and runtime demo/live switch are still missing, so the deployed UI does not exercise the Hono API.
- The latest `dev` merge intentionally reverted the Wave 13c style-token `/style` work; A0.2 is therefore not currently satisfied on this branch.
- Publish/jobs history screens and a verified end-to-end Nina hire→dashboard→STOP run remain incomplete.

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

1. **Create a production HTTP/SSE `AgentDeskClient` and switch the web app to the live API**, retaining fixtures as an explicit judging fallback.
2. **Make jobs deploy-safe and authenticated:** replace the hardcoded local deployer-file dependency, rotate exposed test keys, add wallet-signature checks, and rehydrate encrypted session material after restart.
3. **Prove one complete ERC-8183 flow:** fresh buyer wallet → tBNB → public `$U` faucet → willing seller → fund → deliver → settle/refund. Then wire x402 receipts.
4. **Fix keeper durability:** archive-capable Chapel RPC plus a persistent indexed-block checkpoint; then implement objective PancakeSwap/Venus outcome resolvers.
5. **Complete publish/claim and live listing enrichment**, then deploy API + keeper to Railway and reconnect the already-live web.
6. **Use BNB Agent Studio selectively:** scaffold one canary agent with `bag` and local `bag dev`; add AWS AgentCore only after the local agent flow is stable, then repeat for the remaining three agents.
