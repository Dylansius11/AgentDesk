---
name: pancakeswap-liquidity
description: Provide and withdraw liquidity on PancakeSwap V2 on BNB Chain through an Altana session. Pair two tokens at the pool ratio to mint LP tokens, check a position's share and underlying value, and burn LP back to both tokens.
---

# PancakeSwap Liquidity

Provide liquidity to PancakeSwap V2 pools on BNB Chain as an Altana session. You deposit
two tokens at the pool's current ratio and receive an LP token; the LP token is the pair
contract itself. Submit onchain writes only through your Altana session executor
(`execute(calls)` with the SDK, or the `session_execute` MCP tool). Reads can go directly
against the RPC.

## Reference

Everything you need to add and remove liquidity well: the right contracts, how to size
deposits to the live pool ratio, and the approvals each leg needs.

### Addresses (BNB Chain mainnet)

| Contract | Address |
|---|---|
| PancakeSwap V2 Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |
| PancakeSwap V2 Factory | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |
| USDT (BSC-USD) | `0x55d398326f99059fF775485246999027B3197955` |
| USDT/WBNB pair (LP token) | `0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE` |

Find any other pair with `factory.getPair(tokenA, tokenB)`. The returned address is both
the pool and the LP token you hold.

### Quirks that cause mistakes

- Deposits must match the live pool ratio. Read `getReserves()` on the pair and size the
  second amount with `quote`: `amountBOptimal = amountA * reserveB / reserveA`. Send a
  desired amount that matches; the router pulls only what the ratio allows and refunds the
  rest, so any excess of one side sits idle.
- `getReserves()` returns `(reserve0, reserve1, blockTimestampLast)` ordered by
  `token0` / `token1`, which are sorted by address, not by the order you pass. Check
  `token0()` on the pair to map reserves to tokens. For USDT/WBNB, `token0` is USDT.
- USDT on BNB Chain has 18 decimals, not 6 like Ethereum. $20 is `20n * 10n**18n`.
- Approve both input tokens to the router before `addLiquidity`. Approve the LP token
  (the pair) to the router before `removeLiquidity`; without it the burn reverts.
- The min amounts guard against ratio drift between quoting and mining. Set
  `amountAMin` / `amountBMin` to a few percent under desired. Never 0.
- `deadline`: unix seconds, now + 600.
- Concentrated liquidity (PancakeSwap V3 and Infinity) is a different product with price
  ranges and NFT positions. It is not covered by this skill; this skill is V2 only.

### Router functions (Uniswap V2 style)

- Add: `addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)`
- Remove: `removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB)`
- Pair reads: `getReserves() returns (uint112, uint112, uint32)`, `totalSupply() returns (uint256)`, `balanceOf(address) returns (uint256)`, `token0()`, `token1()`.

## Playbook

### Play: add-liquidity

Pair two tokens at the pool ratio and receive LP tokens. Parameters: tokenA, tokenB,
amount of one side (the other is derived), slippage (default 1%).

**Typical time:** ~15s

1. Resolve the pair with `factory.getPair(tokenA, tokenB)`. Read `token0()` and
   `getReserves()` to map reserves to your tokens.
2. Pick the amount of one side. Derive the other with
   `amountBDesired = amountA * reserveB / reserveA`. Set each min to desired minus slippage.
3. `execute([approve(tokenA, router, amountADesired), approve(tokenB, router, amountBDesired), addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, wallet, now+600)])`
4. Verify the LP token balance (`pair.balanceOf(wallet)`) increased before reporting success.

### Play: remove-liquidity

Burn LP tokens back to both underlying tokens, full or partial. Parameters: pair (or the
two tokens), amount of LP or "all".

**Typical time:** ~15s

1. For "all", read the live LP balance (`pair.balanceOf(wallet)`) and use the full amount.
2. Estimate the tokens you should get back from your share: `reserveX * liquidity / totalSupply`
   for each side. Set `amountAMin` / `amountBMin` to a few percent under those estimates.
3. `execute([approve(pair, router, liquidity), removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, wallet, now+600)])`
4. Verify both token balances increased and the LP balance dropped by the burned amount.

### Play: position-check

Report a position's size without changing anything. Parameters: pair (or the two tokens).

**Typical time:** ~5s, reads only

1. Read `pair.balanceOf(wallet)` (your LP), `pair.totalSupply()` (all LP), and
   `pair.getReserves()`.
2. Your pool share is `balanceOf / totalSupply`. Your underlying is
   `reserveX * balanceOf / totalSupply` for each token.
3. Report the LP balance, the share as a percent, and the two underlying amounts. No
   session write is needed for a check.

## Guards (do not remove)

- `amountAMin` / `amountBMin` are always desired minus slippage, never 0.
- Size the second deposit from a fresh `getReserves` read; never assume a 50/50 or a
  stale ratio.
- Verify balances onchain after each leg; report only what the chain confirms.
- Approve the LP token to the router before removing; the burn reverts otherwise.
- This skill is PancakeSwap V2 only. Do not improvise V3 or Infinity concentrated
  positions, and do not act outside the session scope.
