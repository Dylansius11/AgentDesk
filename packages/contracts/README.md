# packages/contracts

Foundry project for **ProofLedger**, AgentDesk's one original contract — an append-only, on-chain
ledger of pre-registered agent trading decisions and their objectively-attested outcomes. See
`docs/technical/SMART-CONTRACT.md` for the full design and `.claude/skills/bsc-foundry` for the
day-to-day operating conventions this workspace follows.

## Layout

- `src/ProofLedger.sol` — the contract. Immutable: no proxy, no pause, no upgrade path, no funds ever held.
- `src/interfaces/IProofLedger.sol` — frozen external interface (`intentHash`/`evidenceHash` schemes
  live here; changing either is a new contract version, never an edit).
- `test/ProofLedger.t.sol` — unit tests: happy paths, every revert path, access control, event
  emission, and direct append-only regression tests.
- `test/ProofLedger.invariant.t.sol` + `test/invariant/ProofLedgerHandler.sol` — invariant/fuzz suite
  proving the append-only guarantee across arbitrary call sequences, not just hand-written orderings.
- `script/` — deploy scripts. **Not written yet** — deployment is a separate task once a funded
  deployer key exists (see `docs/BUILD-PLAN.md`); see the note in that directory.
- `lib/` — `forge-std`, `openzeppelin-contracts` (git submodules, not committed as source).

## Commands

```bash
pnpm --filter contracts build     # forge build
pnpm --filter contracts test      # forge test (unit + invariant/fuzz)
pnpm --filter contracts snapshot  # forge snapshot — gas report incl. registerDecision
```

Deploy scripts (`deploy:chapel`, `deploy:mainnet`) and Chapel fork tests are not part of this
workspace yet — see `script/README.md`.

## Gas discipline

`registerDecision` must cost ≤120k gas per `docs/technical/SMART-CONTRACT.md` §2.4 — a proof must
always cost less than the trade it covers. Check the current number with:

```bash
pnpm --filter contracts snapshot
grep registerDecision .gas-snapshot
```
