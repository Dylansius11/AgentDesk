# AgentDesk — Tech Stack Decisions

| | |
|---|---|
| **Version** | 1.0 · 2026-08-16 |
| **Principle** | Every choice optimized for three things, in order: **(1) speed to a flawless demo, (2) how well AI coding tools (Claude/Lovable/v0) generate for it, (3) judge-perceived modernity.** Never novelty for its own sake. |

---

## 1. The stack at a glance

| Layer | Choice | Version pin |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo (build cache only) | pnpm ≥ 9 |
| Language | TypeScript everywhere (strict) | TS 5.x |
| **Frontend** | **Next.js (App Router) + React Server Components** | Next 15.x |
| Client data | TanStack Query v5 | — |
| Client state | Zustand (hire wizard + dashboard locals only) | — |
| Styling | Tailwind CSS v4 + shadcn/ui + CSS variables for tokens | — |
| Charts | TradingView **lightweight-charts** (equity curves) + Recharts (stats) | — |
| Wallet | wagmi + viem + RainbowKit (Binance Wallet & Trust connectors first) | — |
| **Backend** | **Hono** on Node 22 (Fastify-style perf, TS-first) | Hono 4.x |
| ORM | Drizzle ORM + drizzle-kit migrations | — |
| DB | Supabase Postgres | — |
| Validation | Zod v4 (shared in `packages/sdk`) | — |
| Realtime | SSE (Hono stream) | — |
| **Contracts** | Solidity via **Foundry**; artifacts consumed through viem | forge latest |
| Testing | Vitest (unit) + Playwright (e2e smoke: hire journey) + `forge test` | — |
| Lint/format | Biome (one tool, fast, zero-config drift) | — |
| Deploy | Vercel (web) · Railway (api+keeper) · BSC Chapel→mainnet | — |

---

## 2. The decisions, argued

### 2.1 Frontend framework: **Next.js 15 App Router** (not TanStack Start/Router)

| Criterion | Next.js | TanStack Start |
|---|---|---|
| AI-tool codegen quality (Lovable, v0, Claude, Cursor) | ★★★★★ — every model is saturated with Next patterns | ★★☆ — thin training data; constant corrections |
| RSC/SEO for landing + marketplace pages | ★★★★★ | ★★★☆ (client-first) |
| Deploy friction | ★★★★★ Vercel zero-config | ★★★☆ |
| Type-safe routing | ★★★ (typed routes experimental) | ★★★★★ (its best feature) |

**Verdict:** In a vibe-coding hackathon, the framework your AI tools write *correctly* is worth more than any architectural elegance. TanStack Router's type-safety is real, but we get 90% of it via zod-validated routes in `packages/sdk` + typed API client. Next.js wins on generator quality, RSC for the marketing surfaces judges land on, and one-command Vercel deploys.
**Used from TanStack:** TanStack **Query** — non-negotiable, it *is* our client cache layer (dedupe, background refetch, optimistic updates in the hire flow).

### 2.2 Package manager & runtime: **pnpm + Node 22 LTS** (not Bun)

- Bun's runtime on **Windows** (our dev machine) still bites on native modules (foundry-related tooling, sharp, pino transports). Speed gains are irrelevant against a 3-week deadline; reliability is not.
- pnpm workspaces are the monorepo default: strict, disk-efficient, flawless on Windows, and every AI tool knows the lockfile.
- **Bun remains approved** as a script runner (`bun run` for speed) if desired — but installs/lockfile/runtime stay pnpm + Node 22. Hono runs identically on Node, so no lock-in.

### 2.3 Backend: **Hono** (not Express / Fastify / NestJS / tRPC)

- **Express:** legacy middleware patterns; judges read "2021."
- **NestJS:** DI ceremony is anti-vibe-coding; AI tools over-scaffold it.
- **tRPC:** lovely for one web client, but our API must also serve **agent clients** (machines, TermiX mesh) — plain REST + OpenAPI beats a coupled-RPC contract.
- **Hono:** TS-first, tiny, blazing, first-class SSE streaming, runs anywhere, zod-validator middleware straight into OpenAPI spec generation, and AI models generate clean Hono code. Perfect middleware position.

### 2.4 ORM/DB: **Drizzle + Supabase Postgres** (not Prisma / raw SQL)

- Prisma's engine binary + migration story adds friction on Windows + Railway; Drizzle is pure TS, SQL-shaped, migration files are readable SQL (easy to keep ERD.md in sync — a stated requirement).
- Supabase = Postgres **plus** connection pooling, realtime, and a polished dashboard for debugging during judging week; supabase skills are already installed in our toolchain.

### 2.5 Web3: **viem + wagmi + RainbowKit** (not ethers/web3.js)

- viem is the modern default (typed contract reads/writes straight from Foundry artifacts; tree-shakeable); wagmi gives React hooks (signMessage for session grants, useWriteContract for escrow); RainbowKit handles the Binance Wallet / Trust / MetaMask connectors + BSC chain switching with the least custom CSS. Wagmi also future-proofs account-abstraction flows (ERC-7702 on BSC) without a rewrite.

### 2.6 Contracts tooling: **Foundry** (not Hardhat)

- Faster tests, Solidity-native fuzz/invariant tests (we *need* invariant tests proving ProofLedger append-only), forge script deploys straight to Chapel. viem consumes ABI artifacts directly.

### 2.7 UI system: **Tailwind v4 + shadcn/ui** — with the design-skill chain

- shadcn = copy-in components we own; pairs with the installed skills (**impeccable**, **taste-skill**, **emil-design-eng**) which all target this stack.
- Design direction: **dark-first** (near-black `#0B0E11` canvas, BNB gold `#F0B90B` accents, semantic green/red for money), Inter/Geist for UI + a tabular-mono for numbers (P&L alignment), generous spacing, glass-surface cards. Trust product ⇒ calm, precise, zero neon casino vibes. Motion: subtle — 150–250ms ease-out, count-ups, chart draw-ins (emil-skill patterns), `prefers-reduced-motion` respected.

### 2.8 Charts: **lightweight-charts** (equity curves — looks like a real trading terminal, which subconsciously signals "this is a serious trading product") + Recharts for simple bars/stats. Sparklines: hand-rolled SVG paths.

### 2.9 Testing & CI (kept proportionate)

- `forge test` (contracts incl. invariants) · Vitest for sdk/api pure logic (metrics math must be tested — it's our moat) · one Playwright e2e: the Nina journey (land→hire→dashboard→stop).
- CI (GitHub Actions): typecheck + biome + vitest + forge on PRs. That's all. No k8s, no microservices, no storybook in a 3-week hackathon.

### 2.10 Rejected-for-now (with trigger conditions to revisit)

| Tech | Why not now | Revisit when |
|---|---|---|
| Bun runtime | Windows native-module risk | Phase B ends / CI on Linux only |
| tRPC | Machine clients need REST | Never, likely |
| GraphQL | Query flexibility we don't need; REST + zod is enough | Agent mesh demands complex queries |
| The Graph / subgraphs | One contract, 3 events — keeper polling is simpler | ≥5 contracts or heavy event volume |
| Next API routes for core API | SSE + long loops need always-on process | — (keep only /api/health) |
| Redis | Single-instance Postgres + in-memory cache suffice | Multi-instance api |

## 3. Frontend engineering standards (the key part — this wins demos)

1. **Route map** mirrors SCREEN-DETAIL.md exactly; marketing = static RSC, app = client islands. No heavy client bundle on landing.
2. **Money and numbers:** every monetary/stat display goes through `<Money>`, `<Stat>`, `<Delta>` components — tabular numerals, consistent decimals (USD1 → 2dp, tokens → symbol-aware), signed green/red. Numbers are our UI's protagonist.
3. **Loading is UX:** skeletons shaped like content (not spinners); charts draw-in; feed rows slide in; the dashboard must *feel alive* even on cached data.
4. **Trust affordances:** verified badge = shield icon + "Verified" text (never icon-only); every stat has a plain-language tooltip; every on-chain claim has an external-link affordance (BscScan/8004scan).
5. **A11y floor:** semantic landmarks, focus rings, aria-labels on icon buttons, contrast AA on dark.
6. **Perf budgets enforced:** Lighthouse ≥ 95 on landing/browse; images `next/image`; only two Google-font weights; charts lazy-loaded per profile.
7. **DEMO_MODE:** env-flagged fixture fallback so the demo *cannot* die from an RPC outage mid-judging.
