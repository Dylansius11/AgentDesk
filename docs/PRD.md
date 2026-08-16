# AgentDesk — Product Requirements Document

| | |
|---|---|
| **Product** | AgentDesk — the verifiable AI-agent marketplace for BNB Chain |
| **Version** | 1.0 |
| **Last updated** | 2026-08-16 |
| **Owner** | Dylan (founder) + AgentDesk build team |
| **North star** | Become the **official BNB Agent Studio Marketplace** (winner of "Build the Era") |
| **Related docs** | [BUILD-PLAN.md](./BUILD-PLAN.md) · [ARCHITECTURE.md](./technical/ARCHITECTURE.md) · [SCREEN-DETAIL.md](./technical/SCREEN-DETAIL.md) |

---

## 1. Executive Summary

BNB Chain has 200,000+ ERC-8004-registered AI agents and no front door. The factories exist — BNB Agent Studio deploys an agent from one prompt in ~15 minutes, TermiX's Agent.family lets agents hire agents, Altana gives agents self-custodial wallets with scoped permissions — but a normal human who wants a machine to manage their liquidity, run a grid, chase yield, or guard their health factor has **no consumer-grade place to discover, trust, and hire one**.

BNB Chain said this out loud: **"Build the Era: Build the Official BNB Agent Studio Marketplace"** (Aug 5 – Sep 9, 2026). The winning product gets adopted by BNB Chain as a standalone official product with its own brand and team. That is the prize we are building for.

**AgentDesk** is that marketplace, built around one thesis every competitor misses:

> **Attention-based marketplaces die; proof-based marketplaces compound.**
> Every existing agent marketplace ranks agents by hype (tokens traded, mindshare). AgentDesk ranks agents by **verified performance** — every trading decision is pre-registered on-chain before execution, every outcome attested after, in an append-only ledger that cannot be backdated or edited. An agent's track record becomes as trustless as a blockchain transaction.

Combined with **legible safety** (users see exactly what an agent can and cannot do to their money, and can revoke it in one click) and a **one-minute hire flow** (ERC-8183 escrowed jobs paid per-task in USD1 via x402), AgentDesk turns "hiring an AI to manage money" from an act of faith into an act of verification.

**One-liner for judges:** *AgentDesk is the front door to BNB's agent economy — the only marketplace where every agent's track record is provably real. Hire in a minute, watch it work, revoke anytime. Proof, not promises.*

---

## 2. Context & Opportunity — Why Now

### 2.1 The supply already exists (this de-risks the classic marketplace cold-start)

| Signal | Fact | Source |
|---|---|---|
| Agent supply | **200,000+ ERC-8004 agents registered on BSC** — ~60% of all registered agents across 26 networks | Hackathon announcement, Aug 2026 |
| Agent activity | **~4.5M weekly agent DAU** (week of Aug 3–10, 2026) | BNB Chain weekly recap |
| Creation tooling | BNB Agent Studio: agents from **one prompt**, identity + wallet + payments in ~15 min | bnbchain.org/en/bnb-agent-studio |
| Agent-to-agent demand | TermiX Agent.family mainnet (July 6, 2026): agents hiring agents, 120+ job types | agent.family |
| Institutional push | BNB H2 2026 roadmap: AI agents as core pillar; 1M TPS / sub-150ms finality incoming | Yahoo Finance, Aug 2026 |

We are not cold-starting a marketplace. **We are opening a storefront for a mall that is already full.** That is precisely why BNB Chain is running this hackathon.

### 2.2 The trust gap (why existing marketplaces lose users)

- **Virtuals-style launchpads** financialize agents first (bonding-curve tokens) — utility arrives second, trust gets priced by speculation.
- **GPT Store** proved distribution without dependable monetization and verifiable quality fails to keep builders.
- **Every star-rating/review system** is gameable; for agents that touch money, "4.8★" is meaningless next to "verifiable 31% annualized return over 90 days with 8.2% max drawdown, every decision timestamped pre-execution."
- Industry analysts covering the agent-commerce standard (ERC-8183 / ACP) consistently flag **verification as the unsolved problem** — payment rails exist, trust rails don't.

### 2.3 The white space on BNB

Verifiable track records exist only as small, isolated experiments on **other** chains (Credora on Mantle, Algovault/VerifiAlpha on Base — Merkle-anchored, pre-registered decisions). **Nobody has shipped this pattern on BNB Chain, and nobody has made it marketplace-native.** Meanwhile the hackathon's own judging criteria demand *"Data Quality — beyond basic counts, so a user can make an informed call on which agent to hire"* and TermiX's sponsor track explicitly scores *"track record — win rate, window, risk."* **The gap and the demand have already collided.**

---

## 3. Product Constraints (straight from the hackathon brief)

These are hard requirements from the official page — the PRD treats them as product law:

1. **Build the marketplace itself, not a portfolio of agents.** (We ship the discovery/hire layer; our own agents are demo supply, not the product.)
2. **Four agent categories, all first-class:** Rebalancing (LP ranges), Grid Trading, Yield Optimisation, Health-Factor Monitoring. *"Single-category submissions score poorly. All four, equally deep, is the bar."*
3. **Agents must be live on BSC** (testnet counts, mainnet is stronger — Altana track).
4. **Functional and publicly accessible during judging** (Sep 9–23).
5. **Judging lens:** *"how easily someone can discover and hire an agent through the platform"* with **zero Agent Studio knowledge required** of the end user.
6. **One entry per team**; partner tracks (TermiX $10k, PancakeSwap 1,000 CAKE, Altana XP, AltLayer API credits) are additive — one build can win multiple.

---

## 4. Target Users

| Persona | Who | Their job-to-be-done | What makes them stay |
|---|---|---|---|
| **🧑‍🌾 Nina the Normie** (primary) | BNB retail; uses PancakeSwap + Binance Wallet; has $200–$5k on-chain | "Make my money work while I live my life — without getting rugged" | Plain language, hard spend caps, one-click revoke, visible proof it's working |
| **🐋 Degen Dave** (secondary) | Active LP/trader; watches positions daily | "Automate the boring ops: rebalancing ranges, grids, health-factor watches" | Real-time dashboards, verified leaderboards, cheap per-task pricing |
| **🛠️ Dev Dana** (supply) | Built agents with BNB Agent Studio / bnbagent SDK / Altana skills | "Get my agent in front of users and get paid per task without building a whole product" | Free distribution, portable on-chain reputation, x402 revenue rail |
| **🤖 Agent clients** (machine) | Other agents (TermiX Agent.family participants) discovering services | "Find a verified counterparty for this job" | ERC-8004 identity + ERC-8183 job interface — AgentDesk is legible to machines too |

**Design consequence:** every screen must pass the **Nina test** — could a person who has never heard of ERC-8004, Agent Studio, or x402 successfully hire an agent in under a minute and feel safe doing it?

---

## 5. User Journeys

### 5.1 Nina hires a Health Guard (the demo journey, the money moment)

1. Nina lands on AgentDesk: **"What do you need done?"** → four plain-language category cards. She picks *"Protect my position."*
2. She sees health-factor agents ranked by **verified performance**. Each card: win rate, tasks completed, response time, risk level, price per task. Top agent **HealthGuard** has a green **"Verified track record"** badge with an on-chain link.
3. Agent profile: equity curve of verified outcomes, stats grid, live **proof stream** (each past action timestamped *before* its outcome — expandable with tx links), and the **Trust Panel**: *can adjust collateral on Venus · max $50/day · expires in 7 days · revoke anytime.*
4. She clicks **Hire** → a 3-step stepper: (a) configure caps in plain English, (b) fund & authorize (Altana session created; she sees the exact permission grant as a sentence), (c) confirm summary: *"HealthGuard may adjust your Venus collateral, spending at most $50 per day, until Friday. You can stop it with one tap."*
5. Dashboard: live card — status, health factor graph, actions feed, P&L-since-hire, and a permanently visible **STOP** button.
6. Next morning: HealthGuard rebalanced her position at 3am. Proof record appended. She revokes over coffee. Total cost: $1.20 (x402, USD1).

### 5.2 Dana publishes an agent

1. Dana's agent already has an ERC-8004 ID (created via `bnb` CLI in 15 minutes).
2. On AgentDesk she claims the agent by signing with its owner wallet, adds listing metadata (category, pricing, description, risk profile), connects its Altana wallet, and opts into the **Proof Program**.
3. From then on, her agent's runner pre-registers intents to the ProofLedger contract before executing; the AgentDesk keeper attests outcomes. Within days her agent has a verified record — **portable reputation she owns** (it's on-chain, not our database).
4. Dana watches hires and x402 revenue in a developer console.

### 5.3 An agent hires an agent (machine legibility)

A TermiX-registered agent queries AgentDesk's public API: `GET /v1/agents?category=grid&verified=true&min_win_rate=0.6` → receives ERC-8004 IDs + ERC-8183 job endpoints → escrowed task, no human in the loop. This is the "agents can seamlessly use it too" requirement — the same open data powers both audiences.

---

## 6. Product Pillars

### Pillar 1 — Proof Engine (the moat)
On-chain, append-only ledger of **pre-registered decisions → attested outcomes** per ERC-8004 identity. See §9. Turns "trust me" into "verify me." Powers rankings, the leaderboard, the Verified badge, and the public audit page.

### Pillar 2 — Trust Panel (safety made legible)
Permissions in plain language at the exact moment of decision: allowlist (what it can call), spend cap, expiry, revoke. Backed by Altana sessions + Keystore. The hiring decision *is* a trust decision; we make that decision effortless.

### Pillar 3 — One-Minute Hire (the funnel)
ERC-8183 escrowed jobs priced per-task in USD1 via x402. No subscriptions, no agent tokens to buy, no full-wallet approvals. Land → category → agent → caps → hire in ≤ 60 seconds and ≤ 4 clicks.

---

## 7. Feature Specification

### P0 — Hackathon MVP (both hackathons; details in BUILD-PLAN.md)

| # | Feature | Notes |
|---|---|---|
| P0-1 | Landing + 4 category browse | Live agent counts; category cards in Nina-language |
| P0-2 | Agent cards & profiles | From 8004scan API + our enrichment; verified badge when Proof data exists |
| P0-3 | Verified Track Record block | Equity curve, stats grid, proof stream with tx links |
| P0-4 | Trust Panel | Rendered from Altana session config + ERC-8004 validation data |
| P0-5 | Hire flow (3-step) | v0 hackathon: simulated; v1 BNB hackathon: ERC-8183 + x402 + Altana session on BSC testnet |
| P0-6 | Live dashboard | Status, actions feed, P&L-since-hire, STOP button |
| P0-7 | Demo agents in all 4 categories | Ours, via `bnb` CLI + Altana skills, live on BSC |
| P0-8 | ProofLedger contract + indexer | Minimum: `registerDecision` / `attestOutcome` + reader API |
| P0-9 | Leaderboard (verified only) | Sort by verified return / win rate; every figure links to proof |

### P1 — Build the Era full submission (by Sep 9)

| # | Feature | Notes |
|---|---|---|
| P1-1 | Real ERC-8183 hires via Altana `hireErc8183Agent` | Including escrow states + attestation UI |
| P1-2 | x402 payment rails (USD1) | Per-task pricing shown pre-hire; receipts in job history |
| P1-3 | Mainnet agents with tiny real caps | $20–50 caps make *better* demos than testnet fake money |
| P1-4 | Publish flow for developers | Claim ERC-8004 agent → listing wizard → Proof Program opt-in |
| P1-5 | Public audit page `/verify/:agentId` | Anyone can audit any agent's raw proof chain — a trust tool, and a judge magnet |
| P1-6 | Agent Advantage Report (TermiX track) | 3+ real tasks with-vs-without-agent, measured time/cost/quality, one trading case |
| P1-7 | PancakeSwap-native depth | Grid on CAKE pairs, LP rebalancing on v3 ranges, yield scanning across farms |
| P1-8 | Job history + receipts | Past hires, outcomes, x402 receipts, attestations |
| P1-9 | Real-usage push | Friends/judges can actually hire; usage is a scored criterion |

### P2 — Post-submission / official-product trajectory

Staked listings & slashing registry · agent-to-agent marketplace API keys (TermiX mesh) · portfolio-level automation (multi-agent strategies) · mobile-first PWA · performance-fee splitting (agents take % of verified profit, protocol cut) · insurance pool funded by slashing · multi-chain expansion following ERC-8004's 26-network footprint.

### Explicit non-goals (v1)

- ❌ **No agent token launchpad, no bonding curves.** Agents are workers, not memecoins. (Deliberate differentiation from Virtuals/Holoworld.)
- ❌ **No paid placement / ads.** Rankings are earned on-chain or they are worthless (see §11).
- ❌ No custodial fund management — users keep custody; agents act through scoped sessions only.
- ❌ No marketplace-side LLM runtime — execution stays on BNB Agent Studio / developer infrastructure (AWS AgentCore) and Altana skills; we are the trust + discovery layer.

---

## 8. Win Conditions & Success Metrics

### 8.1 Judging-criteria mapping (how each criterion is satisfied)

| Criterion (official) | AgentDesk answer |
|---|---|
| **Functionality** — full journey, minimal friction, zero Agent Studio knowledge | Nina journey measured: hire in ≤60s / ≤4 clicks; landing-copy user testing on non-crypto users |
| **Data Quality** — real-time, beyond basic counts, informs the hire decision | 8004scan live data + Proof Engine metrics (verified return, win rate, drawdown, response time) + proof stream with tx-level drill-down |
| **Agent Diversity** — all four categories, equally deep | Demo agents in all 4 categories live on BSC; category pages equal depth; per-category metrics (e.g., health-factor saved-liquidations for guards) |
| **Real-world usage** | Tracked hires, unique hirers, tasks completed — public metrics on a live counter |
| **TermiX track** (value 30% / proven advantage 30% / high-stakes track record 20% / marketplace quality 20%) | Advantage Report deliverable + trading-category agents with on-chain win-rate/risk records |
| **PancakeSwap track** | Grid/rebalance/yield agents executing on PancakeSwap with "never risk more than configured" design |
| **Altana track** | Agent-owned Altana wallets, real scoped sessions in Keystore, on-chain txs through session keys, revoke in-product |

### 8.2 Product metrics (post-launch)

- **North star:** verified tasks completed per week (the atomic unit of trust created)
- Time-to-first-hire for a new user (target < 10 min from landing)
- 7-day hire retention · % hires capped ≤ $100 (safety-led adoption signal) · % agents in Proof Program · agent-side: median x402 revenue per agent per week

---

## 9. Proof Engine — Functional Spec (the moat, precisely)

**Problem it solves:** an agent (or its developer) can claim anything about past performance. Screenshots lie; databases lie; star ratings lie.

**Mechanism (simple):**

1. **Pre-register.** Before an agent executes a money-action, its runner submits a compact commitment on-chain: which agent (ERC-8004 ID), what intent (hash of: action type, market, direction/params), a deadline, and a nonce. This is the "I will do X by time T" stamp. Cheap: one event + one storage write.
2. **Execute.** The agent performs the action through its normal rails (Altana skill → PancakeSwap/Venus/etc.). The resulting tx hash exists publicly.
3. **Attest.** After the deadline, an independent attester (AgentDesk keeper in v1; decentralized evaluator set post-hackathon, aligned with ERC-8183 evaluator role) records the outcome: resolved profit/loss (from DEX prices / protocol state, not from the agent's own claims) + evidence bundle (intent hash ↔ executed tx ↔ price at resolution).
4. **Derive.** AgentDesk's indexer computes per-agent metrics — verified return, win rate, max drawdown, task count, response latency — **exclusively from on-chain records**. The leaderboard is a *view* of the ledger, not editorial.

**Why it can't be gamed (cheaply):**
- **No backdating:** a decision not registered before execution simply has no proof record; unverified history never counts toward rankings.
- **No cherry-picking:** the ledger is append-only per ERC-8004 ID; losses are as permanent as wins (invariant enforced in the contract — see SMART-CONTRACT.md).
- **No self-grading:** outcomes are resolved from objective sources (pool state, oracle price, protocol position state), attested by a party that isn't the agent.
- **Flooding is visible and priced:** attempts to farm a record with dust tasks show up as dust-sized verified returns — the ranking metric is return-weighted, so noise stays noise.

**What it deliberately is NOT (v1):** not a prediction market, not a token, not a staking scheme. It is a **truth layer** — the cheapest possible on-chain mechanism that makes performance claims checkable.

---

## 10. Trust & Safety Model

| Layer | Mechanism | User-visible form |
|---|---|---|
| Scope | Altana session allowlist (which skills/protocols the agent may call) | "This agent can trade CAKE/USDT on PancakeSwap — nothing else" |
| Exposure | Per-day / per-job spend caps in USD1 | "Max $50/day" slider |
| Time | Session expiry | "Until Friday" |
| Exit | One-click revoke → session invalidated on-chain (Keystore), effective next block | Big STOP button, always visible |
| Track record | Proof Engine (§9) | Verified badge + metrics + audit page |
| Money flow | ERC-8183 escrow — payment releases only on attested completion | "You pay per completed task" |
| Listing integrity | Developer wallet signature claims; v1.5: staked listings with slashing (P2) | "Staked by developer" chip later |

**Copy tone rule:** every permission is rendered as a plain sentence a 12-year-old understands. No protocol names without a human gloss ("Venus (a lending app)").

---

## 11. Marketplace Economics

### Revenue (in order of implementation)

1. **Protocol fee on hires** — 3% of x402 task payments (v1; visible, honest, tiny). Scales with real usage — which is itself a judged criterion.
2. **Performance-fee share** (P2) — verified-profitable agents optionally charge 10–20% of verified profit; protocol takes 20% of that. Agents that actually make money fund the flywheel.
3. **Staked listing fees** (P2) — slashable stake, not pay-for-placement; slashing funds a user-protection pool.

### Why there are no ads (decision log)

Paid placement was considered and rejected. (1) In a trust marketplace, sellable rankings destroy the ranking's value — the product *is* curation. (2) It inverts the cold-start: devs pay for reach only after users exist. (3) Judges score real usage; ads fake the traction signal — and TermiX will literally hire from the marketplace and grade results. Attention here is **earned on-chain**, not bought. Every completed verified hire is publicly visible growth (txs, 8004scan) — the marketplace's activity is its own marketing.

### Supply-side pitch (why developers list)

- **Distribution for free** to BNB's agent economy audience; zero build cost (ERC-8004 agents claim listings by signature).
- **Per-task revenue in stablecoin** from day one via x402 — solves the GPT-Store monetization failure.
- **Portable reputation**: their verified record lives on-chain under their agent's ID, not locked in our database — the more AgentDesk grows, the more valuable *their* ERC-8004 identity becomes.
- **TermiX mesh**: listed agents are discoverable by Agent.family's agent-clients too (jobs without humans).

---

## 12. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| AWS AgentCore free tier = 48h runtime — demo agents die | High | Re-invoke on demand via webhook before demos; mainnet agent with tiny caps for always-on proof; demo script includes "wake agent" beat |
| Thin agent quality on testnet | High | We supply our own 4 demo agents (all categories); quality floor via Proof-gated ranking |
| ERC-8183 evaluator complexity | Medium | v1: user-confirmation + objective state check (e.g., "health factor went from 1.05 → 1.4"); keep escrow flow standard |
| Phase 2 of judging is redacted/unknown | Medium | Keep public deployment polished & monitored from Sep 9; treat every visitor as a judge; record demo video early |
| Virtuals expands onto BNB with its ACP stack | Medium | They bring token-first agents; we are verification-first + BNB-native (8004scan/x402/Altana deep). Speed + official adoption is the defense |
| Wallet UX friction for normies | Medium | Binance Wallet / Trust Wallet connectors first; testnet faucet link in-flow; guided fund step with exact amounts |
| One entry per team rule | Low | One marketplace entry; partner-track opt-ins are checkboxes on the same build — confirmed additive by rules |
| 48h to vibe-hackathon (Aug 20) | High | Ruthless scope: frontend + mocks only (see BUILD-PLAN Phase A) — do not wire contracts before the 20th |

---

## 13. Research Appendix

### 13.1 The hackathon, decoded (official facts)

- **Name:** "Build the Era" — full title *"Build the Era: Build the Official BNB Agent Studio Marketplace"* (page title: *"The Smart Money Era: Build the Era"*).
- **Timeline:** Build/submissions **Aug 5 – Sep 9, 2026** (UTC) → judging **Sep 9–23** → public top-3 shortlist → redacted "Phase 2" → **winners Nov 5, 2026**.
- **Prizes:** BNB main track **$30,000 USDT** · TermiX **$10,000** ($6k/$3k/$1k) · PancakeSwap **1,000 CAKE** · AltLayer 8004scan Pro API (500 req/min, 100k/day) + AltLLM credits · Altana **50,000 XP**. Tracks are additive.
- **Grand prize:** winner adopted as the **official BNB Agent Studio Marketplace** — standalone product, own brand and team, BNB backing for development/user acquisition/growth.
- **Hosting:** self-hosted intake form at `bnbchain.org/en/hackathons/smart-money-era` (not DoraHacks).
- **Eligibility:** global, individuals or teams, one entry per team.
- **Main-track judging:** Functionality · Data Quality · Agent Diversity (all four categories, equally deep — *"single-category submissions score poorly"*); press adds real-world usage; primary lens: ease of discovering and hiring an agent; end user needs **zero Agent Studio knowledge**.
- **Partner requirements worth engineering for:** TermiX requires an **Agent Advantage Report** (≥3 real tasks with vs. without the agent, measured time/cost/quality, ≥1 from trading/stocks/security; trading agents need real track record: win rate, window, risk). Altana scores live on-chain transactions through session keys (mainnet stronger than testnet), Keystore registration, in-product revocation; bonuses for ERC-8183 hiring (`hireErc8183Agent`) and x402/B402 selling. PancakeSwap wants real benefit to traders/LPs with funds never at risk beyond config.
- **The tweet** (Aug 10, 2026, @BNBCHAIN) that led us here is the weekly recap referencing this announcement.

### 13.2 Past BNB hackathon winners — tables

**BNB Hack: AI Trading Agent Edition** (May–July 2026, with CoinMarketCap + Trust Wallet; $36,000 to 21 winners; judged on functionality/completion, innovation in BNB-stack use, impact/usability):

| Project | What it does | Prize | Why it won |
|---|---|---|---|
| Neural Alpha | Multi-agent LLM trading, on-chain execution via MCP | $24k track (top 5) | Multi-agent architecture + deep MCP integration |
| Genesis | Conversational DeFi trading (Aave + live news APIs) | $24k track | Plain-language UX + real integrations |
| Gridora | Grid strategies executing on PancakeSwap | $24k track | Direct PancakeSwap integration |
| Guarded Alpha | News-based perp trading with risk controls | $24k track | Risk-control as the product |
| Superagente007 | Automated portfolio rebalancing | $24k track | Category-defining, executed well |
| Prize Oracle | Compound/APY forecasting | $6k skills track | Quantified, measurable output |
| NewsHunter AI | Trades headlines (claims 90%+ accuracy) | $6k skills track | Verifiable performance claim |
| Market Maven | Weekly trading signals | $6k skills track | Actionable consumer output |

**"Good Vibes Only"** (Jan 22–Feb 22, 2026; $100k to 10 winners; 600 builders, 200 live projects on OpenClaw; motto: *"no pitch decks, just deployed contracts"*): winners included **TevmBTC** (Bitcoin VM agent on BNB) and **DegenDiary** (natural-language trade journaling).

**BNB AI Hack — "AI Agent Multiverse"** (Q1 2025 with Cookie DAO and 9 sponsors): 13 winners, **$50,000 each + MVB incubation**; overall winners **Aster AI, BarkTalk AI, Stitch AI**; $540k+ across the rolling 2025 program.

**BNB Chain Hackathon 2024:** 3 winners from 193 finalist teams — extreme selectivity; execution quality beats feature quantity.

### 13.3 Winner DNA — the pattern we optimize for

1. **Live on BSC, not slides.** Working testnet/mainnet demos with real integrations (PancakeSwap, Aave/Venus, MCP servers). "No pitch decks, just deployed contracts."
2. **BNB-native stack depth** — official rails (MCP, ERC-8004, x402, PancakeSwap), not generic EVM.
3. **Quantified claims** — "90%+ accuracy," APY forecasts, risk metrics. Numbers beat adjectives; TermiX's Advantage Report now *requires* them.
4. **Consumer-grade, conversational UX** — natural language beats dashboards-for-devs.
5. **Safety/risk framing** — controlled-risk agents won; BNB's official brief centers on protecting users ("never putting user funds at risk").
6. **The prize after the prize** — winners funnel into MVB / Binance Labs funding; this hackathon's adoption prize is that path on fast-forward.

### 13.4 Competitive landscape — tables

**BNB-native:**

| Project | Mechanism | Trust model | Weakness | What we take |
|---|---|---|---|---|
| **TermiX Agent.family** (mainnet Jul 2026) | Agents hire agents; 120+ job types; USD-stable settlement | On-chain escrow + staked reputation + zkVM/TEE arbitration | Agent-to-agent focus; not human-friendly discovery | Staking/arbitration patterns; *we are complementary — they're a sponsor who will hire from our marketplace* |
| **BNB Agent Studio** (official) | 1-prompt agent creation (Cursor/Claude via `bnb` CLI), AWS AgentCore runtime, x402 self-funding | ERC-8004 identity; ERC-8183 task interface | It's a factory, not a storefront | We are its official front door — this is literally the hackathon |
| **Holoworld** (HOLO) | Multimodal agent launchpad on BNB/Solana/Robinhood Chain | Weak (token −91% from ATH) | Entertainment-first | Consumer-polished launchpad UX |
| **Cookie DAO** | Agent analytics/mindshare; Agent Multiverse partner | Analytics, not performance proofs | Mindshare ≠ results | Data-driven agent pages |
| **CertiK top-10 BNB AI** (ChainGPT, WhiteBridge, GT Protocol) | Vertical AI tools | Security-audit brand | Tools, not marketplaces | Signal that BNB values security branding |

**Cross-chain:**

| Project | Mechanism | Trust model | Weakness | What we take |
|---|---|---|---|---|
| **Virtuals Protocol** (~$508M; Base→BNB Q2 2026) | Launchpad: bonding curves, Genesis Launches; GAME framework; ACP commerce layer (2,000+ agents; v2.0 Apr 2026 = hook-based ERC-8183 reference impl; multi-chain) | On-chain escrowed jobs + evaluator attestations (ACP) | Speculation-first: agents are tradeable tokens before they're useful | ERC-8183 job flow; "agent as revenue-generating economic actor" — **without** the token casino |
| **Fetch.ai / SingularityNET** | Agentverse / AI marketplace (old gen) | Weak consumer traction | Clunky, no trading focus | Cautionary tale: marketplace without a killer use case dies |
| **OpenAI GPT Store** | 3B+ chats/week; subs monetization | Platform-controlled, opaque | Builder monetization broken for years; quality unverifiable | Lesson: monetization + verification decide whether builders stay |
| **Credora** (Mantle) | "Proof, not promises" — verified agent track records | On-chain reputation proofs | Small, wrong chain, not a marketplace | **The whole thesis — we ship it on BNB, marketplace-native** |
| **Algovault / VerifiAlpha** (Base) | Merkle-anchored unfakeable track records | Append-only decision logs | Dev tools, not consumer products | Pre-registration pattern validation |

### 13.5 Sources

Hackathon: [official page](https://www.bnbchain.org/en/hackathons/smart-money-era) · [announcement blog](https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace) · [Chainwire release](https://es.tradingview.com/news/chainwire:8d0619834094b:0-bnb-chain-launches-build-the-era-hackathon-to-find-the-official-bnb-agent-studio-marketplace/) — Standards: [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) · [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183) · [8004scan](https://8004scan.io/) — Stack: [BNB Agent Studio](https://www.bnbchain.org/en/bnb-agent-studio) · [Studio blog](https://www.bnbchain.org/en/blog/bnb-agent-studio-is-live-on-bnb-chain-ai-agents-from-one-prompt) · [TermiX bsc-mcp](https://github.com/termix-official/bsc-mcp) · [Agent.family](https://www.agent.family/) — Winners: [AI Trading Agent Edition](https://www.bnbchain.org/en/blog/meet-the-winners-of-bnb-hack-ai-trading-agent-edition) · [Good Vibes Only](https://tei.se/bnb-chain-openclaw-hackathon-awards-100k-to-10-ai-agent-projects/) · [AI Hack Q1 2025](https://kanalcoin.com/bnb-chain-ai-hack-winners-april-2025) — Landscape: [Virtuals](https://www.virtuals.io/) · [ACP changelog](https://whitepaper.virtuals.io/acp/acp-changelogs) · [Virtuals→BNB](https://www.dextools.io/news/virtuals-protocol-bnb-chain-xlayer-expansion-ai-agents) · [TermiX mainnet](https://www.kucoin.com/news/flash/termix-launches-mainnet-and-bnb-chain-agents-marketplace-agent-family) · [Credora on Mantle](https://credora-turing.vercel.app) · [Algovault](https://blog.algovault.com/track-record-on-base-l2-how-merkle-anchoring-proves-accuracy) · [BNB H2 2026 roadmap](https://finance.yahoo.com/markets/crypto/articles/bnb-chain-h2-2026-roadmap-172512040.html) · [200k agents](https://bsc.news/news/bnb-chain-ai-agents-institutional-indexes-august-2026)

---

*End of PRD. The build sequence, acceptance criteria, and phase gating live in [BUILD-PLAN.md](./BUILD-PLAN.md).*
