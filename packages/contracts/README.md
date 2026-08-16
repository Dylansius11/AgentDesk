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
- `script/Deploy.s.sol` — single, environment-parameterized `forge script` deploy (local anvil /
  Chapel / mainnet — same bytecode, only `--rpc-url` + env vars change); proven end-to-end against
  a local `anvil` instance (deploy → `registerDecision` → warp past deadline → `attestOutcome` →
  append-only re-attest revert, all against the deployed bytecode). Real Chapel/mainnet deploy is
  still blocked on a funded deployer key — see `script/README.md`.
- `exported/` — `addresses.<network>.json`, written by `Deploy.s.sol` on every broadcast; generated
  but Chapel/mainnet outputs are meant to be **committed** the moment a real deploy happens (see
  `exported/README.md`).
- `lib/` — `forge-std`, `openzeppelin-contracts` (git submodules, not committed as source).

## Commands

```bash
pnpm --filter contracts build         # forge build
pnpm --filter contracts test          # forge test (unit + invariant/fuzz)
pnpm --filter contracts snapshot      # forge snapshot — gas report incl. registerDecision
pnpm --filter contracts deploy:anvil  # deploy to a local anvil instance you started yourself
pnpm --filter contracts deploy:chapel   # needs PRIVATE_KEY + PROOFLEDGER_ATTESTER_ADDRESS (blocked — no funded key yet)
pnpm --filter contracts deploy:mainnet  # additionally needs MAINNET_CONFIRM=yes
```

See `script/README.md` for the full env var reference, the exact anvil dry-run transcript, and a
documented Foundry gotcha (`deployedAtBlock`) the deploy scripts work around. Chapel fork tests are
not part of this workspace yet.

## Gas discipline

`registerDecision` must cost ≤120k gas per `docs/technical/SMART-CONTRACT.md` §2.4 — a proof must
always cost less than the trade it covers. Check the current number with:

```bash
pnpm --filter contracts snapshot
grep registerDecision .gas-snapshot
```
