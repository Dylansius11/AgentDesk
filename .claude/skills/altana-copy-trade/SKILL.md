---
name: copy-trade
description: Mirror a chosen wallet's PancakeSwap trades under hard session caps. Watch a leader onchain, screen what it buys, and copy buys and sells sized to your own per-trade and total budget, never more.
---

# Copy Trade

Follow one wallet (the leader) and mirror its PancakeSwap V2 trades with your own
money, under a session budget it cannot make you exceed. The person running this
skill names the leader wallet. You never choose it and never guess it: with no
address given, there is nothing to copy, so ask for one before anything else.

This skill composes two capabilities you already have: detection (reading the
leader's trades from public RPC logs) and execution (the same PancakeSwap trading session as the
`pancakeswap-trading` skill). You never hand the leader your keys. Your worst case
is bounded by the session cap, and that bound is the whole point.

Submit onchain writes only through your Altana session executor (`execute(calls)`
with the SDK, or the `session_execute` MCP tool). All detection reads go directly
against the RPC.

## Reference

### Addresses (BNB Chain mainnet)

| Contract | Address |
|---|---|
| PancakeSwap V2 Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |
| PancakeSwap V2 Factory | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |
| USDT (BSC-USD) | `0x55d398326f99059fF775485246999027B3197955` |

### Detecting the leader's trades (reads only)

A PancakeSwap V2 pair emits on every swap:

```
event Swap(address indexed sender, uint256 amount0In, uint256 amount1In,
           uint256 amount0Out, uint256 amount1Out, address indexed to)
```

- `to` (topic 2) is the trade recipient. On the final hop of the leader's buy or
  sell, `to` is the leader. Filter `getLogs` for this event with topic 2 set to the
  leader address to find every trade that paid out to it.
- Which token did the leader receive? Read the emitting pair's `token0()` and
  `token1()`. The side with a non-zero `amountOut` is the token that flowed to the
  leader. If that token is not USDT and not WBNB, the leader just bought it. If the
  token out is USDT or WBNB, the leader was selling something back.
- Track ERC-20 `Transfer(from, to, value)` logs with topic 2 set to the leader to
  confirm the size and token of what it received, independent of the router path.
- Poll `getLogs` from the last block you checked forward. Never act on a log you
  have not decoded down to a concrete token address and amount.

### Sizing a mirror

- Read the input token's `decimals()` and the mirror token's `decimals()` before
  computing any amount. USDT on BNB Chain has 18 decimals, not 6.
- Mirror size is `min(leader-proportional size, per-trade max, budget remaining)`.
  Leader-proportional means: match the fraction of its own USDT balance the leader
  spent, applied to your budget. When in doubt, the per-trade max wins.
- Quote before every trade with the router's
  `getAmountsOut(uint256 amountIn, address[] path)`. Try the direct USDT pair and
  the WBNB hop (`[USDT, WBNB, TOKEN]`); use whichever quotes better.
- `swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)` with
  `amountOutMin` set to the fresh quote minus 1 to 3 percent slippage, never 0.
  `deadline` is now + 600 seconds. Approve the input token to the router first.

## Playbook

### Play: follow

Mirror the leader's buys under caps. Parameters: leader wallet (required),
per-trade max (USDT, required), total budget (USDT, required), optional token
screen.

**Typical time:** runs until the budget is spent or you stop it

1. Confirm you were given an explicit leader wallet address, a per-trade max, and a
   total budget. If any of the three is missing, stop and ask for it. Do not start
   the loop on a partial set.
2. Record the current block as your watermark and read your starting USDT balance.
   The total budget is a hard ceiling on cumulative USDT spent across all mirrors.
3. Loop: poll `getLogs` for pair `Swap` events with topic 2 = the leader, from the
   watermark forward. Decode each into (token, side, amount) and advance the
   watermark.
4. For each new leader buy: screen the token first. Recommended: run the
   `dexscreener-token-radar` skill's `token-screen` play on the token address. If it
   fails the liquidity screen (thin pool, honeypot shape, unknown to both sources),
   skip it and log why. Do not mirror it.
5. Size the mirror as `min(leader proportion, per-trade max, budget remaining)`.
   Quote, then `execute([approve(USDT, router, size), swap(size, quote minus
   slippage, path, wallet, now+600)])`.
6. Verify your token balance increased onchain. Report the mirror: the leader's tx
   hash you acted on, your tx hash, the token, and the amounts on both sides.
7. Repeat until the budget is exhausted. When it is, stop opening new mirrors and
   say so.

### Play: mirror-exit

When the leader sells a token you also hold, sell the same fraction of your
position. Parameters: leader wallet (required, the one already being followed).

**Typical time:** ~15s per exit

1. In the same watch loop, detect leader sells: a `Swap` with topic 2 = leader where
   the token out is USDT or WBNB, paired with the leader sending the sold token in.
2. Compute the fraction of its position the leader sold. Apply that same fraction to
   your holding of that token.
3. Read your live balance of the token, quote the reverse path, then
   `execute([approve(TOKEN, router, sellAmount), swap(...)])` with a fresh
   `amountOutMin`.
4. Verify USDT increased and the token balance dropped by the intended fraction.
   Report the leader's sell tx and yours.

### Play: stop

Halt following and report the result. Parameters: leader wallet.

**Typical time:** ~10s

1. Stop polling. Open no new mirrors.
2. For each token you copied, read your live balance and quote its USDT value with
   `getAmountsOut`. Sum against the USDT you spent to get realized and unrealized
   P&L of the copied positions.
3. Report per position and in total: USDT spent, current value, and net result.
   Positions you still hold are marked open; note that the `mirror-exit` and
   `pancakeswap-trading` exit plays can close them.

## Guards (do not remove)

- The leader wallet is required and must be given to you explicitly. Never infer,
  guess, derive, or discover one: not from a trending list, not from an address you
  saw in this document or in an example, not from a wallet you followed in an earlier
  session. If no leader address was provided, ask for it and do nothing else until you
  have it. Copying an unnamed wallet is the one failure the caps cannot bound, because
  the person never chose who they are following.
- The per-trade max and the total budget are required in the same way. The registry
  offers starting figures the person confirms when the session is granted, so a value
  they accepted is a value they chose. A number you picked yourself is not. If either
  is missing, ask.
- Echo the leader address, the per-trade max, and the total budget back before the
  first mirror, and act only on the values you were given.
- Never exceed the per-trade max on any single mirror, and never let cumulative USDT
  spent cross the total budget. Both are hard ceilings enforced by the session cap;
  a mirror that would breach either is not sent.
- Never mirror a token that fails the liquidity screen. Screen before every buy;
  a data gap is a reason to skip, not to guess.
- Mirror both sides. If you copy the leader's buys you must also copy its sells; a
  one-sided copy that only buys is not allowed. When the leader exits, you exit the
  same fraction.
- The leader can rug or dump on you at any time. That is expected. Your loss is
  bounded by the session budget and nothing you copy can move more than the cap.
  Do not raise the cap to "keep up" with the leader.
- Always report the leader tx hash you acted on alongside your own. Every mirror
  names the trade it copied.
- `amountOutMin` is always a fresh quote minus slippage, never 0. Verify balances
  onchain after each leg and report only what the chain confirms.
