---
name: dexscreener-token-radar
description: Find trending BNB Chain tokens and screen them for liquidity and risk using public DexScreener and GeckoTerminal data before trading. Research only, no transactions.
---

# DexScreener Token Radar

Research skill: discover what is moving on BNB Chain and screen tokens before a trading
skill (like pancakeswap-trading or four-meme) acts on them. This skill performs no
transactions; its session permits no onchain calls at all. No API key is needed; both
data sources are public.

## Reference

### Endpoints (public, no key)

| Purpose | Endpoint |
|---|---|
| Trending pools on BSC | `https://api.geckoterminal.com/api/v2/networks/bsc/trending_pools` |
| Pair detail | `https://api.dexscreener.com/latest/dex/pairs/bsc/<pairAddress>` |
| Token lookup (all pairs) | `https://api.dexscreener.com/latest/dex/tokens/<tokenAddress>` |
| Free-text search | `https://api.dexscreener.com/latest/dex/search?q=<query>` |

Rate limits are roughly 300 requests per minute on the DexScreener latest endpoints and
30 per minute on GeckoTerminal; space out batch screens.

### Reading the data

- Key pair fields: `priceUsd`, `liquidity.usd`, `volume.h24`, `priceChange.h24`,
  `txns.h24` (buys and sells), `pairCreatedAt`, `dexId`.
- Prefer tokens with liquidity above roughly $100k and a healthy buy and sell mix; thin
  pools make any trade expensive and easy to manipulate.
- A very new `pairCreatedAt` plus low liquidity plus one-sided buys is the classic
  honeypot shape; flag it, do not just skip it.
- Volume without liquidity is a red flag (wash-trade shape), as is a token whose only
  pair is on an obscure DEX.
- Neither source proves a token is safe to sell (transfer taxes and blocklists are not
  in this data). Recommend a small test trade through a trading skill before sizing up.

## Playbook

### Play: trending-scan

List what is moving on BNB Chain right now. Parameters: how many (default 10).

**Typical time:** ~15s

1. Fetch GeckoTerminal trending pools for bsc; take the top N.
2. For each pool, fetch the DexScreener pair detail for the richer fields.
3. Report a ranked table: token, address, price, 24h change, liquidity, 24h volume,
   buys and sells, pair age, and a one-line verdict (tradeable, caution, avoid) with
   the reason.

### Play: token-screen

Deep check on one token before trading. Parameters: token address.

**Typical time:** ~10s

1. Fetch all pairs for the token from DexScreener; identify the deepest pair.
2. Report: price, liquidity and where it lives, 24h volume and transaction mix, pair
   age, price change, and a clear verdict with reasons. If the token is unknown to
   both sources, say so; absence of data is itself a caution signal.

### Play: watch

Poll a token until a condition is met. Parameters: token address, condition (price
above or below X, liquidity drop, volume spike), check interval.

**Typical time:** runs until the condition triggers

Loop token-screen reads at the stated interval and report when the condition is met,
so a trading skill can act on it. Respect the rate limits; default to one check per
30 seconds.

## Guards (do not remove)

- Research only: this skill never submits transactions and its session permits no
  onchain calls. Anything requiring a transaction is handed off to a trading skill.
- Report the token address with every symbol. Never recommend a token whose address you
  have not shown the user.
- Data gaps are reported as caution, never silently skipped.
- This data cannot prove sellability; always recommend a small test trade first.
