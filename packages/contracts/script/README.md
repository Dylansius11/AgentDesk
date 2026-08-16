# script/ — deploy scripts (not yet written)

Per `docs/technical/ARCHITECTURE.md` §3 and the `bsc-foundry` skill, deployment here is done via
viem TS scripts (`script/deploy.chapel.ts`, `script/deploy.mainnet.ts`), not `forge script`, so
that address/ABI export into `packages/sdk` and `docs/technical/INTEGRATION.md` happens in the
same tooling.

**Deliberately not written in this pass**: this task (`ProofLedger contract scaffold`, Wave 1B,
2026-08-16) is scoped to the contract + tests only. No funded deployer key is available this
session, and writing untested deploy scripts against a contract that hasn't been reviewed yet
would be scope creep ahead of need. Building these is a follow-up task once:

1. `ProofLedger.sol` has had a look from another pass (or is accepted as-is), and
2. a Chapel deployer key + `BSC_CHAPEL_RPC_URL` are available (BUILD-PLAN accounts checklist).

When that task lands, pin the deployed address + start block into `exported/addresses.chapel.json`
**and** `docs/technical/INTEGRATION.md` in the same commit — never let those drift apart.
