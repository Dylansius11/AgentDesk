# agents/ — placeholder

AgentDesk's four demo trading agents. **Not implemented yet** (BUILD-PLAN task C1.2).

Planned agents (one per judged category — see `docs/PRD.md`):

| Agent | Category |
|---|---|
| `grid-goblin/` | Grid Trading |
| `range-ranger/` | Rebalancing (LP ranges) |
| `yield-shepherd/` | Yield Optimisation |
| `health-guard/` | Health-Factor Monitoring |

Each should be scaffolded with the current Agent Studio `bag` CLI, get an Altana wallet with a scoped session config, expose and verify a local seller service first, then register its public endpoint through ERC-8004. AWS AgentCore deployment is optional until the local flow works. Every agent must pre-register intents on ProofLedger before executing.
