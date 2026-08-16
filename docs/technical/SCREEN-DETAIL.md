# AgentDesk — Screen Detail & UX Specification

| | |
|---|---|
| **Version** | 1.0 · 2026-08-16 |
| **Companion** | This is the source of truth for every route in `apps/web/app/**`. DESIGN RULE: every screen must pass the **Nina test** — a non-crypto person can use it without learning a single acronym. |
| **Design language** | Dark-first (`#0B0E11` canvas, `#F0B90B` BNB-gold accent, `#22C55E`/`#EF4444` money semantics), Inter/Geist + tabular mono for numbers, glass cards, 1px hairline borders `rgba(240,185,11,0.15)`, calm motion 150–250ms. It should feel like a Swiss trading terminal, not a casino. |

---

## S0 · Global elements

| Element | Spec |
|---|---|
| **Nav** (sticky, blur) | Logo · Marketplace · Leaderboard · Verify · [How it works] · spacer · network chip (BSC/Mainnet↔Testnet) · Connect wallet (RainbowKit; order: Binance Wallet → Trust → MetaMask). Nav collapses to bottom tab bar on mobile (Market · Board · Dashboard). |
| **Footer** | 4 columns (Product / For developers / Verification links / Hackathon credits: "Built for BNB Chain — Build the Era"). Includes live status chip (API/data freshness) — honesty as a feature. |
| **Toasts** | Money events = persistent until dismissed, with tx link; errors = actionable sentence + retry. Never a naked "Something went wrong." |
| **Empty states** | Illustration + one-line explanation + one CTA. Example (no agents in filter): "No verified grid agents yet — they arrive when their first proof lands. Browse all agents →" |
| **Number rendering** | All through `<Money>`/`<Stat>`/`<Delta>`: tabular mono, USD1 2dp, signed green/red, thousands separators; sparkline SVGs on cards. |
| **Trust badge** | Shield+check + "Verified" text (never icon-only); tooltip: "Every stat is computed from on-chain pre-registered decisions — audit it yourself ↗". |

---

## S1 · Landing `/`

**Purpose:** in 10 seconds a visitor knows what this is, believes it's different (proof), and clicks into a category.

| Section | Content & behavior |
|---|---|
| Hero | H1: **"Hire trading agents that can prove their P&L."** · Sub: "AgentDesk is the marketplace for BNB Chain's 200,000+ on-chain agents. Every track record verifiable. Every hire capped. Every agent revocable in one tap." · Dual CTA: [Browse agents] [How proof works ▷ 60s] · Background: subtle animated proof-chain motif (hash→tx→check) — decorative, GPU-light. |
| Live counters | 3 count-up stats from `GET /v1/stats`: agents verified · tasks proven · verified P&L (USD1). Freshness chip: "live from BSC". |
| Four categories | 2×2 cards, Nina-language: **Grid Trading** ("Buys the dip, sells the rip — automatically") · **Rebalancing** ("Keeps your liquidity in the profitable range") · **Yield** ("Moves funds to where APY actually is") · **Health Guard** ("Stops your loan from getting liquidated"). Each card → `/?category=` browse with 1 verified example agent rendered inside the card. |
| Proof vs promises | Split band: left "Everywhere else: ★ 4.8, screenshots, trust me bro" (struck-through, grey) vs right "AgentDesk: intent registered on-chain *before* the trade → outcome attested after → append-only forever" with 3-step mini-diagram. This is the differentiator section; make it sing. |
| How it works | 3 steps with Nina-journey screenshots: Pick → Set limits → Hire (60s). Caption: "You never hand over your wallet." |
| Bottom CTA | "The next agent you hire should be able to prove itself. [Browse verified agents →]" |

**AC:** Lighthouse ≥ 95; counters animate once on view; CTA→browse in 1 click.

---

## S2 · Marketplace `/marketplace`

**Purpose:** category-first discovery; verified-first ranking; zero jargon.

- **Header row:** H2 changes with category ("Grid agents" etc.) + result count + `Verified only` toggle (default ON).
- **Filters (collapsible "Filters" on mobile):** category tabs (All · Grid · Rebalance · Yield · Health) · risk (Low/Med/High) · price band per task · protocol chips (PancakeSwap, Venus, Aave, Lista).
- **Sort:** Verified return (default) · Win rate · Tasks proven · Response time · Newest.
- **Agent card** (the atomic unit — reused on landing & leaderboard):

```
┌────────────────────────────────────────────────┐
│ ◉ GridGoblin            [🛡 Verified]  ⋯       │
│ "Grids CAKE/USDT while you sleep"              │
│ ▁▂▄▃▅▆▇█ sparkline (verified P&L curve)        │
│ +31.4% 30d   82% wins   1,204 tasks   ~4m resp │
│ Risk: Medium · Executes on PancakeSwap         │
│ from $0.80 / task                    [Hire ▸]  │
└────────────────────────────────────────────────┘
```

- Unverified agents (toggle off): greyed badge "No proof yet", sorted below verified, no stats row (honesty: "unproven" ≠ "bad").
- **Data:** `GET /v1/agents` (agents ⨝ listings ⨝ proof_metrics) + 60s cache; skeleton cards shaped exactly like content.

**AC:** filters/sort all functional; verified/unverified visually distinct; every stat tooltips to plain-language definition; card → profile in 1 click.

---

## S3 · Agent profile `/agent/[id]` — **the conversion screen**

**Purpose:** in 90 seconds a user decides this agent is trustworthy *and* understands exactly what it would be allowed to do. This screen *is* the product.

| Block | Spec |
|---|---|
| Header | Avatar, name, tagline, category chip, 🛡 Verified badge (or grey), ERC-8004 ID chip (copy + 8004scan ↗ + BscScan ↗), developer card (claimed ✓, address, other agents). |
| **Verified Track Record** (tab 1, default) | (a) **Equity curve** — lightweight-charts area chart of cumulative verified P&L (USD1), timeframe toggle 7d/30d/all; drawdown shading; (b) **Stats grid** — verified return, win rate, max drawdown, tasks proven, avg response, category stat (e.g., Health: "3 liquidations saved"); every cell has plain-language tooltip; (c) **Proof stream** — reverse-chron rows: `#recordId · intent (plain English: "Buy CAKE if ≤ $2.10") · registered ⏱ 14:02:11 → executed 14:02:47 · outcome +$1.20 ✓ · tx ↗ · evidence ↗` — expanding a row shows intentHash/deadline/evidenceHash (the "aha" for technical judges). |
| **Trust Panel** (tab 2) | Rendered from real session config: "This agent can: trade CAKE/USDT on PancakeSwap · nothing else" / "Spend cap: $50 per day" / "Access expires: Friday 18:00" / "You can stop it: instantly — one tap" + revoke demo link. Config-key → sentence renderer is a shared util (`permissionSentence()`), unit-tested. |
| **How it works** (tab 3) | 3-step visual: escrow → pre-registered decisions → attested outcomes; fee transparency: "Task price $X + 3% protocol fee. You pay only on completed tasks." |
| Pricing card (sticky right, desktop) | Price/task, suggested caps (from `listings.default_caps`), [Hire — 60s ▸] primary; secondary: [Add to watchlist] [View raw proof]. |
| Empty/unverified state | Tab 1 replaced by "No verified history yet — stats appear when the first pre-registered decision lands on-chain." Trust Panel + How-it-works still render. |

**AC:** all fixture→live fields render; proof stream rows show `registered < executed` timestamps visually (arrow animation); every external link opens new tab; hire CTA reachable without scroll on 1440p and via sticky bottom bar on mobile.

---

## S4 · Hire flow (3-step wizard, modal→full-screen on mobile)

**Purpose:** configure safety in plain language; ≤ 4 clicks; ≤ 60 seconds.

| Step | Content & behavior |
|---|---|
| **1 · Configure** | Amount to manage (USD1 input + "use suggested" chip) · daily spend cap (slider $5–$500, default from listing) · duration (24h / 3d / 7d / until-I-stop) · **action allowlist** — pre-checked from listing defaults, each row = plain sentence + toggle ("Adjust my collateral on Venus", "Trade CAKE/USDT on PancakeSwap") · risk summary auto-label (Low/Med/High) updates live. |
| **2 · Authorize** | What you'll sign, in order (3 rows with states: pending/signing/done): wallet connect (if needed) → session grant (Altana Keystore — renders the *exact* permission sentence generated from step 1) → fund escrow (exact amount + 3% fee, USD1 approve exact). Progress persists; each step retryable idempotently; failure copy says what happened and what to do. |
| **3 · Confirm & go** | Summary card — the sentence: *"GridGoblin may trade CAKE/USDT with up to $50 per day until Friday 18:00. You'll pay $0.80 per completed task. Stop anytime — one tap."* · [Start hiring] → success screen: confetti burst (once, subtle), live card preview, big **STOP** button introduction ("This is your stop button. It's always here."), [Go to dashboard ▸]. |

**AC (Phase A mocked / Phase B real):** timed ≤60s / ≤4 clicks; summary sentence matches config 1:1 (test: change cap → sentence changes); back/forward preserves state; Phase B: all three on-chain artifacts (session tx, escrow tx, payment) linked in success screen.

---

## S5 · Dashboard `/dashboard` — **the retention screen**

**Purpose:** "my money, working, provably." Alive at first glance.

- **Portfolio header:** total under management · P&L since first hire (verified) · active hires count.
- **Active hire card(s):** agent mini-profile · status pill (🟢 Active / 🟡 Awaiting attestation / 🔴 Stopped) · **live action feed** (SSE; rows slide in: "14:02:47 · Bought CAKE @ $2.08 · tx ↗ · proof #4821 pre-registered 14:02:11 ✓") · mini health/HF chart where relevant · spend-today vs cap progress bar · P&L-since-hire counter (ticks) · **STOP button** — always visible without scroll (mobile: sticky bottom). On stop: 2-tap confirm ("Tap again to stop — takes effect next block"), then toast with revoke tx link + card greys to history.
- **Attention states:** "Awaiting attestation" rows show countdown to deadline ("outcome proof in ~2h") — turns waiting into anticipation.
- **Empty state:** "No agents working for you yet. [Hire your first agent →]" (deep-link to category from last browse).
- **Attestation toasts:** "✅ Proof landed: GridGoblin #4821 resolved +$1.20 — view ↗".

**AC:** feed updates < 2s from event (scripted timer in Phase A); STOP visibly halts feed + shows revocation; no layout shift on live updates.

---

## S6 · Job history `/jobs`

Table/cards: agent · category · window · status (state machine from ERD `jobs.status`) · paid (receipt tx ↗) · outcomes (proof links) · rehire button (one click, reuses config). Grouping: Active / Completed / Stopped. This screen doubles as the **"receipts" screen** for judges — every past hire reconstructible from on-chain links.

## S7 · Leaderboard `/leaderboard`

- Banner: **"Every number on this page is computed from on-chain records. Audit any row →"**
- Filters: category · window (7d/30d/all) · min tasks. Table: rank · agent · verified return (weighted) · win rate · max DD · tasks · category stat · [audit ↗] → S8.
- Rank 1–3 get gold/silver/bronze accents (BNB-gold for #1). Unverified agents cannot appear (by construction, not by moderation).

## S8 · Verify (public audit) `/verify/[agentId]` — **the judge magnet**

**Purpose:** radical transparency as a product feature. Anyone can audit any agent without trusting us.

- Header: agent identity + "recomputing from chain…" live status.
- Raw proof table: every record (id, registered block/time, intentHash, deadline, outcome status, pnlUsd1, evidenceHash, both tx links) with copy buttons.
- "Recompute" panel: shows how each headline metric derives from the rows (e.g., win rate = 82% = 988/1204 resolved) with the exact query/derivation stated.
- Verdict line: "All metrics on this page were derived from N on-chain records. Nothing else was used."

**AC:** metrics on S3/S7 reconcile 1:1 with S8 derivations (Playwright assertion).

## S9 · Publish (developer console) `/publish` — P1

Wizard: 1) **Claim** — enter ERC-8004 agent ID → owner wallet signs claim message; 2) **Listing** — category, Nina-language tagline/description (with plain-language quality hints + preview card live-rendering), suggested caps, price/task; 3) **Proof Program opt-in** — explainer + runner integration snippet (the exact `registerDecision` call pattern + docs link); 4) **Go live** — preview → publish → appears in marketplace with "New" chip. Dev home: my agents · hires · x402 revenue (from receipts) · proof coverage %.

**AC:** second developer lists in < 5 min (AC from BUILD-PLAN B/F2.2); listing preview = exact marketplace card.

---

## Motion & microcopy standards

- **Motion budget:** one signature move per screen (landing: counter count-up + proof-chain shimmer; profile: chart draw-in; dashboard: feed slide-in; hire success: single confetti burst). Everywhere else: 150–250ms ease-out fades/slides. `prefers-reduced-motion` kills all non-essential.
- **Copy tone:** short sentences · verbs first · money always concrete ("$1.20", never "a small fee") · danger always plain ("This agent can lose money. Caps limit how much.") · no acronym without gloss ("ERC-8004 (the agent's on-chain ID)").
- **Jargon glossary tooltips** centralised in one component (`<Term k="erc8004">`) — single place to edit explanations.

## Route → data map (keep synced with ERD §4)

| Route | Endpoints | Cache |
|---|---|---|
| `/` | `/v1/stats` | 60s |
| `/marketplace` | `/v1/agents` | 60s |
| `/agent/[id]` | `/v1/agents/:id`, `/v1/agents/:id/proof` | 30s |
| `/leaderboard` | `/v1/leaderboard` | 120s |
| `/verify/[id]` | `/v1/verify/:agentId` | 30s |
| `/dashboard` | `/v1/jobs` + SSE `/v1/jobs/:id/events` | live |
| `/jobs` | `/v1/jobs?history` | 30s |
| `/publish` | `POST /v1/publish`, `GET /v1/developers/me` | — |
