# AgentDesk — Master Prototype Prompt (Lovable · Google AI Studio · v0 · Claude)

**How to use:** copy **Prompt 1** below as your very first message (do not edit placeholders unless told). Then apply the numbered refinement prompts in order, one per turn, checking each result against the acceptance checklist at the bottom. For Google AI Studio / v0 / Claude Artifacts: same prompts work — paste Prompt 1, then iterate.

> Pro tip (Lovable): after Prompt 1 lands, use *Preview → click any element* to point at what you want changed, combined with the refinement prompts. Keep the design system section — never let the tool drift colors.

---

## PROMPT 1 — THE MASTER PROMPT (paste this first, in full)

You are building **AgentDesk** — a premium, dark-mode web marketplace where everyday people hire AI trading agents that can **prove** their performance on-chain. Think "App Store for money-earning AI agents, where every rating is mathematically verifiable." This is a competition-winning prototype: every screen must look like a polished consumer fintech product (Revolut / Linear / TradingView quality), not a crypto casino.

**Audience:** normal people with $200–$5,000 in crypto who want their money to work automatically but are afraid of scams. The #1 feeling to evoke at every step: *"this is safe, and I stay in control."* Zero jargon without a plain-language explanation. Every number about money must feel trustworthy.

**The differentiator (weave into the design everywhere):** ordinary marketplaces show fake screenshots and star ratings. AgentDesk agents have a **Verified Track Record**: before an AI agent makes any trade, its intention is registered on a blockchain (timestamped, un-editable); after the trade, the result is permanently recorded. So every stat you see — returns, win rate, history — is provably real. Badge for this: shield-check icon + the word "Verified" in gold. Agents without proof show a grey "No proof yet" badge and are visually quieter.

---

### DESIGN SYSTEM (follow exactly)

- **Mood:** Swiss trading terminal meets premium fintech. Calm, precise, confident. Generous whitespace, hairline borders, no neon, no gradients except a single subtle gold radial glow on the hero.
- **Colors:** background near-black `#0B0E11`; surface `#12161C`; surface-raised `#171C24`; hairline borders `rgba(255,255,255,0.07)`; primary accent BNB gold `#F0B90B` (hover `#FFD24A`); success green `#22C55E`; danger red `#EF4444`; text primary `#E9EDF2`; text secondary `#8B93A1`. Gold is for *verification and action only* — never for decoration.
- **Type:** Inter (or Geist) for UI; **all numbers in a monospace/tabular font** (e.g., `JetBrains Mono`, `font-variant-numeric: tabular-nums`) — money figures align vertically everywhere. H1 48–64px bold tight; body 15–16px; stats 20–28px.
- **Components:** rounded-xl (12px) glass cards (`background: rgba(18,22,28,0.8); backdrop-blur`), 1px borders, soft shadows. Buttons: primary = gold background, dark text, medium radius; secondary = outline. Status pills with dot indicators. One shared **VerifiedBadge** component (gold shield-check + "Verified").
- **Motion:** subtle and confident. 150–250ms ease-out. Landing stats count up once on scroll into view; charts draw in (line grows left→right); dashboard feed rows slide in; one confetti burst on hire success. Respect `prefers-reduced-motion`.
- **Responsive:** mobile-first bottom tab bar (Market · Leaderboard · Dashboard); desktop top nav. All interactive targets ≥ 44px.

---

### GLOBAL LAYOUT

Top nav (sticky, backdrop-blur): logo "AgentDesk" (wordmark with a small gold shield), links: Marketplace, Leaderboard, Verify, How it works; right side: network chip "BNB Chain" and a "Connect Wallet" gold-outline button (non-functional in prototype — clicking shows a toast "Wallet connect coming in the live version").

Footer: minimal, one line: "AgentDesk — proof, not promises. Built for BNB Chain's Build the Era hackathon." + tiny live-status chip "● Data: fresh".

---

### SCREEN 1 — LANDING `/`

1. **Hero** (single viewport): eyebrow small gold text "THE VERIFIABLE AGENT MARKETPLACE"; H1: **"Hire trading agents that can prove their P&L."**; subtext: "200,000+ AI agents already live on BNB Chain. AgentDesk is where you find the good ones — every track record verified on-chain, every hire capped, every agent stoppable in one tap." Two CTAs: gold "Browse agents →" and ghost "How proof works · 60s". Right side (or behind, subtle): an abstract animated motif of a hash chain turning into checkmarks — slow, elegant, GPU-light.
2. **Live counters row** (three big monospace stats that count up on scroll into view): "12,847 verified agents" · "234,501 tasks proven" · "$1.2M verified profits" — each with tiny caption "live from BNB Chain" + green pulse dot.
3. **Four category cards** (2×2 grid; this maps to the official hackathon categories — each card shows one real example agent's mini-sparkline):
   - **Grid Trading** — "Buys the dip, sells the rip — automatically." chip: "PancakeSwap"
   - **Rebalancing** — "Keeps your liquidity in the profitable range." chip: "LP positions"
   - **Yield** — "Moves funds to where the APY actually is." chip: "Farms"
   - **Health Guard** — "Stops your loan from getting liquidated at 3am." chip: "Venus"
   Each card: icon, title, one-liner, small sparkline of the example agent, arrow on hover.
4. **"Proof, not promises" band** — the differentiator section, split layout: LEFT (grey, slightly struck-through, small): "Everywhere else — ★ 4.8 stars · screenshots · 'trust me'"; RIGHT (gold-accented, confident, larger): "On AgentDesk — every intention registered on-chain *before* the trade → every outcome recorded after → append-only forever. Nobody can edit history." Include a 3-node mini-diagram: `Intent locked 14:02:11` → `Trade executed 14:02:47` → `Result sealed +$1.20 ✓` with timestamps in mono font.
5. **How it works** — 3 steps with small mock UI vignettes: ① "Pick a proven agent" (mini agent card) · ② "Set your limits" (mini sliders: $50/day, expires Friday) · ③ "Hire in 60 seconds" (mini success card with big STOP button). Caption under steps: "You never hand over your wallet."
6. Final CTA band: "The next agent you hire should be able to prove itself." + gold button "Browse verified agents →".

---

### SCREEN 2 — MARKETPLACE `/marketplace`

- Header: "Marketplace" + result count "128 agents". Category tabs (All · Grid · Rebalancing · Yield · Health Guard), a "Verified only" toggle (ON by default, gold when on), sort dropdown (Verified return · Win rate · Tasks proven · Response time · Newest), and a Filters collapsible (Risk: Low/Med/High · Price per task: under $0.50 / $0.50–$2 / $2+ · Runs on: PancakeSwap / Venus / Aave / Lista chips).
- **Agent cards grid** (3 columns desktop, 1 mobile) — the most important component, make it beautiful:

```
┌────────────────────────────────────────────┐
│ ◉ GridGoblin                    🛡 Verified │
│ Grids CAKE/USDT while you sleep            │
│                                            │
│  ▁▂▂▄▅▆▇█  (sparkline, gold→green)         │
│                                            │
│  +31.4% · 30d    82% win rate    1,204 tasks│
│  Risk: Medium    Runs on: PancakeSwap      │
│  from $0.80 / task                [Hire ▸] │
└────────────────────────────────────────────┘
```

- Stats in monospace, green for positive, red for negative. Hover: card lifts 2px, border glows gold. Click → agent profile.
- Include 2 grey "No proof yet" cards at the bottom when "Verified only" is off — quieter styling, no stats row, caption "Unproven ≠ bad. Stats appear when the first on-chain proof lands."
- Skeleton loaders shaped exactly like cards. Empty filter state: friendly illustration + "No agents match yet — try widening filters."

**MOCK DATA — create exactly these 12 agents (3 per category):**

| name | category | tagline | 30d return | win rate | tasks | risk | price/task | verified |
|---|---|---|---|---|---|---|---|---|
| GridGoblin | Grid | Grids CAKE/USDT while you sleep | +31.4% | 82% | 1,204 | Medium | $0.80 | ✓ |
| GridMind | Grid | Adaptive grid bands with volatility brakes | +18.2% | 76% | 842 | Low | $1.20 | ✓ |
| GridRunner | Grid | High-frequency micro-grids on memecoins | +54.9% | 61% | 3,118 | High | $0.40 | ✓ |
| RangeRanger | Rebalancing | Keeps your PancakeSwap v3 range centered | +12.7% | 88% | 611 | Low | $1.50 | ✓ |
| RangeBot Prime | Rebalancing | Auto re-centers LP on volatility bursts | +9.3% | 91% | 489 | Low | $2.00 | ✓ |
| FluxRange | Rebalancing | Wide-range LP optimizer for lazy liquidity | +6.1% | 84% | 233 | Low | $0.90 | ✓ |
| YieldShepherd | Yield | Moves funds to where APY actually is | +14.8% | 93% | 1,042 | Low | $0.60 | ✓ |
| FarmHand | Yield | Conservative farm rotation, weekly harvests | +8.4% | 95% | 512 | Low | $0.50 | ✓ |
| AlphaYield | Yield | Chases hot farms, cuts fast when they die | +38.9% | 67% | 1,877 | High | $1.10 | ✓ |
| HealthGuard | Health Guard | Stops your Venus loan from liquidating | +2.1% | 99% | 96 | Low | $1.00 | ✓ |
| GuardianV2 | Health Guard | Aave + Venus collateral sniper | +1.7% | 98% | 74 | Low | $1.30 | ✓ |
| MoonMechanic | Grid | Fresh agent, first proofs landing soon | — | — | — | Medium | $0.30 | ✗ (No proof yet) |

(Add a 13th unverified: "YieldPilot" for Yield, same grey treatment.)

---

### SCREEN 3 — AGENT PROFILE `/agent/gridgoblin` (make this screen stunning; it converts)

**Tab 1 — Verified Track Record (default):**
- Header row: circular avatar (generated geometric mark, gold accents), name + 🛡 Verified badge, tagline, category chip, ERC-8004 ID chip `0x8f3…a21` with copy icon and external-link icon, developer line "by @cryptoforge ✓".
- **Equity curve chart** (main visual): cumulative verified P&L area chart, dark theme, gold line with green fill fade, timeframe pills 7D / 30D / ALL (data changes per pill), drawdown segments tinted red under the line. Under chart: mono caption "Every point derives from an on-chain record. Audit →".
- **Stats grid** (6 tiles, monospace numbers): Verified return +31.4% (30d) · Win rate 82% · Max drawdown −6.2% · Tasks proven 1,204 · Avg response 3.8 min · "Grids completed" 214. Each tile has an info (i) tooltip with a one-sentence plain-language definition.
- **Proof stream** (the "wow" — a live-feeling list of proof records, newest first): each row: `#4821` · plain-English intent "Buy 12 CAKE if price ≤ $2.10" · mono timestamps "registered 14:02:11 → executed 14:02:47" (registered BEFORE executed, with a tiny gold→green arrow) · outcome badge `+$1.20 ✓` or `−$0.40 ✗` · links "tx ↗" "evidence ↗". Expandable rows reveal `intentHash 0x3fa…`, `deadline 14:10`, `attested block 52,301,884`. Show 8 rows + "View all 1,204 proofs →".
- Right rail (sticky, desktop): **Pricing card** — "from $0.80 per completed task" · suggested limits list ("Max spend $50/day", "Access expires 7 days") · big gold button **"Hire — takes 60s ▸"** · secondary "Watch" (bookmark) · tiny trust row: "Escrowed · pay on completion only · 3% platform fee".

**Tab 2 — Trust & Safety ("What it can do to your money"):** a card titled with exactly that phrase. Three plain sentences with icons: ✅ "Can trade CAKE/USDT on PancakeSwap — nothing else" · 💰 "Can spend at most $50 per day" · ⏱ "Access expires Friday 18:00 — or when you stop it". Then a row of three big reassurances: "Never holds your wallet" · "One-tap stop, always visible" · "You pay only for completed tasks". A subtle "Revoke demo" button shows a toast "Session revoked — effective next block (this is the live-version behavior)".

**Tab 3 — How it works:** 3-step diagram (escrow → pre-registered decisions → attested outcomes) + fee transparency block: "Task price $0.80 + 3% protocol fee = $0.82 total, charged only when the task completes."

---

### SCREEN 4 — HIRE FLOW (3-step wizard, full-screen modal on desktop, full page on mobile)

**Step 1 — Set your limits** (this is safety made friendly): amount input "Amount to manage: $200" with "use suggested" chip; slider "Daily spend cap" $5–$500 default $50 (big mono readout); duration pills 24h / 3 days / 7 days / Until I stop; **action allowlist** — toggle rows each written as a plain sentence: "Trade CAKE/USDT on PancakeSwap ✓(on)", "Move funds between farms ✓(on)", "Withdraw to my wallet ✗(off, locked off)" — the last row is deliberately locked with caption "Withdrawals always stay with you." Live risk label recalculates (Low/Med/High) as user changes anything.

**Step 2 — Authorize:** three sequential rows with states (pending → signing ✓ done): "Connect wallet" · "Grant limited access (creates a session with exactly the limits above)" · "Fund escrow: $2.40 (3 tasks in advance + fee)". In the prototype these auto-complete one by one with a 1s stagger and a satisfying check animation. Show the exact permission sentence being granted, generated from step 1: *"GridGoblin may trade CAKE/USDT with at most $50 per day until Aug 23, 18:00. It cannot withdraw. You can stop it anytime."*

**Step 3 — Confirm:** summary card restating the sentence + price + caps in one glance; gold button "Start GridGoblin". **Success state:** single elegant confetti burst, then a live card preview with a BIG red-outline **STOP** button and the copy: "This is your stop button. It's always one tap away — effective immediately." + "Go to dashboard →".

Back/forward must preserve all state. A persistent thin progress indicator (Step 1·2·3) across the top.

---

### SCREEN 5 — DASHBOARD `/dashboard` (make it feel ALIVE)

- Header: "Your agents" + portfolio stats row (mono): "Under management $200" · "P&L since hire +$3.40" (green, ticks up occasionally in prototype) · "Active 1".
- **Active hire card:** top row = agent mini-identity + status pill `● Active` (green pulse); middle = **live action feed** (in prototype, a new row slides in every ~5 seconds from this scripted sequence, looping):
  1. `14:02:47 · Bought 12 CAKE @ $2.08 · proof #4821 pre-registered 14:02:11 ✓ · tx ↗`
  2. `14:07:12 · Grid level hit — sold 12 CAKE @ $2.21 (+$1.20) · proof #4822 ✓ · tx ↗`
  3. `14:31:05 · Volatility spike — widened grid band · proof #4823 ✓ · tx ↗`
  4. `15:00:00 · Proof sealed: #4822 resolved +$1.20 ✓ · evidence ↗`
- Right column inside the card: spend-today progress bar `$12.40 / $50`, P&L-since-hire counter (mono, ticks), mini sparkline.
- **STOP button**: red-outline, prominent top-right of the card AND sticky bottom on mobile. Two-tap confirm ("Tap again to stop — takes effect next block"). On stop: card greys out, feed freezes, toast "Session revoked · tx ↗ · effective next block", card moves to history state with "Stopped at 15:42".
- Empty state: "No agents working for you yet." + gold "Hire your first agent →".

---

### SCREEN 6 — LEADERBOARD `/leaderboard`

- Banner card (gold border glow): "Every number on this page is computed from on-chain records. Audit any row →"
- Filters: category pills · window pills (7D / 30D / ALL) · "min 50 tasks" toggle.
- Ranked table: rank (1–3 get gold/silver/bronze rank chips), agent (avatar+name+verified badge), verified return (mono, colored), win rate, max drawdown, tasks proven, category-specific stat column ("liquidations saved" for Health, "grids completed" for Grid), and an "audit ↗" link per row. Row hover highlights; click row → profile. Rank #1 row subtly glows gold.

### SCREEN 7 — JOB HISTORY `/jobs`

Grouped list: "Active" · "Completed" · "Stopped". Each row: agent avatar+name, date range, status pill, "Paid $2.42 · receipt ↗", outcomes summary ("7 tasks · +$3.40 verified"), and a "Rehire" ghost button (toast: "Configuration reloaded — confirm to restart"). This screen doubles as the "receipts" screen — clean, factual, mono numbers everywhere.

### SCREEN 8 — VERIFY (public audit page) `/verify/gridgoblin`

- Header: "Audit GridGoblin" + green "recomputed from chain · 12s ago" chip.
- Verdict sentence in a callout: "All metrics shown on AgentDesk for this agent derive from **1,204 on-chain records**. Nothing else was used."
- Raw proof table: record id · registered (block + timestamp) · intent hash (truncated mono) · deadline · outcome status (✓/✗/○ pending) · P&L · both tx links. Copy buttons on hashes. A "Recompute" button that plays a quick scanning animation then re-renders the table (same data) with a toast "Verified: 1,204 records · metrics match profile ✓".

### SCREEN 9 — PUBLISH (developer console) `/publish` (secondary; simple but polished)

Wizard with a live preview of the resulting marketplace card on the right. Steps: 1) "Claim your agent" — input ERC-8004 ID + "Sign to claim" button (toast simulation). 2) "Describe it like a human would" — tagline (with live counter and hint "Explain what it does for the user's money, not the tech"), category select, risk select. 3) "Set your terms" — price per task, suggested daily cap, suggested duration. 4) "Go live" — preview card + gold "Publish agent". Include a small "Proof Program" explainer card: "Agents that pre-register decisions on-chain get the Verified badge and rank higher. Integration guide ↗".

---

### BEHAVIOR & QUALITY BAR

- All data is mock; keep it in one clearly-named file (e.g., `src/data/agents.ts`) with a typed `Agent` interface, so it can be swapped for a real API later.
- Sparklines: generate smooth SVG paths from arrays; never images.
- Every stat, hash, tx link is monospace. Every external link opens in a new tab.
- Toasts (bottom-right, dark cards with gold/green/red left border) for every simulated action.
- No lorem ipsum anywhere — write real microcopy in the calm, honest tone of the examples above.
- Accessibility: semantic landmarks, focus rings, AA contrast on dark, alt text, keyboard-navigable wizard.
- Performance-feel: instant hover states, skeletons on tab switches, no layout shift.

Build the full app with working navigation between all screens, the 13 mock agents, and the hire wizard flow end-to-end (Marketplace → GridGoblin profile → Hire → Dashboard with live feed → STOP → Jobs history). Start with the design system + Landing + Marketplace, then Agent Profile, then Hire flow + Dashboard, then the remaining screens.

---

## PROMPT 2..8 — REFINEMENT SEQUENCE (one per turn, after Prompt 1)

**P2 — Agent card polish:** "Refine the agent card: tighten typographic hierarchy (name 16px semibold, stats 14px mono), make the sparkline 40px tall with a subtle gold-to-green gradient stroke, verified badge top-right, and add a hover state where the card lifts 2px with a gold border glow. Ensure the grid is 3 columns at ≥1200px, 2 at ≥768px, 1 below."

**P3 — Profile chart:** "On the agent profile, replace the placeholder chart with a hand-built SVG area chart (no library): cumulative P&L from the mock data, gold stroke with green gradient fill, subtle horizontal gridlines with mono axis labels, crosshair on hover showing date + value in a floating tooltip, and a draw-in animation on mount. Timeframe pills switch datasets."

**P4 — Proof stream:** "Make each proof stream row expandable with a smooth height animation. Collapsed shows: record id, plain-English intent, registered→executed timestamps with a small gold-to-green arrow, outcome badge, links. Expanded additionally shows intentHash, deadline, attested block — all mono with copy buttons."

**P5 — Hire wizard state:** "Ensure the hire wizard: preserves all state across back/forward, regenerates the permission sentence live as the user changes the cap/duration/allowlist (the sentence must exactly mirror the controls), and the risk label (Low/Med/High) recalculates: Low = 1 action allowed or cap ≤ $25; High = all actions and cap ≥ $200; else Medium."

**P6 — Dashboard aliveness:** "Script the dashboard feed to prepend a new action row every 5 seconds from the provided sequence, looping. New rows slide in (200ms), the P&L counter ticks with a brief green flash, and the spend progress bar animates width. STOP freezes everything and transitions the card to a stopped state (grey, static, 'Stopped at 15:42')."

**P7 — Landing counters:** "Landing stats count up from 0 once when scrolled into view (1.2s, ease-out), formatted with commas, in large mono. The pulse dot next to 'live from BNB Chain' pulses gently on a 2s loop."

**P8 — Empty & error states pass:** "Add polished empty, loading (skeletons), and error states for every screen: marketplace empty-filter, dashboard no-hires, leaderboard no-results in window, verify pending-record. Each: small line illustration, one honest sentence, one action button."

---

## ACCEPTANCE CHECKLIST (before calling the prototype done)

- [ ] Nina journey works end-to-end: land → pick Grid → profile → hire (60s, ≤4 clicks) → dashboard live feed → STOP → history
- [ ] Verified vs unverified agents are unmistakable at a glance
- [ ] Every money number is monospace and colored by sign
- [ ] The permission sentence on hire matches the controls exactly
- [ ] Proof stream shows registered-before-executed timestamps visibly
- [ ] Dark theme is consistent; gold used only for verification + primary actions
- [ ] Mobile: bottom tab nav, sticky STOP, no horizontal scroll at 360px
- [ ] Zero placeholder text; toasts for every simulated action
- [ ] Feels alive (count-ups, feed ticks, chart draw-ins) but calm (≤250ms animations)
