# AgentDesk — Build Plan

| | |
|---|---|
| **Version** | 1.0 |
| **Last updated** | 2026-08-16 |
| **Timeline** | **Phase A:** Aug 16 → Aug 20 (vibe-coding hackathon) · **Phase B:** Aug 20 → Sep 9 (BNB "Build the Era" submission) · Judging Sep 9–23 · Winners Nov 5 |
| **Lanes** | 🎨 **F** = Frontend · 🔌 **B** = Backend + Wiring · ⛓️ **C** = Smart Contracts + Integrations |
| **Rule zero** | **Nothing is "done" until its acceptance criteria (AC) pass.** ACs are the only move-gate between tasks. |

---

## How to read this plan

- Every task has an ID, a lane, a dependency list (`needs:`), and **acceptance criteria** — the concrete test that lets you move on.
- **Parallel tracks** are marked ⚡ — tasks in different lanes run simultaneously wherever dependencies allow.
- **Scope discipline:** Phase A is a *frontend prototype with mocked wiring*. Over-engineering Phase A is the #1 way to lose both hackathons. The "do not build" list per phase is as binding as the task list.

### Dependency graph (simplified)

```
Phase A (vibe hackathon)
  C0 contracts ABI stub ──┐
  B0 mock API + fixtures ──┼──► F1 design system ──► F2 marketplace ──► F3 agent profile
                          │         └──────────────► F4 hire flow ───► F5 dashboard
                          └──────────────────────────────────────────► F6 leaderboard

Phase B (Build the Era)
  C1 ProofLedger ──► C2 indexer/keeper ──► B1 real API ──► swap mocks out ──► F-polish
  C3 demo agents (bnb CLI + Altana) ──► C4 ERC-8183/x402 hire ──► B2 jobs engine ──► F7 dashboard v2
  (F-polish, B2, C4 run in parallel once C1–C3 land)
```

---

# PHASE A — Vibe-Coding Hackathon (Aug 16 → Aug 20)

**Goal:** a stunning, clickable, *complete-feeling* AgentDesk prototype — every screen real, all data mocked, zero chain dependencies. Judges (and we) can demo the full Nina journey end-to-end.

**Do NOT build in Phase A:** real wallet connect, real contracts deployed, real API server, auth, databases, tests beyond smoke, mobile-native anything. The `useMockData()` flag replaces the future API client — same interfaces, so Phase B swaps implementations, not pages.

### A.0 — Foundation (Aug 16, ~2h, all lanes converge here)

| ID | Task | Lane | Needs | Acceptance criteria |
|---|---|---|---|---|
| A0.1 | Monorepo scaffold: `apps/web` (Next.js 15 + TS + Tailwind + shadcn/ui), `apps/api` placeholder, `packages/sdk` (zod schemas + TS types for Agent, ProofRecord, HireSession, Category) | 🔌 B | — | `pnpm i && pnpm dev` starts web at :3000 with the AgentDesk wordmark on a blank page |
| A0.2 | Design tokens: colors (BNB-gold `#F0B90B` on near-black `#0B0E11` + semantic greens/reds), type scale (Inter/Geist + mono for numbers), spacing, radius, elevation | 🎨 F | A0.1 | Tokens file exists; a `/style` route renders the palette + type specimen; no raw hex values in components |
| A0.3 | Mock data fixtures: 12 agents (3 per category) with believable proof records, equity curves, trust panels, pricing; 2 with *unverified* status (to show the badge contrast) | 🔌 B | A0.1 | Fixtures typed by `packages/sdk` schemas; `pnpm fixtures:validate` passes |
| A0.4 | Decide + freeze demo story: Nina hires HealthGuard (see PRD §5.1) | 🎨 F | — | One paragraph demo script committed to `docs/demo-script.md` |

### A.1 — Screens (Aug 17–19, F lane is the critical path ⚡ B lane parallel)

| ID | Task | Lane | Needs | Acceptance criteria |
|---|---|---|---|---|
| F1 | **Landing**: hero ("Hire agents that can prove their P&L"), live counters (agents/tasks/verified profits — animated), 4 category cards in Nina-language, "How it works" 3-step, proof-vs-promises explainer band, footer with hackathon credits | 🎨 F | A0.2 | Lighthouse ≥ 90; a first-time visitor can state what the product does after 10s (hallway test); CTA reaches marketplace in 1 click |
| F2 | **Marketplace browse**: category tabs + filters (risk, price, verified-only), agent cards (name, avatar, category chip, verified badge, sparkline, 3 key stats, from-$X/task), sort by verified return; skeleton + empty states | 🎨 F | F1, A0.3 | Cards render from fixtures; verified/unverified visually distinct; every stat has an info tooltip in plain language; filters actually filter |
| F3 | **Agent profile**: header (identity, ERC-8004 ID chip w/ copy, developer), **Verified Track Record** (equity curve chart, stats grid, proof stream rows: intent→outcome→tx link), **Trust Panel** (permissions sentences, caps, expiry, revoke preview), pricing, sticky Hire CTA | 🎨 F | F2 | All fixture fields surfaced; proof stream rows expand to show pre-registration timestamp < execution timestamp (the "aha"); Trust Panel renders as sentences, not config keys |
| F4 | **Hire flow**: 3-step stepper — configure (amount, cap slider, duration, action allowlist w/ plain-language toggles) → authorize (simulated wallet + session preview showing *exact* permission sentence) → confirm (summary card + "what happens next") ; success state w/ confetti + STOP button intro | 🎨 F | F3 | Completable in ≤4 clicks / ≤60s (timed); summary sentence matches config exactly; back/forward preserves state |
| F5 | **Dashboard**: active hire card (status pill, live-updating actions feed on a timer, P&L-since-hire counter, health graph), prominent STOP (stops the feed + shows "revoked at [time]" toast), empty state → marketplace | 🎨 F | F4 | Feed ticks every 5s from scripted fixture events; STOP kills it instantly and visibly; P&L recomputes |
| F6 | **Leaderboard**: verified-only table, category + window (7d/30d/all) filters, each row links to profile; banner "every number on this page links to on-chain proof" (mock links) | 🎨 F | F2 | Sortable, filtered, links work; unverified agents cannot appear |
| B1 | Mock API layer: typed client (`getAgents`, `getAgent`, `getProofRecords`, `hire`, `revoke`, `getDashboard`) reading fixtures w/ artificial latency + SSE-ish event stream for dashboard | 🔌 B | A0.3 | All F-screens consume via client only (no fixture imports in components); latency visible via skeletons |

### A.2 — Polish & demo (Aug 19–20)

| ID | Task | Lane | Needs | Acceptance criteria |
|---|---|---|---|---|
| F7 | Motion + micro-interactions pass (staggered card reveals, number count-ups, chart draw-ins, hover states) using impeccable/emil skills | 🎨 F | F1–F6 | Zero jank at 60fps on a mid laptop; reduced-motion respected |
| F8 | Responsive + dark-mode audit (dark is default; light optional) | 🎨 F | F7 | No horizontal scroll 360px→1440px; tap targets ≥ 44px |
| B2 | Deploy (Vercel) + seed demo user state; record 60–90s walkthrough video | 🔌 B | F7 | Public URL loads < 2s; video tells the Nina story end-to-end |

**Phase A exit gate (Aug 20):** public URL + video ready; Nina journey clickable hire→dashboard→stop; `docs/demo-script.md` followed live without error.

---

# PHASE B — BNB Chain "Build the Era" (Aug 20 → Sep 9)

**Goal:** replace mocks with the real BNB stack, get agents live on BSC, generate real verified activity, and ship the partner-track deliverables. Judging lens: *"how easily can someone discover and hire an agent."*

### Week 1 (Aug 20–26) — Make it real

| ID | Task | Lane | Needs | Acceptance criteria |
|---|---|---|---|---|
| C1.1 | **ProofLedger contract** (Foundry): `registerDecision(agentId, intentHash, deadline)`, `attestOutcome(recordId, outcome, evidence)`, append-only invariant, events; unit tests incl. "cannot update/delete", "attest only after deadline" | ⛓️ C | — | `forge test` green; invariant test proves append-only; deployed to BSC Chapel testnet; verified on BscScan |
| C1.2 | Demo agents ×4 (GridGoblin, YieldShepherd, HealthGuard, RangeRanger) via `bnb` CLI + Agent Studio; each with Altana wallet + scoped session config | ⛓️ C | — | Each agent has ERC-8004 ID visible on 8004scan; each answered a test task on testnet |
| B1.1 | Real API server (Hono) replacing mocks: agents read-through from **8004scan API** → enrich w/ our DB cache; endpoints per `packages/sdk` | 🔌 B | C1.2 | `GET /v1/agents` returns live 8004scan data + our enrichment; mock flag off in web; response < 500ms p95 |
| B1.2 | Postgres (Supabase) schema v1 per ERD + drizzle migrations | 🔌 B | — | Migration applies clean on fresh DB; schema matches ERD.md exactly |
| F1.1 | Wire web to real API; keep fixtures behind a `DEMO_MODE` flag for fallback during judging | 🎨 F | B1.1 | Marketplace shows real registered agents (ours among them); graceful fallback if 8004scan rate-limits |

### Week 2 (Aug 27–Sep 2) — Make it trust

| ID | Task | Lane | Needs | Acceptance criteria |
|---|---|---|---|---|
| C2.1 | **Proof indexer + keeper**: index ProofLedger events → Postgres; keeper attests outcomes from objective sources (pool prices / Venus position state); metrics job computes verified return, win rate, drawdown per agent | ⛓️ C | C1.1, B1.2 | A demo trade flows decision→execution→attestation→profile update in < 10 min end-to-end; metrics derive *only* from on-chain rows |
| C2.2 | **ERC-8183 hire flow** via Altana `hireErc8183Agent` + x402 payment in USD1 (testnet); escrow states surfaced in UI | ⛓️ C | C1.2 | Test hire: funds escrowed → agent executes → attestation → release; all four states visible in job history UI |
| B2.1 | Jobs engine: create job → notify agent runner → stream events (SSE) to dashboard; revocation path calls Altana Keystore revoke | 🔌 B | C2.2 | Dashboard live-updates from real chain events; STOP button produces an on-chain revocation tx + UI confirmation |
| F2.1 | Trust Panel v2: render *real* Altana session config; permission sentences generated from actual allowlist; `/verify/:agentId` public audit page (raw proof chain + "verify on BscScan" links) | 🎨 F | C2.1 | Panel text matches on-chain session exactly; audit page reproduces every metric from raw records |
| F2.2 | Publish flow (dev console): claim ERC-8004 agent by signature, listing wizard, Proof Program opt-in | 🎨 F | B1.1 | A second developer (test wallet) can list an agent < 5 min; listed agent appears in marketplace |

### Week 3 (Sep 3–9) — Make it win

| ID | Task | Lane | Needs | Acceptance criteria |
|---|---|---|---|---|
| C3.1 | **Mainnet presence**: 1–2 agents on BSC mainnet with $20–50 caps; real micro-hires executed and proven | ⛓️ C | C2.2 | Mainnet txs linked from profiles; a real (tiny) hire completes on mainnet |
| C3.2 | **Agent Advantage Report** (TermiX track): ≥3 tasks run with-vs-without agent, measured time/cost/quality, ≥1 trading case; published as a doc + in-product page | ⛓️ C | C2.1 | Report exists with raw outputs attached; linked from submission form |
| C3.3 | PancakeSwap depth: grid on CAKE/USDT, LP-range rebalance demo on a real (tiny) position; yield scan across farms | ⛓️ C | C3.1 | Each PancakeSwap action has tx links; CAKE-track benefit paragraph in submission |
| B3.1 | Real-usage push: 10+ external users perform testnet hires; public metrics counters read from chain; uptime monitoring + alerts | 🔌 B | B2.1 | Counters show real numbers; zero-downtime through submission day |
| F3.1 | Final polish: Lighthouse ≥ 95 across pages, OG images, favicon/branding, error boundaries, mobile audit, 3-min demo video, submission form fields | 🎨 F | all | Public URL flawless on phone + laptop; video tells Nina story with real chain data; submission checklist 100% |

**Phase B exit gate (Sep 9, 23:59 UTC):** functional + publicly accessible; all four categories equally deep with live BSC agents; Advantage Report done; demo video recorded; intake form submitted with partner-track checkboxes ticked. From Sep 9 → 23: keep the deployment pristine (judging window + unknown Phase 2 — treat every visitor as a judge).

---

## Guardrails (both phases)

1. **Anti-over-engineering law (Phase A especially):** if a component doesn't appear on screen in the demo, it doesn't get built. No config systems for one value; no abstractions for one caller; no auth until Phase B minimal (wallet signature only).
2. **The mock seam:** all data access goes through `packages/sdk` client interfaces. Phase A implements them with fixtures; Phase B with Hono + chain. Pages never know which.
3. **Commit discipline:** conventional commits (`feat|fix|docs|chore:`), commit at every green AC, never leave main broken. Push before starting risky rewrites.
4. **Demo reliability beats feature count:** a boring screen that always works beats a magical one that flakes. Scripted fixture events power the live dashboard during demos.
5. **Timeboxing:** any task blocked > 90 min → stub it with the fallback (static data / simulated flow), log it in CLAUDE.md self-learning log, move on. The plan is designed so every stub has a graceful fallback.
6. **Docs stay truth:** any change to endpoints, env vars, contract addresses, or schema updates ERD.md / INTEGRATION.md in the same commit.

## Environment & accounts checklist (owner: Dylan)

- [ ] GitHub repo (private → public before Sep 9)
- [ ] Vercel project + domain (agentdesk.vercel.app; custom domain optional)
- [ ] Supabase project (Postgres) + connection string
- [ ] Railway app (Hono API + keeper worker)
- [ ] BSC testnet faucet funds (Chapel) + one mainnet wallet w/ small BNB + USD1
- [ ] 8004scan Pro API key (hackathon participant tier)
- [ ] Altana: SDK access, testnet faucet, workshop/office-hours dates
- [ ] TermiX: BSC MCP server access + Agent.family account
- [ ] AWS account for Agent Studio runtime (48h free trials — re-invoke on demand)
- [ ] Hackathon intake form submitted (Sep 9 latest — do it Sep 8, not Sep 9)
