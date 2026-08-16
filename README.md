# AgentDesk 🧭

> **Hire trading agents that can prove their P&L.**
> The front door to BNB Chain's agent economy — a marketplace where every number is verifiable on-chain. *Proof, not promises.*

AgentDesk is being built for **BNB Chain's "Build the Era" hackathon** (Aug 5 – Sep 9, 2026) — the competition to become the **official BNB Agent Studio Marketplace** — and for a **vibe-coding hackathon on Aug 20, 2026** as the first prototype milestone.

## What AgentDesk is

A marketplace for the **200,000+ ERC-8004 AI agents already registered on BNB Smart Chain**, covering the four categories BNB demands — **Rebalancing · Grid Trading · Yield Optimisation · Health-Factor Monitoring** — with three things no competitor on BNB has:

1. **Proof Engine** — agents pre-register every trading decision on-chain *before* execution; outcomes are attested after. Append-only. No backdating, no deleted losers. Unfakeable track records.
2. **Trust Panel** — plain-language permissions at the moment of hire: what the agent can touch, its spend cap, its expiry, one-click revoke (Altana scoped sessions).
3. **One-minute hire** — ERC-8183 escrowed jobs, paid per-task in USD1 via x402. No agent tokens to buy, no wallet handover.

## Repository layout

```
docs/
  PRD.md                  # Product requirements + full hackathon research
  BUILD-PLAN.md           # 2 hackathon phases × 3 lanes, with acceptance criteria
  PROTOTYPE-PROMPT.md     # Master prompt for Lovable / Google AI Studio
  technical/
    ARCHITECTURE.md       # System design, monorepo structure, deployment
    INTEGRATION.md        # Every BNB integration: what, why, how, gotchas
    ERD.md                # Data model: on-chain vs off-chain, sync rules
    TECH-STACK.md         # Every technology decision + rationale
    SMART-CONTRACT.md     # ProofLedger + escrow design, security, testing
    SCREEN-DETAIL.md      # Screen-by-screen UX specification
.claude/
  agents/                 # Custom subagents (captain, bnb-stack, proof-engine, polish)
  skills/                 # Project-local skills (bnb-agent-stack, bsc-foundry)
CLAUDE.md                 # Agent operating manual + self-learning/insight logs
```

## Quick links

- Official hackathon page: <https://www.bnbchain.org/en/hackathons/smart-money-era>
- Announcement: <https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace>
- BNB Agent Studio: <https://www.bnbchain.org/en/bnb-agent-studio>
- 8004scan (ERC-8004 explorer): <https://8004scan.io/>
- ERC-8004 spec: <https://eips.ethereum.org/EIPS/eip-8004> · ERC-8183 spec: <https://eips.ethereum.org/EIPS/eip-8183>

## Status

- **Aug 16, 2026** — Foundation: research complete, docs authored, repo initialized.
- **Aug 20, 2026** — Vibe-coding hackathon prototype (frontend + mock wiring).
- **Sep 9, 2026** — "Build the Era" submission (live on BSC testnet + mainnet agents).
