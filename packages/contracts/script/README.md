# script/ — deploy scripts

`Deploy.s.sol` is the single, environment-parameterized deploy script for `ProofLedger` — same
bytecode, same script, for local anvil, Chapel, and mainnet. Only `--rpc-url` and a few env vars
change between environments. `patch-deployed-block.sh` is a small companion that fixes a real
Foundry gotcha (see below) right after every broadcast.

## Tooling decision: `forge script`, not a viem TS script

`docs/technical/ARCHITECTURE.md` §3 and the `bsc-foundry` skill both mention `script/deploy.ts`
(viem) as the intended shape. This pass deliberately used Foundry's native `forge script`
(`Deploy.s.sol`) instead, for concrete reasons rather than convenience:

- This package has **zero** JS/TS tooling today (no `package.json` deps, no `tsconfig.json`, no
  `viem`/`tsx`/`dotenv` anywhere in the repo) — a viem script would mean standing up a whole new
  toolchain inside an otherwise pure-Foundry workspace, purely for a deploy script.
- `foundry.toml` already ships `[rpc_endpoints]`/`[etherscan]` entries (`bsc_chapel`,
  `bsc_mainnet`) wired for exactly this — `forge script ... --verify` uses them directly with no
  extra plumbing.
- The task's core deliverable — an **anvil dry-run that proves the deploy script actually works
  end-to-end** — is fastest and most reliable to prove with `forge script` + `cast`, both already
  installed, both already exercised by this workspace's 29 `forge test`s. No new dependency can
  silently break the dry-run.
- The address/ABI export step ARCHITECTURE.md wanted a TS script *for* is done here instead via
  `vm.writeJson` inside `Deploy.s.sol` itself (`exported/addresses.<network>.json`) — same outcome,
  no separate toolchain.

**Flagging for the PM:** if this direction is kept, `ARCHITECTURE.md` §3 and the `bsc-foundry`
skill's `script/deploy.chapel.ts` / `script/deploy.mainnet.ts` mentions should be updated to
`script/Deploy.s.sol` in the same commit, per CLAUDE.md's doc-conflict rule. Reverting to viem
later is still possible — `Deploy.s.sol` doesn't block it, it just isn't blocked on it either.

## Env vars

| Var | Required on | Notes |
|---|---|---|
| `PRIVATE_KEY` | Chapel, mainnet (reverts if unset) · optional on anvil | Deployer key. **Never commit a real value; never put one in `.env.example`.** On anvil only, falls back to anvil's published default account #0 key (`0xac09…2ff80` — public test-only material) so the script runs against a fresh `anvil` with zero setup. |
| `PROOFLEDGER_ADMIN_ADDRESS` | optional everywhere | Granted `DEFAULT_ADMIN_ROLE`. Defaults to the deployer address if unset — accepted v1 posture per SMART-CONTRACT.md §6. |
| `PROOFLEDGER_ATTESTER_ADDRESS` | Chapel, mainnet (reverts if unset) · optional on anvil | Granted `ATTESTER_ROLE` — must be the **keeper's public address**, never its private key (the deploy script never touches `KEEPER_ATTESTER_KEY`). Defaults to the deployer on anvil only, so a solo dry-run can self-attest without a second funded account. Real networks must set this explicitly — reusing the deployer as attester in production would collapse admin and attestation into one EOA. |
| `MAINNET_CONFIRM` | mainnet only | Must equal exactly `yes`, mirroring the `bsc-foundry` skill's documented mainnet gate. |
| `BSC_CHAPEL_RPC_URL`, `BSC_MAINNET_RPC_URL`, `BSCSCAN_API_KEY` | Chapel/mainnet | Already declared in `foundry.toml`'s `[rpc_endpoints]`/`[etherscan]`; add real values to a local, gitignored `.env` before running `deploy:chapel`/`deploy:mainnet` for real. |

## Commands

```bash
# local anvil dry-run — no env vars needed, run against a fresh `anvil`
anvil                                  # separate terminal, or `run_in_background`
pnpm --filter contracts deploy:anvil   # deploys + patches exported/addresses.anvil.json

# Chapel — needs a funded deployer key + keeper attester address (not available this session)
PRIVATE_KEY=0x... PROOFLEDGER_ATTESTER_ADDRESS=0x... pnpm --filter contracts deploy:chapel

# mainnet — additionally gated
PRIVATE_KEY=0x... PROOFLEDGER_ATTESTER_ADDRESS=0x... MAINNET_CONFIRM=yes \
  pnpm --filter contracts deploy:mainnet
```

Each `deploy:*` script runs `forge script script/Deploy.s.sol:Deploy --broadcast [--verify]` and
then `script/patch-deployed-block.sh <network>` — see below for why the second step exists.

## The `deployedAtBlock` gotcha (why `patch-deployed-block.sh` exists)

`Deploy.s.sol` reads `block.number` right after `vm.stopBroadcast()` to record the deploy block
into the exported JSON. **This reads the script's simulation-time state, not the chain's real
post-broadcast state** — observed directly in this pass: a fresh anvil chain's deploy transaction
landed in block `1` (confirmed via `cast receipt` / `cast block-number`), but the script's own
`block.number` read wrote `0` into `exported/addresses.anvil.json`. This is a known Foundry
scripting limitation, not a bug in this codebase.

Foundry *does* write the real receipt (including the true `blockNumber`) into
`broadcast/Deploy.s.sol/<chainid>/run-latest.json` after every `--broadcast` run.
`patch-deployed-block.sh` reads that artifact and patches the exported JSON's `deployedAtBlock` in
place immediately after the `forge script` call. This matters beyond cosmetics: `apps/keeper`'s
indexer needs an accurate start block to avoid re-scanning history or missing early events — an
off-by-one-epoch `deployedAtBlock` is exactly the kind of quiet error the "DB may lag, never lead
or lie" discipline (CLAUDE.md §5.7 / proof-engine-engineer non-negotiables) is meant to catch, so
it's fixed here rather than left as a known-wrong field.

## What was proven against local anvil (this pass, 2026-08-17)

Full command transcript is in the task report; summary of what was verified against the **deployed
bytecode** (not `forge test`'s in-memory EVM):

1. `pnpm --filter contracts deploy:anvil` deploys cleanly, writes
   `exported/addresses.anvil.json` with the correct address/admin/attester/chainId, and
   `patch-deployed-block.sh` corrects `deployedAtBlock` to the real receipt block.
2. `registerDecision` on the live deployed instance returns `recordId=1`, emits
   `DecisionRegistered`, costs 118,916 gas (cold path — first-ever registration for a fresh
   `agentId`; consistent with the ~124k cold-path number logged in SMART-CONTRACT.md §5.4 —
   exact figure differs slightly from `forge test`'s `isolate=true` gas metering vs. a raw
   `cast send` against anvil, expected).
3. Calling `attestOutcome` **before** the deadline reverts `DeadlineNotReached` — proven against
   the deployed contract, not just the test suite.
4. `anvil_setNextBlockTimestamp` + `anvil_mine` warp past the deadline; `attestOutcome` then
   succeeds, emits `OutcomeAttested`, costs 99,054 gas.
5. `getDecision(1).resolved` flips to `true`; `getOutcome(1)` returns the attested values.
6. **Append-only, proven live:** re-calling `attestOutcome` for the same `recordId` reverts
   `AlreadyAttested`, and `getOutcome(1)` is confirmed unchanged afterward (still the original win,
   not the attempted overwrite values).
7. `nextRecordId` is `2` after one registration; `recordCount(agentId=1)` is `1`;
   `hasRole(ATTESTER_ROLE, deployer)` is `true` (deployer == admin == attester in this run, since
   no `PROOFLEDGER_ATTESTER_ADDRESS` override was set — expected anvil-only default).

Anvil was killed at the end of this session; nothing was left running.

## What's still blocked

- **Real Chapel/mainnet deploy:** no funded deployer key exists this session (BUILD-PLAN accounts
  checklist, owner Dylan). The script is ready — set `PRIVATE_KEY` +
  `PROOFLEDGER_ATTESTER_ADDRESS` (+ `BSC_CHAPEL_RPC_URL` / `BSCSCAN_API_KEY`) the moment one does,
  and `deploy:chapel` needs nothing else changed.
- **BscScan verification:** untested this pass (needs a real network + `BSCSCAN_API_KEY`) — the
  `--verify` flag is wired but unexercised.
- Pinning a real Chapel/mainnet address into `exported/addresses.*.json` +
  `docs/technical/INTEGRATION.md`'s `PROOFLEDGER_ADDRESS_*` vars, in the same commit, is a
  follow-up the moment a real deploy happens (see `exported/README.md`).
