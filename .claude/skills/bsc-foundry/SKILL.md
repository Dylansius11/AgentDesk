---
name: bsc-foundry
description: "Foundry + viem conventions for AgentDesk's contracts workspace (packages/contracts): ProofLedger development, invariant tests, BSC Chapel testnet and mainnet deploy scripts, verification, and gas discipline. Use for any contract work in this repo."
version: 1.0.0
---

# BSC + Foundry — AgentDesk Contracts Workspace

Full design rationale: `docs/technical/SMART-CONTRACT.md`. This file is the day-to-day operating knowledge.

## Workspace layout

```
packages/contracts/
├── src/ProofLedger.sol        # the ONLY original contract (append-only decision→outcome ledger)
├── test/                       # unit + invariant + fork tests
├── script/deploy.chapel.ts     # viem deploy (testnet first)
├── script/deploy.mainnet.ts    # identical bytecode; requires PROOFLEDGER_DEPLOYER + explicit --yes
└── exported/                   # ABI + addresses consumed by apps via packages/sdk (generated, committed)
```

## Commands

```bash
pnpm --filter contracts build          # forge build
pnpm --filter contracts test           # forge test (includes append-only invariants)
pnpm --filter contracts snapshot       # gas report; CI FAILS if registerDecision > 120k gas
pnpm --filter contracts fork:test      # Chapel-fork end-to-end (decision → PancakeSwap swap → attestation)
pnpm --filter contracts deploy:chapel  # deploy + verify on BscScan; writes exported/addresses.chapel.json
pnpm --filter contracts deploy:mainnet # gated: requires MAINNET_CONFIRM=yes env
```

## Invariants that must NEVER break (CI-enforced)

1. **Append-only:** no sequence of external calls alters or removes an existing decision/outcome row. (Invariant fuzz: state-diff assertion across random call sequences.)
2. `recordId` strictly monotonic; agent→record mapping integrity.
3. `attestOutcome` callable only by `ATTESTER_ROLE`, only once per record, only after `deadline`.
4. `registeredAt < deadline ≤ registeredAt + MAX_WINDOW (24h)`.
5. Contract holds **zero funds** under any call sequence (escrow lives in external ERC-8183 contracts).

## Access roles

| Role | v1 holder | Change path |
|---|---|---|
| `ATTESTER_ROLE` | keeper EOA (`KEEPER_ATTESTER_KEY`, Railway env only) | post-hackathon → staked attester set + dispute window |
| `SET_ATTESTER` | 2-of-2 (deployer multisig + timelock) | documented, timelocked |

No proxy. No upgrade. No pause. Immutability is the product — a pause function would be a trust bug, not a safety feature.

## BSC specifics

- Chain: mainnet 56 / Chapel 97. Gas is cheap (~1–3 gwei): decision+outcome pair ≈ $0.01–0.05 — always cheaper than the trade it covers.
- Deploy with `--verify` immediately; record address + start block in `exported/addresses.<net>.json` AND `docs/technical/INTEGRATION.md` **in the same commit** (doc contract).
- Fork tests: `vm.createFork(BSC_TESTNET_RPC_URL)`; use PancakeSwapV3Pool + Venus positions fixtures for resolution-path tests; keep anvil pinned in CI for determinism.
- USD1 is the quote asset everywhere (`pnlUsd1` int128). Never introduce a second quote unit.
- Evidence: `intentHash = keccak256(abi.encode(actionType, market, direction, params, sizeUsd1, nonce))`; `evidenceHash = keccak256(abi.encode(intentHash, executionTx, resolutionSource, prices))`. Changing either scheme = new contract version, not an edit (append-only applies to schemas too, conceptually).

## When touching resolution logic (keeper side)

Outcomes resolve ONLY from objective sources: PancakeSwap v3 Quoter/pool state, Venus/Aave position state, farm share math. Never from agent-reported values. Category definitions live in SMART-CONTRACT.md §4 — if you change a definition, change the doc and the metric derivation in the same PR.
