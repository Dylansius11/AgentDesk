# exported/ — generated, committed

`addresses.<network>.json` files here are written by `script/Deploy.s.sol` on every real
broadcast (`anvil` dry-runs included, as `addresses.anvil.json` — harmless to overwrite/regenerate,
not meant to be committed since a local anvil chain has no persistent identity; see `.gitignore`
below). `addresses.chapel.json` and `addresses.mainnet.json` **are** meant to be committed the
moment a real deploy happens, in the same commit as the matching update to
`docs/technical/INTEGRATION.md`'s `PROOFLEDGER_ADDRESS_*` env vars — never let those drift apart
(CLAUDE.md §4 doc-conflict rule).

`packages/sdk` and `apps/api`/`apps/keeper` are meant to read the pinned addresses from here (or
from the env vars they mirror) rather than hardcoding them anywhere else.

Shape:

```json
{
  "proofLedger": "0x...",
  "admin": "0x...",
  "attester": "0x...",
  "chainId": 97,
  "deployedAtBlock": 12345678
}
```
