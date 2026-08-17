# AgentDesk — BNB Chain Integration Map

| | |
|---|---|
| **Version** | 1.0 · 2026-08-16 |
| **Contract law** | Every integration here maps to a judged criterion. The depth of *official-stack usage* is itself a scoring surface (Winner DNA #2). |
| **Living doc** | Any endpoint/env var/address change updates this file in the same commit as the code. |

**Status legend:** 🔴 not started · 🟡 in progress · 🟢 done · ⚫ mocked (Phase A stub)

---

## Master table

| # | Integration | What it gives us | Phase | Status | Judging surface |
|---|---|---|---|---|---|
| I1 | ERC-8004 registry | Agent identity & discovery (200k+ agents on BSC) | B | 🔴 | Agent Diversity |
| I2 | 8004scan API (AltLayer) | Structured agent data feed (identity, capability, reputation, feedback) | B | 🔴 | Data Quality |
| I3 | **ProofLedger (ours)** | Verified track records — the moat | B | 🔴 | Data Quality + TermiX "track record" |
| I4 | ERC-8183 escrow jobs | Trustless hire: pay on attested completion | B | 🔴 | Functionality + Altana bonus |
| I5 | x402 payments (USD1) | Per-task money flow incl. 3% protocol fee | B | 🔴 | Real-world usage |
| I6 | Altana sessions & Keystore | Spend caps, allowlists, expiry, one-tx revoke | B | 🟡 (self-hosted interim — see honesty note) | Altana track (50k XP) |
| I7 | Altana skills (10 production skills) | Execution surface for demo agents | B | 🔴 | Agent Diversity |
| I8 | BNB Agent Studio (`bnb` CLI) | Create our 4 demo agents fast | B | 🔴 | Agents live on BSC |
| I9 | TermiX BSC MCP server | BSC execution tools for agents + Advantage Report | B | 🔴 | TermiX track ($10k) |
| I10 | PancakeSwap (v3 router/quoter) | Grid, LP-range rebalancing, yield targets | B | 🔴 | PancakeSwap track (1,000 CAKE) |
| I11 | Venus protocol | Health-factor positions for HealthGuard | B | 🔴 | Health category depth |
| I12 | Wallets (Binance Wallet, Trust, MetaMask) | Normie-first onboarding | A(⚡mock)→B | ⚫ | Functionality |
| I13 | BNB Chain MCP server (`@bnb-chain/mcp`) | Dev tooling: reads/writes, ERC-8004 registration from Claude/Cursor | B | 🔴 | Build velocity |

---

## I1 · ERC-8004 — agent identity standard

- **What:** Three on-chain registries: **Identity** (ERC-721-style registration + URI, browsable), **Reputation** (behavior track record), **Validation** (verification of claims/permissions). Spec: [eips.ethereum.org/EIPS/eip-8004](https://eips.ethereum.org/EIPS/eip-8004). BSC hosts ~60% of all registered agents.
- **Our usage:** read identity + metadata (via 8004scan I2 + direct registry reads as fallback); join to our ProofLedger records by `agentId` (ERC-8004 token/ID). Our publish flow *claims* an existing ERC-8004 ID by owner signature — we never duplicate identity.
- **Env/addresses:** registry address on BSC — resolve at build time via 8004scan docs; record in `.env.example` + this file when pinned.
- **Gotchas:** agents can register metadata freely — treat registry claims as *claims*; only ProofLedger data (I3) is rendered as "verified". URI content is developer-controlled: sanitize/cache; never render raw HTML.

## I2 · 8004scan (AltLayer) — the data layer

- **What:** explorer + API over ERC-8004 across chains; hackathon grants **Pro tier free: 500 req/min, 100k req/day**; API returns structured agent identity, capability, ownership, reputation, feedback, network data. <https://8004scan.io/>
- **Our usage:** `GET /v1/agents` read-through cache in api (TTL 60s list / 30s detail); nightly full re-sync; landing counters (agents count). OpenAPI key: `SCAN8004_API_KEY`.
- **Gotchas:** respect budget (cache-first, refresh-in-background); on outage serve last-cache + staleness chip. Response schema versioning — pin the version we code against in `packages/sdk` zod schemas.

## I3 · ProofLedger (our contract — see SMART-CONTRACT.md)

- **What:** append-only on-chain ledger: `registerDecision(agentId, intentHash, deadline)` before execution → `attestOutcome(recordId, outcome, evidenceURI)` after. On BSC Chapel testnet first, mainnet for anchor records.
- **Our usage:** the *only* source of "verified" metrics; leaderboard = derived view; `/verify/:agentId` audits raw records.
- **Judging gold:** termiX track explicitly scores "track record: win rate, window, risk" — we are the only marketplace that answers this with on-chain proof.
- **Deployed addresses** (pinned from `packages/contracts/exported/addresses.<network>.json`, patched to the real broadcast-receipt block per `script/patch-deployed-block.sh`):

  | Network | Chain ID | ProofLedger address | Deployed at block | Admin | Attester (`ATTESTER_ROLE`) |
  |---|---|---|---|---|---|
  | BSC Chapel (testnet) | 97 | `0x2a55f63dE4b1ac19a43d05A1B954E2569D4CB523` | 125536768 | `0x3E30AA39525ec6cD0C8054f53fCF0D7e952D4045` | `0xbc5a13b541c20e2C95b89bC30EA0Cb6538faeCD0` |
  | BSC mainnet | 56 | not yet deployed | — | — | — |
  | local anvil | 31337 | ephemeral, redeployed per session (see `exported/addresses.anvil.json`, gitignored) | n/a | n/a | n/a |

  Deployed 2026-08-17 via `pnpm --filter contracts deploy:chapel` (forge script, no `--verify` in that pass — no `BSCSCAN_API_KEY` provisioned yet). Deploy tx: `0xd85caf3ba32333999bfaa89b8205de4d4df3de4518fcf91494659682347f0be6` (block 125536768, gas used 771,895, status success). Full liveness proven end-to-end against the real deployed instance, same sequence Wave 2 proved on anvil:
  1. `registerDecision(1, intentHash, deadline)` — tx `0xad52d0e86d1395de7029616ef754a6ccf553ee1c2295a91ba206a1aea5b29a79` (recordId 1, agentId 1, block 125536943, gas used 118,916). Read back via `getDecision(1)` on-chain, matched.
  2. Past deadline, `attestOutcome(1, status=1, pnlUsd1=0, evidenceHash)` from the attester key — tx `0x2c1ed24bd0c02f89461e21de75b2caecca1cc67c2070c12e01dfcbd366c564e2` (block 125537210, gas used 99,018). Read back via `getOutcome(1)`, matched; `getDecision(1).resolved` flipped to `true`.
  3. Tamper attempt — a second `attestOutcome(1, ...)` call from the attester key — correctly reverted `AlreadyAttested` on-chain, confirming the append-only invariant holds against the real deployed bytecode, not just the test suite.

  (Attester wallet was funded with 0.001 tBNB from the deployer, tx `0xf8871eb9447e456247efe23eaf0b1dc30aa2e628b131099c9f60aec9d422fa99`, purely so it could pay gas for the attestation call above — no protocol significance.)

  `apps/keeper`'s `.env` now points at this Chapel address (`BSC_TESTNET_RPC_URL` + `PROOFLEDGER_ADDRESS_TESTNET`, populated ahead of the 2026-08-17 proof-engine-engineer wave) — the indexer/attester jobs run against live Chapel, not just local anvil, and (as of that wave) write real rows into Postgres `proof_records` on every `DecisionRegistered`/`OutcomeAttested` event they observe (see ERD.md §5, `apps/keeper/src/db/proof-records.ts`).

  **BscScan verification (2026-08-17):** source verified against the live address via standalone `forge verify-contract` (verify-only call, no redeploy — `deploy:chapel`'s bundled `--verify` is unsafe to rerun here since it also carries `--broadcast` and would create a second on-chain instance). BscScan's classic V1 verify API (`api-testnet.bscscan.com/api`, still the default in `foundry.toml`'s `[etherscan]` block) is deprecated and returned non-JSON; verification succeeded once pointed at the unified Etherscan V2 API (`--verifier-url "https://api.etherscan.io/v2/api?chainid=97"`, same `BSCSCAN_API_KEY`) — `foundry.toml` should be updated to this endpoint the next time someone touches deploy tooling. Confirmed both by the CLI (`Response: OK` / `Pass - Verified`) and independently via a fresh `getsourcecode` API call: `ContractName: ProofLedger`, `CompilerVersion: v0.8.24+commit.e11b9ed9`, `OptimizationUsed: 1`, `Runs: 200`, `EVMVersion: cancun` — matching `foundry.toml` exactly. Public page: [testnet.bscscan.com/address/0x2a55f63dE4b1ac19a43d05A1B954E2569D4CB523#code](https://testnet.bscscan.com/address/0x2a55f63dE4b1ac19a43d05A1B954E2569D4CB523#code) (note: the page itself sits behind a Cloudflare bot-check that 403s both `curl` and `WebFetch` — verification was confirmed via the API, not a manual page load).

## I4 · ERC-8183 — escrowed hiring

- **What:** Ethereum standard (Virtuals × Ethereum Foundation, Mar 2026): job escrow with **evaluator attestation** — funds escrowed → agent works → evaluator attests → release. Spec: [eips.ethereum.org/EIPS/eip-8183](https://eips.ethereum.org/EIPS/eip-8183). Virtuals ACP v2.0 is the reference implementation (2,000+ agents onboarded).
- **Our usage:** hire button creates an ERC-8183 job via **Altana's ERC-8183 SDK** (`hireErc8183Agent` — explicitly a bonus criterion on the Altana track). Job states mirrored to Postgres and rendered in job history. Do **not** redeploy our own escrow.
- **Gotchas:** evaluator design in v1 = keeper attestation from objective state (see SMART-CONTRACT.md §6); keep the job envelope standard so TermiX/agent clients interop.

## I5 · x402 / B402 — per-task payments

- **What:** HTTP-402-native payment protocol (created by Coinbase, adopted by Binance as B402; hackathon wants it). Agents already pay their own LLM bills and buy CMC data with it. Settlement in **USD1 ($U)** stablecoin on BSC. TS packages: `@x402/core`, `@x402/extensions`, `@x402/mcp` (verified in [Coinbase/x402](https://github.com/Coinbase/x402)); Python/Go also available.
- **Our usage:** hire payments flow x402 in USD1; **3% protocol fee** routed via our facilitator config; receipts stored (job history) and surfaced ("You paid $1.20 — receipt ↗"). Dev-side: agents can *sell* over x402/B402 (Altana track bonus — our agents expose a B402 endpoint for their skills).
- **Gotchas:** micropayment UX — show a single clear price pre-hire, settle silently; cache facilitator responses; USD1 approval allowance should be exact-amount, not infinite (render as "approve exactly $2.40").

## I6 · Altana — agent wallets + scoped sessions + Keystore

- **What:** self-custodial infra for sovereign agents: agent holds its own wallet/key; owner grants **scoped sessions** (allowlist of calls, spend cap, expiry); sessions registered in the **public on-chain Keystore**; revocation = 1 tx, effective immediately. Docs/SDK: altana.network; quickstart + workshop in hackathon resources.
- **Our usage (three layers):**
  1. **Trust Panel source of truth** — the plain-language permission sentences render from the *actual* session config (allowlist → "can trade CAKE/USDT on PancakeSwap"; cap → "max $50/day"; expiry → "until Friday").
  2. **Hire flow** — session created at hire; user sees exact grant; STOP button sends Keystore revoke tx.
  3. **Track checklist** — agents on own Altana wallets ✓, real limits ✓, Keystore-registered ✓, real txs through session keys ✓ (testnet counts, mainnet stronger), in-product revocation ✓, ERC-8183 hire ✓, x402 sell ✓. We tick every box.
- **Gotchas:** session creation is the riskiest UX moment — wallet-gas + approve + session in one guided flow; failure states must be recoverable (retry each step idempotently).
- **Honesty note (2026-08-17):** Altana SDK access is pending hackathon-partner onboarding — not a plain self-serve signup, and not available this session. Rather than leave the scoped-session/Trust Panel/revocation mechanism entirely unbuilt, `apps/api/src/routes/v1/sessions.ts` + `services/session-store.ts` + `services/session-enforcement.ts` implement our own **self-hosted** equivalent of the same shape: allowlist (scoped this wave to `ProofLedger.registerDecision` for one agentId), spend cap (stored/rendered, **not** enforced on-chain — ProofLedger has no spend-cap concept), expiry, and real 1-tx-equivalent revoke (Postgres `revoked_at` flip), enforced against the real deployed ProofLedger contract on Chapel — not a simulation. Every API response from these routes carries `enforcedBy: "agentdesk-self-hosted"` so it can never be mistaken for a real Altana Keystore session. Signing uses a fresh dedicated **demo-agent key** (`DEMO_AGENT_PRIVATE_KEY`, distinct from the deployer/attester keys, see env var table) since `registerDecision` has no access control. Proven end-to-end on 2026-08-17: session created via `POST /v1/sessions` → row confirmed in Postgres → `POST /v1/sessions/:id/decisions` submitted two real `registerDecision` txs (recordId 3, 4) → `getDecision` read-back on-chain matched (registrant = demo-agent address, agentId 1, intentHash matched) → `POST /v1/sessions/:id/revoke` flipped `revoked_at` in Postgres → a third decision attempt through the same session was refused with `session_revoked` (HTTP 400) **before any chain call** — confirmed via `nextRecordId()` staying at 5 across the refused attempt. This is the mechanism Altana would provide, built and proven by us in the interim; swapping in the real Altana SDK later is a service-layer change, not a route-shape change.

## I7 · Altana skills — execution surface

Ten production skills at skills.altana.network: Aave V3 Lending, Copy Trade, Four.meme Trading, Lista Liquid Staking, PancakeSwap Liquidity, PancakeSwap Trading, Token Radar, Venus Lending, Wallet Tracker, x402 API Payments.
**Our demo agents** (all created via I8, all executed via skills):

| Agent | Category | Skills used | Demo behavior |
|---|---|---|---|
| **GridGoblin** | Grid trading | PancakeSwap Trading + Token Radar | grid on CAKE/USDT, $20 mainnet cap |
| **RangeRanger** | Rebalancing | PancakeSwap Liquidity | re-center v3 LP range on volatility |
| **YieldShepherd** | Yield optimisation | PancakeSwap Liquidity + Token Radar | rotate to best farm APY band |
| **HealthGuard** | Health factor | Venus Lending (+ Aave) | keep HF > 1.8, top-up collateral |

## I8 · BNB Agent Studio + `bnb` CLI

- **What:** official scaffolding — describe an agent in one prompt inside Cursor/Claude Code; Studio handles identity (ERC-8004), wallet, x402 payments, deploys to AWS AgentCore runtime. Roadmap: TWAK wallets, BinancePay B402 merchants, dev dashboard.
- **Our usage:** create the 4 demo agents (identity + runtime + self-funding); wake-on-demand webhook (48h free trials!) — api hits the runner endpoint before demos/judging windows.
- **Gotchas:** free tier is 48h/testnet — never rely on a Studio runtime being warm; agents must be re-invocable; keep runner code in `agents/` so we can re-scaffold in minutes.

## I9 · TermiX (BSC MCP server + Agent.family + Advantage Report)

- **What:** MCP server for BSC ([github.com/termix-official/bsc-mcp](https://github.com/termix-official/bsc-mcp)) + Agent.family, the agent-to-agent marketplace (escrow, staked reputation, zkVM/TEE arbitration). TermiX **will hire from our marketplace during judging**.
- **Our usage:** (a) our agents consume TermiX BSC tools where they beat raw viem calls; (b) public API shape (`GET /v1/agents`) designed so Agent.family clients can hire through us; (c) the required **Agent Advantage Report**: ≥3 real tasks with-vs-without-agent (time/cost/quality, outputs attached, ≥1 trading case) — scheduled Week 3 (C3.2), template drafted now.
- **Gotchas:** "value of services" is 30% of their score — agents must deliver *measurable* outcomes, not vibes; every demo task logs baseline vs agent numbers from day one (cheap to do early, impossible to fake later).

## I10 · PancakeSwap — the 1,000 CAKE track

- **Our usage:** Grid/Range/Yield agents all execute through PancakeSwap v3 (quoter → router); "benefit to traders/LPs" paragraph backed by tx links; never-risk-more-than-configured is enforced by Altana caps (the track's explicit ask).
- **Gotchas:** use the Quoter for expected outputs before swaps (no blind slippage); position math for v3 ranges tested against fork tests in Phase B.

## I11 · Venus — health factor depth

- **Our usage:** HealthGuard reads user's Venus position (collateral/debt/HF), pre-registers "will add X collateral if HF < 1.5" to ProofLedger, executes via Venus skill, attestation measures HF delta. "Saved liquidations" counter = our most emotional stat.
- **Gotchas:** interest accrual between read and act — use conservative triggers; always display live HF with a 30s refresh.

## I12 · Wallets & chains

RainbowKit connectors ordered: **Binance Wallet → Trust → MetaMask** (our users' order). Chain: BSC (56) mainnet + Chapel (97) testnet switcher in footer. Testnet faucet link embedded in the fund step. SIWE-style message signing for publish/jobs (no email auth anywhere).

## I13 · BNB Chain MCP server (dev tooling)

- **What:** official MCP (`npx @bnb-chain/mcp@latest`) — blocks, txs, contracts, ERC20/NFT, wallet ops, **ERC-8004 agent registration**, Greenfield. Installed as a project skill (`bnbchain-mcp-skill`).
- **Our usage:** during development (Claude/Cursor) for instant chain reads/writes and re-registering agents; also enables ERC-8004 registration without leaving the IDE.

---

## Environment variables (single source of truth)

```bash
# apps/api
DATABASE_URL=            # Supabase Postgres (pooled)
SCAN8004_API_KEY=        # 8004scan Pro (hackathon tier)
SCAN8004_BASE_URL=https://api.8004scan.io        # pin at wiring time
BSC_RPC_URL=             # mainnet RPC (public OK, paid better)
BSC_TESTNET_RPC_URL=     # Chapel
KEEPER_ATTESTER_KEY=     # ProofLedger ATTESTER role (secret; see SMART-CONTRACT.md)
ALTANA_API_KEY=          # Altana SDK
TERMIX_API_KEY=          # TermiX services (if required at wiring)
PROOFLEDGER_ADDRESS_MAINNET=
PROOFLEDGER_ADDRESS_TESTNET=
ERC8004_REGISTRY_ADDRESS=
PROTOCOL_FEE_BPS=300     # 3%
DEMO_AGENT_ADDRESS=      # self-hosted session enforcement signer (I6 honesty note) — public, informational
DEMO_AGENT_PRIVATE_KEY=  # NEVER a real value in this file — lives only in gitignored apps/api/.env.demo-agent
# apps/keeper (also reads DATABASE_URL / BSC_RPC_URL / BSC_TESTNET_RPC_URL /
# PROOFLEDGER_ADDRESS_* / KEEPER_ATTESTER_KEY above)
KEEPER_POLL_INTERVAL_MS=60000       # indexer/attester/session-watcher loop cadence (ARCHITECTURE.md §4.3)
KEEPER_METRICS_INTERVAL_MS=3600000  # hourly proof_metrics safety-net sweep (ERD.md §5)
PROOFLEDGER_DEPLOY_BLOCK=           # new (Wave 4): indexer's getContractEvents scan start block; mirrors exported/addresses.<network>.json's deployedAtBlock
# apps/web
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# packages/contracts (deploy scripts only — script/Deploy.s.sol, see script/README.md)
# Distinct from apps/api's BSC_RPC_URL/BSC_TESTNET_RPC_URL above: these names
# match foundry.toml's [rpc_endpoints]/[etherscan] aliases exactly.
PRIVATE_KEY=                        # deployer key. NEVER a real value here — local gitignored .env only, Chapel/mainnet only
BSC_CHAPEL_RPC_URL=
BSC_MAINNET_RPC_URL=
BSCSCAN_API_KEY=                    # forge script --verify
PROOFLEDGER_ADMIN_ADDRESS=          # optional, defaults to deployer (SMART-CONTRACT.md §6)
PROOFLEDGER_ATTESTER_ADDRESS=       # required on Chapel/mainnet — keeper's PUBLIC address, not KEEPER_ATTESTER_KEY
MAINNET_CONFIRM=                    # must be exactly "yes" to deploy to chain 56
```

> ⚠️ Contract addresses & exact 8004scan endpoints get pinned in Week 1 of Phase B — update this table **in the same commit** that pins them.
