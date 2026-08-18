/**
 * packages/sdk/src/abi/index.ts
 *
 * Barrel for on-chain ABI bindings. `proof-ledger.ts` is generated (see its
 * own banner) — this file is the stable, hand-written entry point re-
 * exporting it, matching the pattern of every other packages/sdk/src/*
 * barrel (schemas/index.ts, fixtures/index.ts).
 */
export { proofLedgerAbi } from "./proof-ledger.js";
