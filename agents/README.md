# agents/ — placeholder

AgentDesk's four demo trading agents. **Not implemented yet** (BUILD-PLAN task C1.2).

Planned agents (one per judged category — see `docs/PRD.md`):

| Agent | Category |
|---|---|
| `grid-goblin/` | Grid Trading |
| `range-ranger/` | Rebalancing (LP ranges) |
| `yield-shepherd/` | Yield Optimisation |
| `health-guard/` | Health-Factor Monitoring |

Each is scaffolded with the `bnb` CLI + Agent Studio, gets an Altana wallet with a scoped session config, and pre-registers intents on ProofLedger before executing.
