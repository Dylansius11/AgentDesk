# packages/sdk — `@agentdesk/sdk`

The shared typed seam between `apps/web`, `apps/api`, and `apps/keeper`
(ARCHITECTURE.md §3 import rule: apps import from here, never from each
other; this package imports nothing internal).

## Contents

- `src/schemas/` — zod schemas + inferred TS types for `Agent`,
  `ProofRecord`, `HireSession`, `Category`, plus the supporting shapes
  (`TrustPanel`, `ProofMetrics`, `EquityCurve`). `ProofRecord` is **the moat
  object** — it structurally encodes the append-only/pre-registration
  invariants from `docs/technical/SMART-CONTRACT.md` (decision strictly
  before outcome, in both wall-clock time and block order; attestation is a
  post-deadline call; deadline within the 24h anti-front-running window). A
  `ProofRecord` that violates these cannot be constructed — zod throws.
  `Agent` layers on its own moat guard: `verified: true` is structurally
  impossible without non-null, on-chain-derived `metrics`.
- `src/fixtures/` — 12 simulated marketplace fixtures (3 per category,
  exactly 2 unverified) plus one clearly labeled BSC testnet ERC-8183 canary.
  The canary is the only fixture with a live execution binding, so every other
  listing remains simulated until it gains its own provider address and A2A
  endpoint. Each fixture includes believable proof records, an equity curve,
  a Trust Panel, and pricing, plus 2 sample `HireSession` fixtures. **Not the
  mock API client** (that's a separate, downstream task) — just the data +
  the schemas it must satisfy.
- `src/validate.ts` — the `fixtures:validate` script: schema-validates every
  fixture and checks the simulated-roster invariants plus the single explicit
  live binding. Fails loudly (nonzero exit, every issue printed) on any drift.

## Commands

```bash
pnpm fixtures:validate        # from repo root — validates every fixture
pnpm --filter @agentdesk/sdk check   # tsc --noEmit
```

## Design notes for downstream consumers

- `AgentId` is a decimal-string uint256, never a JS `number` (real ERC-8004
  ids can exceed `Number.MAX_SAFE_INTEGER`).
- `ProofRecord.decision.action` is the off-chain-known preimage of
  `intentHash` (what the UI renders as plain English, e.g. "Buy 12 CAKE if
  price ≤ $2.10"). On-chain, only the hash exists — a real client fills this
  from the runner's own intent log, never from the chain itself.
- Every hex value (`intentHash`, `evidenceHash`, tx hashes) in the fixtures
  is a deterministic `sha256("<seed>")`-derived placeholder, not a real
  keccak256 preimage — fine for shape/UI purposes, not proof of anything.
