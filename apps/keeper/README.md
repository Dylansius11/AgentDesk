# apps/keeper — placeholder

ProofLedger indexer + attestation worker. **Not implemented yet** (BUILD-PLAN Phase B, task C2.1).

Planned behavior (see `docs/technical/SMART-CONTRACT.md` and `docs/technical/ARCHITECTURE.md` §4.3):

- Indexes ProofLedger events into Postgres
- Attests outcomes past their deadline from objective sources (pool prices, Venus position state)
- Runs in-process with apps/api during Phase B week 1; splits into its own deployable only under load
- Sole privileged secret: `KEEPER_ATTESTER_KEY` (lives in Railway env, never in this repo)
