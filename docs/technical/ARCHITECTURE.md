# AgentDesk — Architecture

| | |
|---|---|
| **Version** | 1.0 · 2026-08-16 |
| **Shape** | **pnpm monorepo** — one repo, three deployables (web, api, keeper), shared typed SDK |
| **Related** | [TECH-STACK.md](./TECH-STACK.md) · [ERD.md](./ERD.md) · [INTEGRATION.md](./INTEGRATION.md) |

---

## 1. System overview

AgentDesk is a **trust and discovery layer** over BNB's existing agent infrastructure. We do not run agents; we make them findable, provable, and safe to hire.

```
                          ┌────────────────────────────────────────────────┐
                          │                    USERS                       │
                          │   humans (Binance Wallet / Trust / MetaMask)   │
                          │   + agents (TermiX mesh, ERC-8004 peers)       │
                          └──────┬───────────────────────────┬─────────────┘
                                 │ web (Next.js on Vercel)   │ public REST
                                 ▼                           ▼
┌─────────────────────────────────────────────┐   ┌──────────────────────────┐
│                 APPS.WEB                    │   │       APPS.API (Hono)    │
│  landing · marketplace · profile · hire ·   │──▶│  /v1 agents · proof ·    │
│  dashboard · leaderboard · verify · publish │   │  jobs · sessions         │
│         (RSC + client islands)              │   │  SSE /events (dashboard) │
└─────────────────────────────────────────────┘   └──────────┬───────────────┘
                                                             │
                          ┌──────────────────────────────────┼───────────────┐
                          ▼                                  ▼               ▼
              ┌───────────────────────┐        ┌──────────────────┐  ┌──────────────┐
              │   Supabase Postgres   │        │  APPS.KEEPER     │  │  BNBSmartChain│
              │  cache · enrichment · │◀──────▶│  indexer+attester│  │  (Chapel +   │
              │  metrics · job state  │        │  metrics jobs    │  │   mainnet)   │
              └───────────┬───────────┘        └────────┬─────────┘  └──────┬───────┘
                          │ read-through cache          │ reads/writes      │
                          ▼                             ▼                   ▼
              ┌───────────────────────┐        ┌──────────────────────────────────┐
              │  EXTERNAL TRUTH       │        │  OUR CONTRACTS                   │
              │  8004scan API · ERC-  │        │  ProofLedger (append-only        │
              │  8004 registry · Alta-│        │  decisions→outcomes)             │
              │  na Keystore · ERC-   │        │  (integration contracts are      │
              │  8183 escrow · Venus/ │        │   external & referenced, not     │
              │  PancakeSwap state    │        │   redeployed)                    │
              └───────────────────────┘        └──────────────────────────────────┘
```

**Boundary rule:** on-chain data is *truth*; Postgres is *cache + derived views*; the API never invents authoritative state. The leaderboard is a materialized view of the ProofLedger, nothing more.

## 2. Why this shape (decision log)

| Decision | Choice | Why | Rejected alternatives |
|---|---|---|---|
| Repo layout | **pnpm monorepo** | Shared zod schemas/types (`packages/sdk`) between web, api, keeper, and agent runners — one source of truth; atomic cross-app changes during a 3-week sprint | Polyrepo (sync hell at hackathon speed) |
| Web vs API split | **Next.js (Vercel) + Hono API (Railway), separate** | The API needs long-lived processes: SSE streams, event indexing loops, attestation deadlines. Serverless functions time out; a always-on Node service is simpler to reason about | Everything-in-Next API routes (can't hold SSE/indexer loops); everything-in-Hono (lose Next RSC/SEO/AI-tooling familiarity) |
| Where do agents run? | **Not ours.** BNB Agent Studio runtime (AWS AgentCore) + developer infra; our demo agents there too | We are the marketplace/trust layer — judges' stack, BNB's architecture, and our ops budget all agree | Running agent loops in our API (coupling, liability, 48h free-tier death) |
| Contracts footprint | **One core contract (ProofLedger)** + deep *use* of external standards (ERC-8183 escrow via Altana SDK, ERC-8004 registry reads, x402 payments) | Maximum "BNB-native depth" points per engineering hour; immutability of ProofLedger *is* the product | Reimplementing escrow/identity/payments (unaudited duplicates of official standards — judges will notice) |
| Data plane | Postgres cache in front of chain + 8004scan | Sub-100ms agent pages for judging; rate-limit safety (8004scan Pro = 500 req/min); metrics need SQL anyway | Direct chain reads per page-load (slow, rate-limited); pure decentralized storage (unjustified complexity) |
| Realtime | SSE, not WebSocket | One-way dashboard updates; SSE is simpler, plays fine with Next, no sticky sessions | WS gateway (ops weight), polling (laggy dashboards) |

## 3. Repository structure

```
agentdesk/
├── apps/
│   ├── web/                    # Next.js 15 (App Router) — the marketplace UI
│   │   ├── app/                # routes (see SCREEN-DETAIL.md for page map)
│   │   │   ├── (marketing)/    # landing, how-it-works
│   │   │   ├── (marketplace)/  # browse, agent/[id], leaderboard, verify/[id]
│   │   │   ├── (app)/          # dashboard, jobs, publish  (wallet-gated)
│   │   │   └── api/health/     # uptime probe only
│   │   ├── components/         # ui/ (shadcn) + feature components per domain
│   │   ├── lib/api-client.ts   # implements packages/sdk AgentDeskClient
│   │   └── providers/          # wallet (wagmi/RainbowKit), query, theme
│   ├── api/                    # Hono on Node 22 — REST + SSE
│   │   ├── src/routes/         # v1/agents.ts, v1/proof.ts, v1/jobs.ts, v1/sessions.ts
│   │   ├── src/services/       # scan8004.ts, proof.ts, hire.ts, altana.ts, metrics.ts
│   │   ├── src/db/             # drizzle schema + migrations (source of ERD truth)
│   │   └── src/index.ts
│   └── keeper/                 # indexer + attestation workers (same deployable as api
│                               #  in Phase B week 1; splits out only if load demands)
├── packages/
│   ├── sdk/                    # zod schemas + TS types + AgentDeskClient interface
│   │                           #  (fixtures client & http client both implement it)
│   └── contracts/              # Foundry project → typechain/viem artifacts for ProofLedger
│       ├── src/ProofLedger.sol
│       ├── test/
│       └── script/Deploy.s.sol # forge script, env-parameterized (anvil/Chapel/mainnet, same bytecode)
├── agents/                     # our 4 demo agents (bnb CLI scaffolds + Altana skills)
│   ├── grid-goblin/
│   ├── yield-shepherd/
│   ├── health-guard/
│   └── range-ranger/
├── docs/                       # this documentation set
├── .claude/                    # subagents + project skills
└── CLAUDE.md
```

**Import rules:** `apps/*` may import from `packages/sdk` and `packages/contracts` (types only). Apps never import each other. `packages/sdk` imports nothing internal — it is the seam everything shares.

## 4. Core flows (sequence)

### 4.1 Discover (read path)

```
Browser → web (RSC) → api /v1/agents?category=grid
  → api: Postgres cache fresh? serve (<50ms)
  → stale → 8004scan API (+ ERC-8004 registry spot-check) → upsert cache → serve
  → enrichment: join proof_metrics (from keeper) + listings (our table)
```

### 4.2 Hire (write path — Phase B)

```
Browser → web: hire wizard
  1. api POST /v1/jobs  { agentId, config } → creates job intent + Altana session params
  2. wallet (user) signs session grant → Altana Keystore registers scoped session
  3. Altana hireErc8183Agent → ERC-8183 escrow funded (x402, USD1, incl. 3% protocol fee)
  4. agent runner picks up job → pre-registers intent → ProofLedger.registerDecision
  5. agent executes via skills (PancakeSwap/Venus) → tx hash
  6. keeper: deadline passed → resolves outcome from pool/protocol state
     → ProofLedger.attestOutcome(recordId, outcome, evidence)
  7. SSE → dashboard live feed; escrow releases on attestation; metrics job recomputes
  8. revoke anytime: wallet → Keystore revoke tx → agent's session dead next block
```

### 4.3 Attest (keeper loop)

Every N minutes: fetch unresolved decisions past deadline → for each, resolve outcome from objective sources (DEX pool price at deadline via Quoter/Pool state; Venus position state; escrow state) → submit attestation → append Postgres mirror → enqueue metrics recompute (per-agent rolling windows).

## 5. Deployment topology

| Piece | Platform | Notes |
|---|---|---|
| apps/web | **Vercel** | Preview deploys per PR; `DEMO_MODE` env toggles fixture fallback |
| apps/api (+ keeper) | **Railway** (single Node service, worker loop in-process) | Health endpoint + uptime robot; split keeper out only under load |
| Supabase Postgres | Supabase cloud | Free tier is enough for hackathon; PITR not needed |
| ProofLedger | BSC Chapel testnet → BSC mainnet | Immutable, no proxy; addresses recorded in INTEGRATION.md |
| Demo agents | BNB Agent Studio runtime (AWS) | 48h free trials — wake-on-demand webhook in api triggers runner for demos |
| Repo | GitHub (private → public Sep 8) | Conventional commits; CI = typecheck + lint + `forge test` |

## 6. Cross-cutting concerns

- **Errors & degradation:** every external call (8004scan, Altana, chain RPC) has timeout + circuit breaker; on failure the page renders last-cached data with a staleness chip. The demo never shows a dead screen.
- **Rate-limit budget:** 8004scan Pro = 500 req/min — cache TTLs: agent list 60s, agent detail 30s, leaderboard 120s. Cache-first, refresh-in-background.
- **Security:** API is read-public / write-wallet-signed (SIWE-style message from agent owner wallet for publish; user wallet for hire/session ops). No custodial keys anywhere. Keeper's attester key is the ONLY privileged key we operate — documented in SMART-CONTRACT.md with migration path to decentralized attesters.
- **Observability:** pino logs → Railway dashboard; `/api/health` checks DB + RPC + 8004scan; a status chip in the footer (judges love honesty).
- **Performance budgets:** LCP < 1.5s (RSC + edge cache), API p95 < 500ms, SSE event latency < 2s from chain.

## 7. Evolution path (post-hackathon, if adopted)

1. Keeper attestation → decentralized evaluator set (ERC-8183 evaluator role; staked attesters, dispute window) — the contract already isolates this behind one role.
2. Staked listings + slashing registry (new contract, TermiX-aligned).
3. Agent-to-agent API keys (TermiX mesh consumers) + webhook subscriptions.
4. Multi-chain reads (ERC-8004 exists on 26 networks — same explorer API pattern).
