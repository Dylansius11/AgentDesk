# AgentDesk — Agent Task Board (Auto-Mode Orchestration)

| | |
|---|---|
| **Owner** | Main Agent / PM (this file is maintained by the orchestrator only) |
| **Purpose** | Live dispatch board: what's actually built vs. claimed, who owns each open task, and the handoff brief each specialist agent works from. `docs/BUILD-PLAN.md` stays the source of truth for task IDs/ACs/timeline — this file is the *operational* layer on top of it: status reality-check + agent assignment + handoff protocol. |
| **Last updated** | 2026-08-16 |
| **Specialist agents** | `hackathon-captain` (planning/scope/deadlines) · `bnb-stack-engineer` (ERC-8004/8183, x402, Altana, 8004scan, PancakeSwap/Venus reads) · `proof-engine-engineer` (ProofLedger, indexer/keeper, metrics, `packages/sdk` proof-domain schemas) · `frontend-polish` (Next.js app, design system, motion, Nina test) |

---

## Protocol

1. **This is the only file agents should treat as their live queue.** BUILD-PLAN.md defines *what "done" means* (ACs); this file defines *who's doing it right now and with what brief*.
2. Specialist agents execute only their assigned task(s), **do not commit** (write/edit files only) — the PM reviews diffs and commits so parallel dispatches never race on git state — and report back a structured summary: files touched, which AC(s) are satisfied, what's still open, anything blocked >90min (per BUILD-PLAN guardrail 5).
3. Specialist agents **do not reassign or dispatch other agents.** If a task reveals work outside their lane, they report it back here as a proposed new row; the PM decides ownership.
4. PM (main agent) reviews each report, commits if green, updates this board's status column, updates CLAUDE.md's Current Status + logs, and decides the next dispatch wave respecting the BUILD-PLAN dependency graph.

---

## Reality check (2026-08-16, gathered before first dispatch)

CLAUDE.md's status line said scaffold + skills were the "next" step; actual repo inspection shows more — and less — than that:

- ✅ **A0.1 (partial):** `apps/web` scaffold real (Next 15.5.23 + TS + Tailwind v4, `pnpm dev` boots). `apps/api`, `apps/keeper`, `packages/contracts` are **README-only stubs** — no code. `packages/sdk` is **README-only** — the zod schemas/types A0.1 calls for don't exist yet.
- ❌ **A0.2 (design tokens): not done.** No tokens file, no `/style` route, no shadcn/ui installed. `globals.css` still has the Next.js starter's light theme (`#ffffff`/`#171717`).
- ⚠️ **F1 (Landing): built out of order, off-spec.** All landing sections exist and are wired into `app/page.tsx` (hero, live counters, category scroll, proof band, how-it-works, closing CTA, footer) — real structural work, not a stub. But every section uses CSS Modules with **raw hex values** (`#000000`, `#ffffff`, `#f4f4f6`) in a **light palette**, violating both A0.2's AC ("no raw hex values in components") and the frontend-polish design law (near-black `#0B0E11` canvas, BNB gold `#F0B90B` reserved for verification/primary actions). This happened because F1 shipped before A0.2 existed — exactly the dependency the BUILD-PLAN graph warns about (`A0.2 → F1`).
- ❌ **A0.3 (mock fixtures):** not started — blocked on packages/sdk schemas existing first.
- ❌ **A0.4 (demo script):** `docs/demo-script.md` does not exist.
- Skills/MCP infra (separate from BUILD-PLAN): now genuinely installed — `bnbchain-mcp` + 8 `pancakeswap-ai` skills via `npx skills add`, MCP server registered read-only in `.mcp.json`. Logged in CLAUDE.md already.

**Net:** Phase A is further along on raw screen-building than the plan assumed, but the *foundation* tasks (A0.2 tokens, A0.3 schemas/fixtures, A0.4 demo script) that everything else depends on are the actual gap, and F1 needs a retrofit pass once tokens exist. 4 days to the Aug 20 exit gate.

---

## Wave 1 — dispatched 2026-08-16 (parallel, no interdependency)

### Task: A0.2 + F1 retrofit — design tokens & de-raw-hex pass
- **Owner:** `frontend-polish`
- **Status:** 🔴 stopped by user (mid-retrofit — `closing-cta` and `site-footer` were still unconverted when stopped; other components may be partially or fully done, unverified). Awaiting instruction before resuming.
- **Objective:** Establish the real AgentDesk design tokens and bring the already-built F1 landing page into spec, since it was built before tokens existed.
- **Scope:** (1) Create the tokens file per TECH-STACK.md §3 / frontend-polish design law: near-black `#0B0E11` canvas, BNB gold `#F0B90B` reserved for verification + primary actions only, semantic green/red for money, Inter + tabular mono for numbers, spacing/radius/elevation scale. (2) Add a `/style` route rendering the palette + type specimen. (3) Retrofit `app/globals.css` and all 7 `components/landing/*` files to consume tokens — zero raw hex remaining. (4) Confirm dark-mode-as-default per SCREEN-DETAIL/TECH-STACK.
- **Explicitly out of scope:** do not build F2–F6 screens; do not touch `packages/sdk`, `apps/api`, `apps/keeper`, `packages/contracts`, or `docs/demo-script.md`.
- **Inputs:** `docs/technical/TECH-STACK.md` §3, `docs/technical/SCREEN-DETAIL.md`, current `apps/web/components/landing/*`, current `apps/web/app/globals.css`.
- **Outputs:** tokens file, `/style` route, retrofitted landing components/CSS modules, brief report of before/after (raw-hex count before → 0 after).
- **Constraints:** TypeScript strict; no component may hold a raw hex value; shadcn/ui may be initialized if it helps but is not required to satisfy the AC.
- **Depends on:** nothing (parallel-safe with the other two Wave 1 tasks).
- **Completion criteria (= BUILD-PLAN A0.2 AC):** tokens file exists; `/style` renders palette + type specimen; `grep -rE '#[0-9a-fA-F]{3,6}'` over `apps/web/components` and `apps/web/app` returns nothing.

### Task: A0.1 (sdk portion) + A0.3 — packages/sdk schemas & mock fixtures
- **Owner:** `proof-engine-engineer`
- **Status:** 🟡 dispatched
- **Objective:** Stand up `packages/sdk` (zod schemas + TS types) and the 12-agent fixture set everything else (mock API, F2–F6) will consume.
- **Scope:** (1) Zod schemas + inferred TS types for `Agent`, `ProofRecord`, `HireSession`, `Category` — `ProofRecord`'s shape must respect the append-only/pre-registration semantics from `docs/technical/SMART-CONTRACT.md` (decision timestamp < execution timestamp fields, intentHash/evidenceHash present) since this schema is the moat object and gets frozen early. (2) 12 mock agent fixtures, 3 per category (Grid Trading, Rebalancing, Yield Optimisation, Health-Factor Monitoring) with believable proof records, equity curves, trust panels, pricing; exactly 2 marked unverified to exercise the badge contrast. (3) Wire a `fixtures:validate` script (root `pnpm fixtures:validate` per CLAUDE.md §5) that validates every fixture against the schemas and fails loudly on drift.
- **Explicitly out of scope:** do not build the mock API client (`B1` — separate task, depends on this one); do not touch landing/design work; do not touch contracts.
- **Inputs:** `docs/PRD.md` (categories, agent examples incl. HealthGuard/GridGoblin/YieldShepherd/RangeRanger), `docs/technical/ERD.md` (field-level shapes), `docs/technical/SMART-CONTRACT.md` (ProofRecord semantics).
- **Outputs:** `packages/sdk/src/schemas/*`, `packages/sdk/src/fixtures/*`, working `fixtures:validate` script, brief report of schema decisions + fixture roster (12 names/categories/verified status).
- **Constraints:** TypeScript strict; no hand-waved fields — every fixture must satisfy its zod schema; this package is the mock seam per CLAUDE.md §6, so shape it as the interface Phase B's real client will also implement (don't design something a Hono/8004scan-backed client couldn't later fulfill).
- **Depends on:** nothing (parallel-safe).
- **Completion criteria (= BUILD-PLAN A0.1 sdk-portion + A0.3 AC):** `pnpm fixtures:validate` passes; 12 fixtures typed by the schemas, 2 unverified.

### Task: A0.4 demo script + Phase A reality/risk report
- **Owner:** `hackathon-captain`
- **Status:** 🟡 dispatched
- **Objective:** Freeze the demo story and give an honest schedule-risk read now that real ground truth (above) is known, 4 days out from the Aug 20 exit gate.
- **Scope:** (1) Write `docs/demo-script.md` — one paragraph, Nina hires HealthGuard, per PRD §5.1. (2) Produce a short risk report: given A0.2/A0.3/A0.4 were the actual gap (not "next" as CLAUDE.md implied) and F1 needs a retrofit pass, is the Aug 20 exit gate still realistic on the current trajectory? Name the smallest descope that protects the Nina journey (land → hire → dashboard → stop) if not.
- **Explicitly out of scope:** do not write code; do not edit BUILD-PLAN.md task definitions (flag proposed changes back to PM instead).
- **Inputs:** `docs/PRD.md` §5.1, `docs/BUILD-PLAN.md`, the Reality check section above.
- **Outputs:** `docs/demo-script.md`, a short risk report returned in the agent's final response (not a file — PM will fold it into CLAUDE.md's log).
- **Constraints:** one paragraph for the script — this is a freeze, not a draft-for-review; honesty over optimism on the risk read.
- **Depends on:** nothing (parallel-safe).
- **Completion criteria (= BUILD-PLAN A0.4 AC):** `docs/demo-script.md` exists, one paragraph, committed-ready.

---

## Queued (Wave 2 — dispatch once Wave 1 lands)

| ID | Task | Proposed owner | Depends on |
|---|---|---|---|
| B1 | Mock API client (`getAgents`, `getAgent`, `getProofRecords`, `hire`, `revoke`, `getDashboard`) w/ artificial latency + SSE-ish dashboard stream | `bnb-stack-engineer` (owns the `AgentDeskClient` mock-seam contract that Phase B's real client will replace) | A0.3 |
| F2 | Marketplace browse screen | `frontend-polish` | F1 retrofit, A0.3 |
| F3 | Agent profile screen | `frontend-polish` | F2 |
| F4 | Hire flow | `frontend-polish` | F3 |
| F5 | Dashboard | `frontend-polish` | F4 |
| F6 | Leaderboard | `frontend-polish` | F2 |

Not yet dispatched — Phase B tasks (C1.1 ProofLedger, C1.2 demo agents, etc.) stay backlog until Phase A's exit gate per BUILD-PLAN guardrail 1 (anti-over-engineering law).

---

## Backlog / unresolved ownership questions for the user

- No specialist agent cleanly owns generic non-chain, non-proof, non-frontend backend scaffolding (e.g. `apps/api` Hono skeleton, `apps/keeper` skeleton) when it's pure plumbing rather than chain-integration or proof-metrics logic. For Phase A these are stubs only (out of scope until Phase B per BUILD-PLAN), so no action needed yet — flagging so Phase B dispatch doesn't stall on "whose job is this."
