---
name: wallet-tracker
description: Track a BNB Chain wallet's trading activity using only public onchain data (RPC logs), no API keys. Watch new swaps, profile recent activity and holdings, and find a token's early buyers. Research only, no transactions.
---

# Wallet Tracker

Research skill: follow what a BNB Chain wallet is trading, straight from the chain. It reads
PancakeSwap swap logs and ERC-20 transfer logs over a block window, so it needs no API key
and no third-party indexer. This skill performs no transactions; its session permits no
onchain calls at all. Hand any actual trading to a trading skill (like pancakeswap-trading).

The honest boundary: RPC logs only reach back as far as your window covers. Full historical
profit-and-loss ranking across a wallet's whole life needs an indexer. This skill works on
recent windows and reports the exact window it covered. An optional free BscScan API key
(`BSCSCAN_API_KEY`) extends the reachable history; without it, recent windows still work.

## Reference

Everything you need to read a wallet's activity from public logs: the events, how to filter
them by wallet without knowing the pairs, and the range limits to work around.

### Addresses (BNB Chain mainnet)

| Contract | Address |
|---|---|
| PancakeSwap V2 Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |
| USDT (BSC-USD) | `0x55d398326f99059fF775485246999027B3197955` |

Pair addresses are not hardcoded. You discover them from the logs themselves: a Swap log's
`address` field is the pair that emitted it. That is what lets you track a wallet across every
pair it touches without a pair list.

### The two events you filter on

PancakeSwap V2 pair, one per swap:

```
Swap(address indexed sender, uint256 amount0In, uint256 amount1In,
     uint256 amount0Out, uint256 amount1Out, address indexed to)
topic0 = 0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822
```

The `to` field (topic2) is who receives the output tokens. For a router swap, the final hop's
`to` is the trader. So `getLogs` with `topic0 = Swap` and `topic2 = wallet`, and NO `address`
filter, finds every swap that credited that wallet across ALL pairs in the window. Decode the
non-zero `amountXOut` to size the buy; `token0`/`token1` on the pair tell you which side is which.

ERC-20, one per token movement:

```
Transfer(address indexed from, address indexed to, uint256 value)
topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
```

Filter `topic2 = wallet` for tokens flowing IN (buys, receipts), `topic1 = wallet` for tokens
flowing OUT (sells, sends). Set the `address` to a specific token to watch just that token, or
leave it off to sweep every token the wallet moved. Indexed address topics are the 32-byte
left-padded address (12 zero bytes then the 20 address bytes).

### Range limits and chunking

Public BNB RPCs cap a single `getLogs` range, commonly somewhere between 1,000 and 50,000
blocks, and some also cap the number of logs returned. Treat 5,000 blocks per call as a safe
default and chunk anything larger: loop `fromBlock`/`toBlock` in fixed steps and concatenate.
If a call errors with a range or result-size message, halve the step and retry that chunk.

BNB blocks are about 3 seconds, so roughly 1,200 blocks per hour and 20,000 blocks is about
17 hours. Convert the window the user asked for ("last day") into a block count before you start,
and always report the block range you actually covered.

### Reconstructing holdings

You do not need an indexer for a current position: read `balanceOf(wallet)` on each token the
wallet touched in the window. Use the Transfer sweep to collect the set of token addresses, then
call `balanceOf` for each. Transfers in minus transfers out over the window approximate flow, but
`balanceOf` is the truth for what is held right now. Read `decimals()` before formatting amounts.

## Playbook

### Play: watch-wallet

Poll for a wallet's new swaps and report each one. Parameters: wallet address, check interval
(default 30s).

**Typical time:** runs until stopped

1. Record the current block as your cursor.
2. Every interval, `getLogs` for Swap with `topic2 = wallet` from the cursor to the new tip
   (no `address` filter, so all pairs are covered). Advance the cursor to the tip.
3. For each new Swap: the log `address` is the pair; read its `token0`/`token1`, decode the
   non-zero in/out amounts, and report token, direction (which token came in), size, pair, and
   tx hash. Report the block range each poll covered.

### Play: profile-wallet

Summarize a wallet's recent trading and current holdings. Parameters: wallet address, window
(default last ~20,000 blocks, about 17 hours).

**Typical time:** ~30s depending on window and chunking

1. Convert the window to a block range; chunk `getLogs` at about 5,000 blocks per call.
2. Sweep Swap logs with `topic2 = wallet` to list swaps received, and Transfer logs with
   `topic1 = wallet` (out) and `topic2 = wallet` (in) to list every token moved.
3. From the Transfer sweep, collect the distinct token addresses. For each, read
   `balanceOf(wallet)` and `decimals()` for current holdings.
4. Report: tokens traded, a rough buy/sell mix from swap directions, current holdings, and the
   exact block range covered. State plainly that this is the window's view, not lifetime PnL.

### Play: find-early-buyers

Given a token, find its first buyers in the available window. Parameters: token address, how
many (default 10).

**Typical time:** ~30s

1. Find the token's pair(s): scan Transfer logs for the token, or Swap logs, from the earliest
   block your window reaches, and take the pair `address` from the earliest Swap.
2. Read the earliest Swap logs on that pair in ascending order; each Swap's `to` (topic2) is a
   buyer. Take the first N distinct `to` addresses that received the token (non-zero token-side
   `amountOut`).
3. For each early buyer, read `balanceOf` now to report who still holds versus who sold out.
4. Report the buyers, their entry block, and hold-versus-sold status. Be explicit that "early"
   means earliest within the window you could reach, not necessarily the token's true first
   buyers unless the window reaches its creation block.

## Guards (do not remove)

- Research only: this skill never submits transactions and its session permits no onchain calls.
  Anything requiring a transaction is handed off to a trading skill.
- Report the wallet and token addresses with every symbol. Never report activity for an address
  you have not shown the user.
- Always state the block range (and rough time span) the report covers. A quiet wallet and a
  window that missed its trades look the same; say which one it is.
- Never claim full-history or lifetime PnL from a windowed log scan. That needs an indexer;
  say so rather than implying completeness.
