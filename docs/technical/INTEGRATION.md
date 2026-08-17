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
| I2 | 8004scan API (AltLayer) | Structured agent data feed (identity, capability, reputation, feedback) | B | 🟢 | Data Quality |
| I3 | **ProofLedger (ours)** | Verified track records — the moat | B | 🔴 | Data Quality + TermiX "track record" |
| I4 | ERC-8183 escrow jobs | Trustless hire: pay on attested completion | B | 🟡 (wired, live-untested — see I6) | Functionality + Altana bonus |
| I5 | x402 payments (USD1) | Per-task money flow incl. 3% protocol fee | B | 🔴 | Real-world usage |
| I6 | Altana sessions & Keystore | Spend caps, allowlists, expiry, one-tx revoke | B | 🟡 (real SDK wired, on-chain proven up to grantSession — see honesty note) | Altana track (50k XP) |
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
- **Our usage:** `GET /v1/agents` (our route) → `apps/api/src/services/scan8004.ts` → real `GET ${SCAN8004_BASE_URL}/api/v1/agents`, read-through cache (TTL 60s list / 30s detail), `CircuitBreaker` + last-cache fallback + `stale`/`fetchedAt` in every response envelope. OpenAPI key: `SCAN8004_API_KEY` (provisioned 2026-08-17).
- **LIVE (2026-08-17):** real base path is `/api/v1/...`, **not** `/v1/...` as the original Phase-A stub assumed — confirmed against the live `${SCAN8004_BASE_URL}/openapi.json` and a direct probe. Proven end-to-end through our own running API:
  - `GET localhost:4000/v1/agents?limit=3` → real rows (e.g. `id: "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:268933"`, real owner addresses, `total: 740636` agents across chains at probe time — consistent with "BSC hosts ~60% of all registered agents").
  - `GET localhost:4000/v1/agents/97:1828` → real single-agent detail (`name: "ProofEra Health-Factor Guardian Evidence Agent"`, real `agent_wallet`, real `services.a2a` endpoint) — this is one of our own team's earlier-registered demo agents on Chapel, confirming round-trip correctness.
  - `GET localhost:4000/v1/agents/97:99999999` (nonexistent) → `404 agent_not_found`, confirmed correct not-found handling.
  - Response shape confirmed from the **real** API (snake_case, `agent_id` composite `chain_id:registry_address:token_id`, `owner_address`, `is_verified`, `total_score`, etc.), not the original guessed shape — `scan8004.ts` was rewritten to zod-parse the real fields.
- **Honesty note:** `category`/`tagline`/`riskLevel`/`status` on `AgentSummary`/`AgentDetail` are AgentDesk's own `listings`-table concepts (ERD.md §2) — 8004scan has no equivalent, so these stay `null` here rather than fabricated; the `listings` join is a separate, not-yet-wired concern. `verified`/`verifiedReturnPct`/`winRate` likewise stay `false`/`null` here — only ProofLedger-derived `proof_metrics` rows may ever render as "verified" (CLAUDE.md rule 3); 8004scan's own `is_verified`/`total_score` are a different (agent-reported reputation) concept, not proof.
- **Gotchas:** respect budget (cache-first, refresh-in-background); on outage serve last-cache + staleness chip. Response schema versioning — pin the version we code against in `scan8004.ts`'s zod schemas (not yet moved to `packages/sdk` — see that file's header for the planned swap).

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
- **LIVE (2026-08-17):** the real ERC-8183 kernel is deployed on BSC Chapel testnet (chain 97), confirmed from `@altananetwork/sdk`'s own `ERC8183_ADDRESSES` map: `commerce: 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`, `router: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`, `policy: 0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6`, `registry: 0x8004A818BFB912233c491871b3d84c89A494BD9e` (the same ERC-8004 registry 8004scan reads from on testnet — see I2), `paymentToken ($U / United Stables): 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`. Confirmed live by direct chain read: `name()="United Stables"`, `symbol()="U"`, `decimals()=18`, real non-zero `totalSupply()`.
  `apps/api/src/services/altana.ts`'s `hireErc8183Agent()` is wired to the real SDK call (`sdkHireErc8183Agent(session, { provider, task, budget }, { network: BNB_TESTNET })`) — **genuinely untested live this wave**, for two concrete, non-account-gated reasons, reported plainly rather than faked:
  1. **No real counterparty.** `hireErc8183Agent` needs a real `provider` address willing to receive an escrowed job — we don't have one wired into our own data yet (no agent in our `listings`/demo-agent set is set up as an ERC-8183 seller). Passing an arbitrary address we control would create a real on-chain job against ourselves, which is not a real hire and would misrepresent this integration.
  2. **No $U balance.** `$U` (`paymentToken` above) is `Ownable` — `owner()` reads a real address that isn't us, and no public faucet/mint function was found on the contract. Funding a job requires real $U, which we don't currently have a self-serve path to acquire.
  Both are concrete, fixable gaps (find/register a real ERC-8004 seller counterparty; acquire $U via a partner faucet or swap) — not a technical or account gate. The code path is correct and ready to exercise the moment both exist.
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
- **CORRECTION (2026-08-17, supersedes the earlier "hackathon-gated" honesty note below):** the earlier note assumed Altana SDK access needed partner onboarding — **this was wrong.** `@altananetwork/sdk` is a real, published, fully self-custodial npm package (`npm view @altananetwork/sdk` → real versions back to 0.3.2, latest 0.7.1) — **no API key, no signup, no hosted backend.** Confirmed independently against `docs.altana.network`, the npm registry, and — most concretely — the package's own shipped source (`node_modules/@altananetwork/sdk/dist/*`), which is what the wiring below is coded against. The only real requirement is testnet BNB for gas, same as any other wallet.
- **LIVE (2026-08-17) — real SDK wired and proven on-chain, up to a funding wall:** `npm install @altananetwork/sdk` into `apps/api`; `apps/api/src/lib/altana-client.ts` + `services/altana.ts` rewritten to call the real SDK (`createClient`, `createWallet`, `grantSession`, `execute`, `revokeSession`, `hireErc8183Agent` — no more stubs). Testnet chain export is `BNB_TESTNET` (confirmed from `dist/config.js`: chain 97, standalone full stack — keystore + account + relay all live on Chapel, unlike Sepolia/Base Sepolia which are keystore-only). `apps/api/scripts/altana-live-proof.ts` is the standalone proof harness (not part of the app runtime) that drove the sequence below; wallet/session keys it generates persist to gitignored `apps/api/.env.altana-agent` (verified via `git check-ignore -v` before any key touched disk), mirroring `.env.demo-agent`'s pattern exactly.
  Proven real, on-chain, this session (multiple separate runs against live Chapel — tx hashes below are independently verifiable on `testnet.bscscan.com`):
  1. **Real wallet creation** — `client.createWallet({ signer })` — e.g. `0xbEB7A2eA21a59E7aF501A27b00407c763C1c8350`.
  2. **Real funding** — plain tBNB transfer from the existing deployer key (`packages/contracts/.env.chapel-deploy`, scoped subshell, never printed) — tx `0x9e6f03adac708d5e18f60db030121d891215975e9f81279e215c073e15dd77fd`, confirmed `status: success`.
  3. **Real KeyStore-registered scoped session grant** — `client.grantSession({ wallet, signer, permissions: { calls: [{ to: PROOFLEDGER_ADDRESS_TESTNET, signature: "registerDecision(uint256,bytes32,uint64)" }], spend: [{ limit, period: "day", token: $U }] }, expiry, register: true })` — tx `0x713a9b9a7f011feabca7c69cd99a393ed1e26f2d63bc8458be8115773a23cc24`, independently re-verified via `getTransactionReceipt`: `status: success`, 11 event logs, and the wallet address's on-chain `getCode()` confirmed EIP-7702-delegated (`0xef0100` + the Altana account implementation address) — this is real allowlist + real spend cap + real expiry + real public KeyStore registration, not a simulation.
  4. **Root-caused and fixed a real bug** in our own calling code: the first `execute()`-through-session attempt reverted with an opaque empty reason from the relay's `wallet_prepareCalls` simulation. Traced to `ProofLedger.registerDecision`'s `deadline` parameter being `uint64` on the real deployed contract (`packages/contracts/src/ProofLedger.sol`), not `uint256` — encoding with the wrong type silently produces the wrong 4-byte function selector, so the relay's simulation hit "no matching function" and reverted with no reason string. Fixed by encoding with the real exported `proofLedgerAbi` (`@agentdesk/sdk`) instead of a hand-rolled ABI, exactly like `session-enforcement.ts` already does correctly.
  5. **Funding wall, not a technical wall:** a full fresh end-to-end run (wallet → fund → grant → execute-through-session with the fix in place → revoke → confirm post-revoke refusal) needs roughly 0.001–0.003 tBNB per fresh wallet (KeyStore registration fee + gas for 3–4 txs). The Chapel deployer key — already low per the "borderline balance" deploy note — was driven down to ~0.0002 tBNB across this session's funding attempts and is now below that threshold. **This is the one piece not re-proven with the ABI fix in place; everything else above is independently verifiable on-chain right now.** The code is correct and ready — it needs testnet gas, nothing else.
  6. **Security note on funding, for the record:** mid-session, a private key was pasted directly into the chat (twice) as a proposed alternate funding source. It was declined both times and never used, derived from, funded, or written to disk — a key typed into a conversation is compromised by that fact alone, independent of intent; the only safe funding paths for this pipeline are (a) topping up the existing deployer address `0x3E30AA39525ec6cD0C8054f53fCF0D7e952D4045` from outside this session, or (b) a fresh key generated and stored the same way every other key in this repo is (local, gitignored, never printed).
- **Recommendation (flagging for PM/user decision, not decided here):** with the real SDK now proven this far, our informed recommendation is that **real Altana sessions should become the primary path once the funding wall above is cleared and one more full run confirms the fix end-to-end** — it gives every checklist box for real (agent-owned wallet, real session-key limits, actual public KeyStore registration, in-product revocation via `revokeSession`) rather than an equivalent we built ourselves. The self-hosted mechanism below should then be considered the fallback for demo resilience (e.g. if a live judging-window Altana relay hiccup needs a guaranteed-available path) rather than the primary mechanism — but this is a call for the PM/user to make, not one made unilaterally in code; nothing has been switched over, both paths currently coexist.
- **Honesty note (2026-08-16, ORIGINAL — kept for the record, see correction above):** Altana SDK access is pending hackathon-partner onboarding — not a plain self-serve signup, and not available this session. Rather than leave the scoped-session/Trust Panel/revocation mechanism entirely unbuilt, `apps/api/src/routes/v1/sessions.ts` + `services/session-store.ts` + `services/session-enforcement.ts` implement our own **self-hosted** equivalent of the same shape: allowlist (scoped this wave to `ProofLedger.registerDecision` for one agentId), spend cap (stored/rendered, **not** enforced on-chain — ProofLedger has no spend-cap concept), expiry, and real 1-tx-equivalent revoke (Postgres `revoked_at` flip), enforced against the real deployed ProofLedger contract on Chapel — not a simulation. Every API response from these routes carries `enforcedBy: "agentdesk-self-hosted"` so it can never be mistaken for a real Altana Keystore session. Signing uses a fresh dedicated **demo-agent key** (`DEMO_AGENT_PRIVATE_KEY`, distinct from the deployer/attester keys, see env var table) since `registerDecision` has no access control. Proven end-to-end on 2026-08-17: session created via `POST /v1/sessions` → row confirmed in Postgres → `POST /v1/sessions/:id/decisions` submitted two real `registerDecision` txs (recordId 3, 4) → `getDecision` read-back on-chain matched (registrant = demo-agent address, agentId 1, intentHash matched) → `POST /v1/sessions/:id/revoke` flipped `revoked_at` in Postgres → a third decision attempt through the same session was refused with `session_revoked` (HTTP 400) **before any chain call** — confirmed via `nextRecordId()` staying at 5 across the refused attempt. This remains fully functional as a fallback path (see recommendation above).

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
ALTANA_API_KEY=          # dead config — real SDK needs no key (I6/I14 correction). Kept for backward compat only.
ALTANA_WALLET_ADDRESS=   # real Altana agent-owned wallet (I6) — public, informational
ALTANA_WALLET_PRIVATE_KEY=  # NEVER a real value in this file — lives only in gitignored apps/api/.env.altana-agent, generated by scripts/altana-live-proof.ts
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

---

## I14 · Cost & free-tier matrix (verified 2026-08-17)

**The whole BNB stack is free for the hackathon.** Our only real costs are infra we'd pay anyway (hosting/DB) and on-chain gas.

| Integration | Free? | Detail | Source |
|---|---|---|---|
| **Altana SDK** (`@altananetwork/sdk`) | ✅ Free, **no API key, no hosted backend** | "runs anywhere JavaScript runs… no API key and no hosted backend." Sessions + Keystore ops cost only BSC gas. Contracts CertiK-audited (Jul 2026) | docs.altana.network |
| **Altana skills** (all 10) | ✅ Free | Site tagline: "…always running inside limits you set. **Free to use**." Registry: `skills.altana.network/index.json` (machine-readable; each skill is a `SKILL.md`) | skills.altana.network |
| **Altana MCP server** (`@altananetwork/mcp`) | ✅ Free | Runs under **Bun** (`bunx`, NOT `npx` — npx fails on TS syntax). 17 tools. Ships a Claude Code skill too | docs.altana.network/mcp/install |
| **`@bnb-chain/mcp`** (official BNB MCP) | ✅ Free, MIT | `npx -y @bnb-chain/mcp@latest` (v1.4.0). Optional `PRIVATE_KEY` env for writes. Based on TermiX's bsc-mcp | npmjs.com/package/@bnb-chain/mcp |
| **TermiX bsc-mcp** | ✅ Free, MIT | `npx -y bsc-mcp@latest`. Same toolset as @bnb-chain/mcp | github.com/TermiX-official/bsc-mcp |
| **x402 / B402** | ✅ Free (open protocol) | You pay only the actual task payments in USD1 (+ BSC gas). No platform fee on the protocol itself | github.com/Coinbase/x402 |
| **PancakeSwap / Venus / Aave / Lista** | ✅ Free (protocols) | No integration fee; you pay swap/LP gas + position value. Venus vUSDT core pool: `0xfD5840Cd36d94D7229439859C0112a4185BC0255` (from the installed Altana venus-lending skill) | docs.venus.io, skills.altana.network |
| **ERC-8004 / ERC-8183** | ✅ Free (open standards) | Registration = mint tx on BSC (gas only) | eips.ethereum.org |
| **8004scan API (AltLayer)** | 🎁 Free for participants | Hackathon grants **Pro tier free: 500 req/min, 100k req/day** | bnbchain.org hackathon page |
| **BNB Agent Studio (`bnb` CLI)** | ✅ Free tooling | Agent creation, ERC-8004 identity, x402 wiring — free. **Runtime** costs are AWS AgentCore's (below) | bnbchain.org/en/bnb-agent-studio |
| **AWS AgentCore runtime** | ⚖️ Metered, ~free for us | Consumption-based. Harness free; **new AWS accounts get up to $200 credits**. Runtime billed per-second only while CPU-active (idle/I-O wait = free): ~$0.0895/hr per vCPU + $0.00945/hr per GB. Registry free-tier: 5k agents, 1M searches/mo. **$200 covers the entire hackathon easily.** | aws.amazon.com/bedrock/agentcore/pricing |
| **Supabase / Vercel / Railway** | ✅ Free tiers | Supabase 500MB Postgres, Vercel Hobby, Railway trial — all sufficient for MVP | their pricing pages |

**Bottom line: $0 cash outlay required to reach submission day** (AWS free credits cover runtime; everything else is free or gas-only).

---

## I15 · MCP connect-in guide (how to wire each server)

### 1. Official BNB Chain MCP (`@bnb-chain/mcp`) — chain ops + ERC-8004

Paste into Claude Code (`claude mcp add-json bnbchain '<json>'`), Cursor (`.cursor/mcp.json`), or Claude Desktop config:

```json
{
  "mcpServers": {
    "bnbchain": {
      "command": "npx",
      "args": ["-y", "@bnb-chain/mcp@latest"],
      "env": {
        "PRIVATE_KEY": "<wallet key ONLY on testnet/fresh wallet, for write ops>",
        "RPC_URL": "https://bsc-dataseed.bnbchain.org",
        "API_KEY": "<BSCScan key, optional>"
      }
    }
  }
}
```

**Gives:** blocks, transactions, contracts (ABI fetch + call/deploy), ERC-20/NFT transfers, wallet ops (create, balance, transfer), **ERC-8004 agent registration/lookup**, Greenfield storage. Chain switch via `--CHAIN_ID` (56 mainnet / 97 Chapel testnet). **Use:** instant chain reads during dev; register/re-register demo agents without leaving the IDE.

### 2. TermiX BSC MCP (`bsc-mcp`) — same engine, TermiX-flavored

```json
{
  "mcpServers": {
    "bsc-mcp": {
      "command": "npx",
      "args": ["-y", "bsc-mcp@latest"],
      "env": { "PRIVATE_KEY": "<optional, writes>", "RPC_URL": "https://bsc-dataseed.bnbchain.org" }
    }
  }
}
```

**Use:** the TermiX track's reference stack — mentioning/using it in the Advantage Report signals stack depth to a sponsor judge. (Official `@bnb-chain/mcp` is built on this repo.)

### 3. Altana MCP (`@altananetwork/mcp`) — sessions, skills, Keystore, ERC-8183

⚠️ **Must run under Bun, not npx** (ships as TS; npx fails). Install Bun: `powershell -c "irm bun.sh/install.ps1 | iex"` then:

```json
{
  "mcpServers": {
    "altana": {
      "command": "bunx",
      "args": ["@altananetwork/mcp@latest"]
    }
  }
}
```

**Gives (17 tools):** create/inspect/revoke **scoped sessions**, list/invoke **Altana skills**, Keystore reads, **`hireErc8183Agent`** flow, x402 `fetchWithX402`. **Use:** drive the entire agent-side execution surface from Claude Code during Phase B — create a session, run a PancakeSwap trade through it, revoke it, all conversationally.

### Which one when?

| Task | Use |
|---|---|
| Chain reads/writes, ERC-8004 registration, Greenfield | `@bnb-chain/mcp` |
| Agent execution (sessions, skills, x402, ERC-8183 hires) | `@altananetwork/mcp` |
| TermiX Advantage Report context | `bsc-mcp` (and cite it) |

---

## I16 · Hackathon tracks & participant perks (Build the Era, verified 2026-08-17)

**Tracks (additive — one build can win multiple):**

| Track | Prize | Judging focus |
|---|---|---|
| BNB main track | **$30,000 USDT** | Functionality (ease of discover+hire, zero Agent Studio knowledge), Data Quality (beyond basic counts), Agent Diversity (all 4 categories equal depth) + real-world usage |
| TermiX | **$10,000** ($6k/$3k/$1k) | Value of services 30% · proven advantage (Advantage Report) 30% · high-stakes track record 20% · marketplace quality 20% |
| PancakeSwap | **1,000 CAKE** | Real benefit to traders/LPs; funds never at risk beyond configuration |
| Altana | **50,000 XP** | Agents on own Altana wallets, real session-key txs (mainnet > testnet), Keystore registration, in-product revocation; bonuses for ERC-8183 `hireErc8183Agent` + x402/B402 selling |
| AltLayer | API credits + AltLLM credits | 8004scan usage depth |

**Grand prize:** winner becomes the **official BNB Agent Studio Marketplace** — standalone product, own brand & team, BNB backing.

**Participant perks (free, just for joining):**
- **8004scan Pro tier** — 500 req/min, 100k req/day (normally paid)
- **AltLLM credits** (AltLayer)
- **Altana** quickstart, testnet faucet, workshops/office-hours during the hackathon
- **TermiX** BSC MCP + Agent.family access
- Dev/support: official hackathon Discord + BNB Chain dev docs (docs.bnbchain.org)

Source: <https://www.bnbchain.org/en/hackathons/smart-money-era>
