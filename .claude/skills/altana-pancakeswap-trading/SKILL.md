---
name: pancakeswap-trading
description: Buy and sell tokens on PancakeSwap on BNB Chain through an Altana session. In and out of positions fast, with quotes, slippage protection, and full-balance exits.
---

# PancakeSwap Trading

Trade tokens on PancakeSwap V2 on BNB Chain as an Altana session. Submit onchain writes
only through your Altana session executor (`execute(calls)` with the SDK, or the
`session_execute` MCP tool). Reads can go directly against the RPC.

## Reference

Everything you need to trade PancakeSwap well: the right contracts, quoting, token
quirks, and safe slippage habits.

### Addresses (BNB Chain mainnet)

| Contract | Address |
|---|---|
| PancakeSwap V2 Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |
| USDT (BSC-USD) | `0x55d398326f99059fF775485246999027B3197955` |

### Quirks that cause mistakes

- USDT on BNB Chain has 18 decimals, not 6 like Ethereum. $20 is `20n * 10n**18n`.
- The target token may have different decimals. Read `decimals()` before computing amounts.
- Route selection: quote the direct pair AND the WBNB hop (`[USDT, WBNB, TOKEN]`) with
  `getAmountsOut`, then use whichever quotes better. Deep majors often have a direct
  USDT pool; most tokens only have a WBNB pool.
- Approve before each swap direction: `approve(router, amount)` on the input token
  (USDT before buying, the token before selling back).
- Fee-on-transfer tokens (transfer taxes) need the
  `swapExactTokensForTokensSupportingFeeOnTransferTokens` variant. Detect by simulating
  the standard swap first; if it reverts with sufficient allowance and balance, switch.

### Router functions (Uniswap V2 style)

- Quote: `getAmountsOut(uint256 amountIn, address[] path) returns (uint256[])`
- Swap: `swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)`
- `amountOutMin`: quote minus 1 to 3 percent slippage. Never 0.
- `deadline`: unix seconds, now + 600.

## Playbook

### Play: enter-position

Buy a token with USDT. Parameters: token address, USDT amount, slippage (default 1%).

**Typical time:** ~15s

1. Read the token's `decimals()`. Quote both routes with `getAmountsOut`; pick the better.
2. `execute([approve(USDT, router, amount), swap(amount, quote minus slippage, path, wallet, now+600)])`
3. Verify the token balance increased before reporting success.

### Play: exit-position

Sell part or all of a position back to USDT. Parameters: token address, amount or "all".

**Typical time:** ~15s

1. For "all", read the live token balance and use the full amount.
2. Quote the reverse path. `execute([approve(TOKEN, router, amount), swap(...)])`
3. Verify USDT increased and the token balance decreased accordingly.

### Play: round-trip

In and out in one move: buy, confirm, sell. Parameters: token, USDT amount, slippage.

**Typical time:** ~50s including your own verification reads

Write one script that quotes, buys, reads the received token balance in the same run,
then approves and sells that exact balance back. One script, four transactions, no
pauses between steps. Verify final balances onchain and report amounts and tx hashes.

### Play: tp-sl-watch

Enter, then monitor and exit at take profit or stop loss. Parameters: token, amount,
take-profit %, stop-loss %.

**Typical time:** runs until an exit triggers

1. Run enter-position. Record the entry quote.
2. Loop: every few seconds re-quote the position's USDT value with `getAmountsOut`.
3. When value crosses take-profit or stop-loss, run exit-position with "all".
4. Report entry, exit, and realized result. Re-quote before exiting; never sell on a
   stale quote.

## Guards (do not remove)

- `amountOutMin` is always a fresh quote minus slippage. Never 0.
- Verify balances onchain after each leg; report only what the chain confirms.
- If a swap reverts, requote once with +1% slippage and retry a single time; otherwise
  stop and report. Do not improvise outside the session scope.
