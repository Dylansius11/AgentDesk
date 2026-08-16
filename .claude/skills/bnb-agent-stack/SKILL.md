---
name: bnb-agent-stack
description: "Deep knowledge of BNB Chain's 2026 AI-agent stack: ERC-8004 identity, ERC-8183 escrowed hiring, x402/B402 payments, Altana scoped sessions, TermiX MCP + Agent.family, 8004scan API, and BNB Agent Studio. Use when integrating with, coding against, or debugging any of these in AgentDesk — or when a question about BNB's agent ecosystem comes up."
version: 1.0.0
---

# BNB Agent Stack — Working Knowledge for AgentDesk

The canonical details (env vars, addresses, links) live in `docs/technical/INTEGRATION.md` — this skill is the working knowledge you need while coding. When facts here and INTEGRATION.md disagree after wiring, INTEGRATION.md wins and this file gets updated.

## The mental model (memorize this)

BNB built the **factories**; AgentDesk is the **storefront + trust layer**. We never duplicate what exists:

```
create ──── BNB Agent Studio (`bnb` CLI in Cursor/Claude Code → ERC-8004 identity + wallet + x402 payments, runs on AWS AgentCore)
identify ── ERC-8004 registries (identity / reputation / validation)
discover ── 8004scan API (AltLayer) — structured agent data; BSC ≈ 60% of all agents across 26 chains
control ─── Altana (agent-held wallets + owner-granted scoped sessions in a public Keystore; revoke = 1 tx)
hire ────── ERC-8183 (job escrow + evaluator attestation; use Altana's hireErc8183Agent helper)
pay ─────── x402 / B402 (HTTP-402 payments, USD1 stablecoin on BSC; @x402/core · @x402/extensions · @x402/mcp)
execute ─── Altana skills (PancakeSwap Trading/Liquidity, Venus, Aave, Lista, Copy Trade, Token Radar, Four.meme, Wallet Tracker, x402 API) + TermiX BSC MCP tools
prove ───── ProofLedger (OURS — the only original contract; append-only decisions→outcomes)
mesh ────── TermiX Agent.family (agents hiring agents; our API serves these machine clients too)
```

## ERC-8004 — agent identity

- Three on-chain registries: **Identity** (ERC-721-style + URI → agents are browsable), **Reputation** (behavior track record), **Validation** (verification of claims/permissions). Spec: https://eips.ethereum.org/EIPS/eip-8004
- In AgentDesk: agents are keyed by their ERC-8004 ID everywhere (`agents.id`). We **read** registries (via 8004scan, registry reads as fallback) and let developers **claim** listings with an owner signature. We never issue our own identities.
- Caution: registry/URI content is developer-controlled → sanitize, never render raw HTML; treat un-proven claims as claims.

## 8004scan (AltLayer) — the data layer

- Explorer + API over ERC-8004: identity, capability, ownership, reputation, feedback, network data. https://8004scan.io
- Hackathon grants **Pro tier**: 500 req/min, 100k/day. Budget discipline: cache-first (60s list / 30s detail), refresh-in-background, staleness chips in UI on outage.
- Zod-parse every response in `packages/sdk` — schema drift is the #1 wiring bug risk.

## ERC-8183 — escrowed hiring

- Job escrow with **evaluator attestation**: funds escrowed → agent works → evaluator attests → release. Proposed by Virtuals × Ethereum Foundation (Mar 2026); Virtuals ACP v2.0 (Apr 2026) is the hook-based reference implementation (2,000+ agents onboarded).
- In AgentDesk: hire button → `hireErc8183Agent` (Altana SDK — explicitly an Altana-track bonus). Our keeper plays the evaluator role in v1 by resolving from objective state (pool/protocol reads), never from agent-supplied numbers.
- Job state machine to mirror in UI: `created → funded → active → awaiting_attestation → completed | revoked | expired`.

## x402 / B402 — payments

- Pay-per-task over HTTP; settlement **USD1** on BSC. Created by Coinbase (repo: Coinbase/x402), adopted by Binance as B402. Agents already pay LLM bills and buy CoinMarketCap data with it; BinancePay merchant support on the roadmap.
- TS packages (verified): `@x402/core`, `@x402/extensions`, `@x402/mcp`. Python/Go/Java also exist.
- Our flow: hire payments in USD1 with **3% protocol fee** (`PROTOCOL_FEE_BPS=300`); receipts mirrored to `receipts` table; agents may also *sell* over B402 (Altana-track bonus).
- UX law: one clear price before hire; approvals are exact-amount, never infinite allowance.

## Altana — sessions & Keystore

- Sovereign agent wallets: the **agent** holds its key; the **owner** grants scoped sessions = allowlist (which calls/skills) + spend cap + expiry, registered in the **public on-chain Keystore**; revocation = 1 tx, effective immediately.
- This is the source of truth for the **Trust Panel**: the plain-language permission sentences (`permissionSentence()` util) render from the actual session config — if the chain and the sentence disagree, that's a P0 bug.
- Altana-track checklist (all boxes must be tickable): agent-owned Altana wallets ✓ · real session limits ✓ · Keystore registration ✓ · real txs through session keys (testnet counts, mainnet stronger) ✓ · in-product revocation ✓ · `hireErc8183Agent` ✓ · x402/B402 selling ✓.

## TermiX — MCP server + Agent.family + the report

- BSC MCP server: https://github.com/termix-official/bsc-mcp (Claude Desktop/agents-ready BSC tool server).
- Agent.family (mainnet Jul 6, 2026): agents hire agents; on-chain escrow, staked reputation, zkVM+TEE arbitration, 120+ job types. Our API (`GET /v1/agents...`) is deliberately REST+JSON so these machine clients can consume it without humans.
- **Agent Advantage Report** (TermiX track, 30% of their score): ≥3 real tasks with-vs-without agent, time/cost/quality measured with outputs attached, ≥1 trading case. Log baselines from day one — you cannot reconstruct them later.

## BNB Agent Studio (`bnb` CLI)

- One-prompt agent creation inside Cursor/Claude Code → identity + wallet + payments shipped to chain in ~15 min; runtime on AWS AgentCore. Official skill for MCP access: `bnbchain-mcp` (`npx @bnb-chain/mcp@latest`) — covers chain reads/writes, ERC-8004 registration, Greenfield.
- **48h free trials, testnet only** — never assume a Studio runtime is warm. Wake-on-demand: our API pings the runner endpoint before demos/judging windows. Keep runner code in `agents/` so re-scaffolding takes minutes.
- Roadmap to ride: TWAK wallets, BinancePay B402 merchants, Azure runtime, dev dashboard.

## Chains & constants

| | Mainnet | Testnet (Chapel) |
|---|---|---|
| chainId | 56 | 97 |
| Use in project | final proofs, tiny-cap real hires ($20–50) | everything else |

Stablecoin for the money flow: **USD1**. RPCs in `.env` (`BSC_RPC_URL`, `BSC_TESTNET_RPC_URL`). Faucet link lives in the hire flow's fund step.

## Failure modes seen coming (design around these)

1. 8004scan schema drift mid-hackathon → zod parse + last-cache fallback.
2. Studio runtime asleep during judging → wake-on-demand + mainnet agent as the always-on proof.
3. Session-creation UX (connect + grant + fund) partial-failing → each step idempotent + retryable, progress persisted.
4. x402 facilitator hiccup → queue payment, show "settling" state, never block the hire confirmation UI on it.
