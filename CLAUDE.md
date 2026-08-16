# CLAUDE.md — AgentDesk Operating Manual

> You are an agent working on **AgentDesk**, a hackathon project with a hard deadline and a clear definition of winning. This file is your context, your rules, and your memory. Read it fully before doing anything. **Update the logs at the bottom of this file at the end of every working session** — that's not optional; it's how this project compounds.

---

## 1. What this project is (30 seconds)

**AgentDesk** is the marketplace for BNB Chain's 200,000+ on-chain AI agents — where humans (and other agents) **discover, safely hire, and pay** trading agents whose track records are **verifiably real** (every trading decision pre-registered on-chain before execution; outcomes attested after; append-only forever).

- **Tagline:** *Proof, not promises.*
- **The prize we're playing for:** BNB Chain's **"Build the Era"** hackathon (submissions close **Sep 9, 2026**; judging Sep 9–23; winners Nov 5). Grand prize = the winner becomes **the official BNB Agent Studio Marketplace** — an adopted product with its own team. We are not participating to participate. We are building the one they adopt.
- **Milestone 1:** vibe-coding hackathon **Aug 20, 2026** — frontend prototype must be flawless by then.
- **Official page:** https://www.bnbchain.org/en/hackathons/smart-money-era

## 2. Non-negotiable context (judges score these)

1. **All four categories, equally deep:** Grid Trading · Rebalancing (LP ranges) · Yield Optimisation · Health-Factor Monitoring. Single-category submissions score poorly — this is official wording.
2. **Judging lens:** *"how easily someone can discover and hire an agent"* — with **zero Agent Studio knowledge** required from the end user. Functionality + Data Quality ("beyond basic counts") + Agent Diversity.
3. **Agents must be live on BSC**; submission must be functional and publicly accessible during the whole judging window (Sep 9–23).
4. **Partner tracks are additive prizes on the same build:** TermiX $10k (requires the **Agent Advantage Report**: ≥3 real tasks with-vs-without agent, measured, ≥1 trading case) · PancakeSwap 1,000 CAKE (real trader/LP benefit, funds never at risk beyond config) · Altana XP (session keys used for real txs, Keystore-registered, in-product revocation, `hireErc8183Agent`, x402/B402 selling).
5. **Winner DNA from past BNB hackathons** (full research in docs/PRD.md §13): live-on-chain demos not slides · deep official-stack usage (ERC-8004, ERC-8183, x402, MCP, PancakeSwap) · quantified claims · consumer-grade UX · safety framing. Past winners got MVB funding — the trajectory after the hackathon matters too.

## 3. The moat (never dilute it)

Every marketplace ranks agents by attention. **AgentDesk ranks them by proof.** The Proof Engine (append-only on-chain decision→outcome ledger, see docs/technical/SMART-CONTRACT.md) is the product's spine. Consequences:

- Never show an unverifiable number as if it were verified. Verified = computed from ProofLedger records only.
- Never add paid placement/ads to rankings (explicitly rejected — see PRD §11).
- Never build agent-token/bonding-curve launch mechanics (explicit non-goal).
- The leaderboard is a *view* of the chain, not editorial judgment.

## 4. Repo map & where truth lives

```
docs/PRD.md                  → what & why (product + research)
docs/BUILD-PLAN.md           → when & in what order (phases, lanes, acceptance criteria)
docs/PROTOTYPE-PROMPT.md     → the Lovable/AI-Studio master prompt (Milestone 1)
docs/technical/ARCHITECTURE.md → system shape (pnpm monorepo: apps/web Next15 · apps/api Hono · apps/keeper · packages/sdk · packages/contracts)
docs/technical/TECH-STACK.md → every choice + rationale (Next.js+TanStack Query · pnpm+Node22 · Hono · Drizzle+Supabase · viem/wagmi/RainbowKit · Foundry · Tailwind+shadcn)
docs/technical/INTEGRATION.md → every external system, env vars, addresses (living doc)
docs/technical/ERD.md        → data model + API↔table wiring (living doc — changes with every schema/endpoint commit)
docs/technical/SCREEN-DETAIL.md → every screen, component, state, microcopy
docs/technical/SMART-CONTRACT.md → ProofLedger design, security, testing
.claude/agents/              → custom subagents (captain, bnb-stack, proof-engine, polish)
.claude/skills/              → project skills (bnb-agent-stack, bsc-foundry)
```

**Priority when docs conflict:** ERD/INTEGRATION describe *current implementation*; PRD/BUILD-PLAN describe *intent*. If implementation drifts from ERD/INTEGRATION, either fix the code or fix the doc **in the same commit** — never let them diverge.

## 5. Commands (once scaffolded)

```bash
pnpm i                 # install all workspaces
pnpm dev               # web :3000 (apps/web)
pnpm --filter api dev  # api :4000 (Hono)
pnpm fixtures:validate # mock data conforms to packages/sdk schemas
pnpm test              # vitest (sdk + api logic)
pnpm e2e               # playwright: land→hire→dashboard→stop
pnpm --filter contracts forge:test        # ProofLedger tests + append-only invariants
pnpm --filter contracts forge:script:chapel  # deploy BSC testnet
```

(Until the scaffold exists, `docs/BUILD-PLAN.md` A0.1 is the first code task.)

## 6. Working rules

- **Acceptance criteria are the only move-gate.** A task in BUILD-PLAN.md is done when its AC passes — not when the code exists. Say which AC you satisfied in the commit message.
- **Conventional commits** (`feat:` `fix:` `docs:` `chore:`), commit at every green AC, never leave main broken. Small commits > big ones.
- **The mock seam is sacred:** pages consume `packages/sdk`'s `AgentDeskClient` interface only (fixture client ↔ http client). No component imports fixtures or fetches directly.
- **Code style:** TypeScript strict; Biome for lint/format; Tailwind + shadcn patterns; money through `<Money>/<Stat>/<Delta>` components only.
- **Timebox:** blocked > 90 minutes → implement the graceful fallback (DEMO_MODE / static data), log it in the Self-Learning Log, move on.
- **Env & secrets:** `.env.example` is the inventory; real env lives in Railway/Vercel; the only privileged secret we operate is `KEEPER_ATTESTER_KEY` (never in repo, never logged).
- **Windows dev box:** pnpm + Node 22 (no Bun runtime — native module risk); Forge + Hono work fine in Git Bash.

## 7. Glossary (use these terms precisely)

| Term | Meaning |
|---|---|
| ERC-8004 | Ethereum standard: on-chain AI-agent identity/reputation/validation registries. BSC hosts ~200k registered agents |
| 8004scan | AltLayer's ERC-8004 explorer + API (hackathon grants Pro tier free) |
| ERC-8183 | Agentic commerce standard: job escrow with evaluator attestation (hiring flow) |
| x402 / B402 | HTTP-402 pay-per-task protocol; settlement in USD1 stablecoin on BSC; Binance's variant = B402 |
| Altana | Agent wallet infra: scoped sessions (allowlist, spend cap, expiry), public Keystore, 1-tx revoke; ships 10 execution skills |
| TermiX / Agent.family | BNB's agent-to-agent marketplace + BSC MCP server; hackathon sponsor that will hire from our marketplace |
| ProofLedger | OUR contract: append-only decision→outcome ledger; source of all "verified" metrics |
| Proof Engine | The system around ProofLedger: runner pre-registration + keeper attestation + metrics derivation |
| Trust Panel | UI component rendering real session permissions as plain sentences |
| Nina test | Can a non-crypto person use this screen without learning an acronym? |

## 8. Session ritual (do this every session)

1. Skim `git log --oneline -10` + Current status below.
2. Check BUILD-PLAN for the current phase/task and its ACs.
3. Work in small verifiable steps; commit at green ACs.
4. **Before ending: append to both logs below** (dated, honest, short). Update "Current status" if the phase changed.

### Current status (update when it changes)

- **2026-08-16:** Docs foundation complete (PRD, BUILD-PLAN, technical set, prototype prompt). Skills installed (impeccable/taste-skill/emil-design-eng global; bnb-agent-stack + bsc-foundry + official bnbchain-mcp in `.claude/skills` and global). 4 custom agents in `.claude/agents`. **Graphify initialized** — knowledge graph in `graphify-out/` (gitignored, regenerable): 92 nodes / 210 edges / 7 communities; run `graphify --update` (or `/graphify . --update`) after doc changes. Next: BUILD-PLAN A0.1 scaffold + Lovable prototype from PROTOTYPE-PROMPT.md for Aug 20. Repo: private. Accounts checklist in BUILD-PLAN.md pending (Dylan).

---

## 9. 📓 SELF-LEARNING LOG (append-only — what worked, what failed, patterns)

> Format: `### YYYY-MM-DD — [session topic]` + bullets: **Worked:** / **Failed:** / **Pattern to reuse:**. Honest, technical, specific. Future sessions read this first.

### 2026-08-16 — Foundation & research session

- **Worked:** DuckDuckGo HTML (`duckduckgo.com/html/?q=`) via web reader as a reliable search fallback when WebSearch times out; fxtwitter/vxtwitter APIs for X content; cloning official repos (bnbchain-skills, Coinbase/x402) to ground integration docs in real package names instead of press-release claims.
- **Failed:** `bnbagent_sdk` repo name from press coverage 404s (underscore and hyphen both) — the SDK is reachable via the Agent Studio docs/MCP instead; parallel WebSearch batches timed out — sequential with fewer queries is more reliable under flaky network.
- **Pattern to reuse:** research → official page fetch → repo clone → write docs in this order gave high-confidence facts; always mark UNVERIFIED instead of guessing.

### 2026-08-16 — Skills, agents, graphify initialization

- **Worked:** official `bnb-chain/bnbchain-skills` clone gave the real MCP skill (`npx @bnb-chain/mcp@latest`) — installing from source beats transcribing press coverage; Coinbase/x402 clone confirmed package names (`@x402/core`, `@x402/extensions`, `@x402/mcp`). Graphify pipeline (uv tool → detect → 1 semantic subagent → build → label → export) completed on 17 docs: 92 nodes, 210 edges, 7 communities, HTML + graph.json + GRAPH_REPORT.md in `graphify-out/`.
- **Failed:** subagent infrastructure intermittently returned "captcha verify failed" / inactive-timeout earlier in the day — retrying later worked; when subagents fail, sequential WebSearch/web_reader by the host is the fallback. `python -m graphify.cli export html` silently did nothing — use the `graphify.exe` binary from the uv tool dir instead.
- **Pattern to reuse:** keep `graphify-out/` gitignored and regenerate with `--update`; version warning "skill 0.9.29 vs package 0.9.44" is harmless (`graphify install` can sync later). Graph god-nodes = CLAUDE.md, bnb-agent-stack skill, SCREEN-DETAIL, ProofLedger — exactly the docs future sessions must read first.

## 10. 💡 SELF-INSIGHT LOG (append-only — strategy, product, meta-observations)

> Format: `### YYYY-MM-DD — [insight title]` + 2–4 sentences. These are *strategic* lessons that should change future decisions, not task notes. Review before every phase gate.

### 2026-08-16 — The hackathon IS the product spec

"Build the Era" is unusual: BNB published exactly what they want (4 categories, judging criteria, partner requirements, even the "zero Agent Studio knowledge" bar). Winning here is closer to *executing a spec excellently* than guessing a winning idea. Corollary: when a decision is ambiguous, re-read the official page before brainstorming — the answer is usually already there.

### 2026-08-16 — Trust is the UI, not a feature

The recurring insight across every competitor analysis: marketplaces fail on unverifiable quality, and "policy compliance" features are table stakes *until they're made legible at the moment of decision*. The Trust Panel (permissions as sentences + one-tap stop) converts a checkbox feature into the product's emotional core. Design rule derived: every trust mechanism must be *visible at the moment of risk*, not buried in settings.

### 2026-08-16 — Rejection is strategy

Saying no (no ads, no token launchpad, no custom escrow) defined the product as much as what we're building. Each rejection maps to a judged criterion or a competitor's known failure mode. Keep the rejection list in PRD §7 authoritative.
