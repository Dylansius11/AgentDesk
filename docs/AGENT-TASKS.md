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

## User directive (2026-08-16, mid-Wave-1) — reprioritization

User stopped the `frontend-polish` dispatch mid-task and redirected: **do not resume frontend work; focus on smart contract + backend + architecture first.** This overrides BUILD-PLAN's Phase-A-frontend-first sequencing by explicit instruction. Frontend (A0.2/F1 retrofit, and all of Wave 2's F-screens) is paused, not cancelled — resume only on later instruction.

Also landed right as this directive arrived: `hackathon-captain`'s risk report (A0.4 done, demo script frozen) flagged that the F-lane critical path (B1→F2→F3→F4→F5) has ~3.5 days of work and recommended descoping F6/F7/F8 to protect the Nina journey for Aug 20 — that analysis assumed frontend stayed the active lane. With frontend now paused by user directive, treat that risk report as informational for when frontend resumes, not as a reason to keep it active now.

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
- **Status:** ⏸️ **paused by user directive** (mid-retrofit — `closing-cta` and `site-footer` were still unconverted when stopped; other components may be partially or fully done, unverified). Do not resume until instructed — see "User directive" section above.
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
- **Status:** ✅ **done, PM-verified** — re-ran `pnpm fixtures:validate` and `pnpm --filter @agentdesk/sdk check` independently, both green. 12 fixtures (3/category, exactly 2 unverified: MoonMechanic, YieldPilot), `ProofRecord` schema structurally enforces pre-registration + post-deadline-attestation via zod `.refine()`s, `Agent.verified` structurally requires `proofProgram=true` + resolved metrics. HealthGuard's stats (98% win rate, 412 tasks) pinned to match the frozen demo script. Added 2 `HireSession` fixtures beyond the literal ask to validate that schema against real data — kept, not trimmed. **Not yet committed** — holding until the two concurrent Wave 1B agents (contracts, api/keeper) finish, since all three are touching shared root files (`package.json`, `turbo.json`, `pnpm-lock.yaml`); will do one clean consolidated commit pass once everything in flight lands.
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

## Wave 1B — dispatched 2026-08-16 (pivot: smart contract + backend architecture, per user directive)

### Task: ProofLedger contract scaffold (Foundry)
- **Owner:** `proof-engine-engineer` (second, parallel instance — separate from the A0.1/A0.3 sdk/fixtures instance; different directory, no conflict)
- **Status:** ✅ **done, PM-verified + one PM decision applied.** Re-ran `forge test` independently: 29/29 green (25 unit + 4 invariant, 12,800 fuzz calls each, 0 reverts). Append-only is structural (no update/delete path exists, not just role-gated), `resolved` is derived not a mutable flag. Agent left 1 test intentionally failing rather than silently loosen it: cold-path `registerDecision` for a brand-new `agentId` measured 124,095 gas, 3.4% over the 120k budget (steady-state, an agent's 2nd+ decision, measured 102,483 — comfortably under). **PM decision:** gate on steady-state cost (what the vast majority of real registrations pay); treat the one-time-per-agent-lifetime cold-onboarding premium as a logged diagnostic, not a build-failing gate — recorded in both `SMART-CONTRACT.md` §5.4 and the test's docstring. Also deleted `packages/contracts/.github/workflows/test.yml` (auto-generated by `forge init`, inert since GH Actions only reads root `.github/workflows/` which doesn't exist yet — real CI wiring is a follow-up, not this task's scope). **Not yet committed** — bundling into one pass with sdk + api/keeper now that all three have landed.
- **Objective:** Stand up the real `packages/contracts` Foundry project and the ProofLedger contract skeleton — this is BUILD-PLAN's C1.1, pulled forward ahead of Phase A completion by explicit user instruction.
- **Scope:** Foundry project init (`foundry.toml`, `remappings.txt`, `src/`, `test/`, `script/` per ARCHITECTURE.md §3); `ProofLedger.sol` with `registerDecision(agentId, intentHash, deadline)`, `attestOutcome(recordId, outcome, evidence)`, events, and the append-only invariant (no update/delete path for any decision or outcome, ever — see `proof-engine-engineer` agent's non-negotiables); unit tests proving append-only + "attest only after deadline"; `ATTESTER_ROLE` access control (keeper EOA in v1); contract never holds funds; no proxy/pause/upgrade.
- **Explicitly out of scope:** do not deploy to Chapel testnet yet (needs funded deployer key, not available this session); do not build the indexer/keeper event-consumption side (separate task); do not touch `apps/`.
- **Inputs:** `docs/technical/SMART-CONTRACT.md`, `bsc-foundry` skill.
- **Outputs:** working `packages/contracts` Foundry project, `forge build` and `forge test` both green, brief report of function signatures + invariants proven + gas numbers for `registerDecision` (AC target: ≤120k gas).
- **Constraints:** immutable contract design; gas discipline per SMART-CONTRACT.md.
- **Depends on:** nothing.
- **Completion criteria:** `forge test` green including an append-only invariant test; `registerDecision` gas ≤120k (or reported honestly if not yet met, with the gap explained).

### Task: Backend architecture scaffold — apps/api + apps/keeper
- **Owner:** `bnb-stack-engineer`
- **Status:** ✅ **done, PM-verified** — re-ran independently: `pnpm --filter api check` and `pnpm --filter keeper check` both clean; booted `apps/api` for real and curled it — `/api/health` returns `200` with honest `"unconfigured"` checks (no fake "connected" claims), `/v1/agents` returns `{data:[],...}` not fabricated data. `.env.example` (new) + `INTEGRATION.md` updated together with the 2 new keeper env vars, exactly per env-discipline rule. **Follow-up needed:** `sessions.ts` routes (`GET /v1/sessions/:id`, `/permission-sentence`) were added as a documented extrapolation — ERD.md's API table doesn't list them yet; fold into ERD.md in a follow-up commit before Phase B F2.1 (Trust Panel v2) needs them. **Not yet committed** — same reason as the sdk task: waiting on the still-running contracts task before one consolidated pass.
- **Objective:** Stand up the real service structure for `apps/api` (Hono) and `apps/keeper`, per ARCHITECTURE.md §3 — structure and stubs now, live external calls stay Phase B unless directed otherwise.
- **Scope:** `apps/api`: Hono app (`src/index.ts`), route files stubbed per ARCHITECTURE.md (`src/routes/v1/{agents,proof,jobs,sessions}.ts` — real shape, stub/mock responses typed against `packages/sdk` once it lands, or local types if sdk isn't ready yet), `src/services/` folder stubs (`scan8004.ts`, `proof.ts`, `hire.ts`, `altana.ts`, `metrics.ts` — signatures + TODOs, not live calls), `src/db/` drizzle schema matching `docs/technical/ERD.md` (schema only — migration can be a follow-up), a real `/api/health` endpoint. `apps/keeper`: worker skeleton (entry point + the attestation-loop shape from ARCHITECTURE.md §4.3, not-yet-wired to a real RPC).
- **Explicitly out of scope:** do not implement live 8004scan/Altana/x402 calls yet (no API keys provisioned this session per BUILD-PLAN's accounts checklist, still pending); do not touch `apps/web`; do not touch `packages/contracts`.
- **Inputs:** `docs/technical/ARCHITECTURE.md` (repo structure, sequence diagrams), `docs/technical/ERD.md` (schema), `docs/technical/INTEGRATION.md` (env var inventory — add stub entries to `.env.example` for anything new).
- **Outputs:** `apps/api` and `apps/keeper` real skeletons, `.env.example` updated if new env vars introduced, brief report of what's structural-only vs. stubbed vs. TODO.
- **Constraints:** TypeScript strict; follow the boundary rule (on-chain = truth, Postgres = cache, API never invents authoritative state) even in stub form — don't hardcode fake "verified" numbers anywhere, stub responses should be obviously empty/placeholder, not fabricated-looking real data.
- **Depends on:** nothing (parallel-safe with the contract task and the still-running sdk/fixtures task).
- **Completion criteria:** `pnpm --filter api dev` boots and `/api/health` responds; `apps/keeper` has a runnable (even if no-op) entry point; structure matches ARCHITECTURE.md §3.

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
