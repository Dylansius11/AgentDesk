---
name: aave-v3-lending
description: Lend stablecoins on Aave V3 on BNB Chain through an Altana session. Supply USDT to earn yield, check your position, and withdraw on command. Supply and withdraw only, no borrowing.
---

# Aave V3 Lending

Supply and withdraw USDT on the Aave V3 market on BNB Chain as an Altana session.
This skill covers supply and withdraw only; it does not cover borrowing. Submit
onchain writes only through your Altana session executor; reads can go directly
against the RPC.

## Reference

### Addresses (BNB Chain mainnet)

| Contract | Address |
|---|---|
| Aave V3 Pool | `0x6807dc923806fE8Fd134338EABCA509979a7e0cB` |
| aBnbUSDT (Aave USDT aToken) | `0xa9251ca9DE909CB71783723713B21E4233fbf1B1` |
| USDT (BSC-USD) | `0x55d398326f99059fF775485246999027B3197955` |

The Pool and aToken were confirmed against BNB mainnet: the Pool reports
`POOL_REVISION` 11 and the official Aave addresses provider
`0xff75B6da14FfbbfD355Daf7a2731456b3562Ba6D`. The aToken address is what the Pool
itself returns from `getReserveData(USDT)`; that token reports symbol `aBnbUSDT`
and `UNDERLYING_ASSET_ADDRESS` equal to USDT.

### How Aave V3 lending works

- You supply the underlying asset to the Pool and receive an equal amount of the
  aToken (aBnbUSDT for USDT). The aToken is a rebasing receipt: its `balanceOf`
  grows in place as interest accrues, always 1:1 with the underlying you can
  withdraw. There is no exchange rate to convert.
- Supply: `approve(Pool, amount)` on USDT, then
  `Pool.supply(asset, amount, onBehalfOf, referralCode)` with `asset` = USDT,
  `onBehalfOf` = your wallet, and `referralCode` = 0.
- Withdraw a specific amount: `Pool.withdraw(asset, amount, to)`.
  Withdraw everything: `Pool.withdraw(asset, type(uint256).max, to)`; the max
  sentinel means the Pool withdraws your full aToken balance.
- Position value: read `balanceOf(wallet)` on the aToken. That number is your
  live position in underlying units, interest included.
- Supply APY: read `getReserveData(USDT)` and take the current liquidity rate
  (the third field, `currentLiquidityRate`), a per-year rate in ray (1e27).
  Dividing it by 1e27 gives the rate as a fraction, so about
  `currentLiquidityRate / 1e27 * 100` percent.
- USDT has 18 decimals on BNB Chain, and aBnbUSDT also has 18 decimals.

### Quirks that cause mistakes

- The aToken rebases in place: do not expect a fixed receipt amount, and do not
  divide by any exchange rate. `balanceOf` is already the withdrawable underlying.
- Withdrawing with `type(uint256).max` withdraws the entire position, not a max of
  some cap. Use a concrete amount for a partial withdraw.
- Supply reverts if the reserve is paused or frozen. Withdraw reverts if the
  reserve is paused. A frozen reserve still allows withdraw but blocks new supply.
- Withdraw can revert if the Pool lacks available liquidity for a large amount, or
  if withdrawing would drop your position below what open borrows require. This
  skill does not borrow, so the borrow constraint does not apply here.

## Playbook

### Play: supply

Lend USDT to earn yield. Parameters: USDT amount.

**Typical time:** ~15s

1. `execute([approve(USDT, Pool, amount), Pool.supply(USDT, amount, wallet, 0)])`
2. Verify the aBnbUSDT balance increased by the amount (allow a tiny rounding
   tolerance from rebasing) and USDT decreased by the amount. Report the position
   value from the aToken `balanceOf`.

### Play: withdraw

Withdraw part or all of the position. Parameters: amount or "all".

**Typical time:** ~15s

1. For a partial amount: `execute([Pool.withdraw(USDT, amount, wallet)])`.
   For "all": `execute([Pool.withdraw(USDT, type(uint256).max, wallet)])`.
2. Verify USDT increased and the aBnbUSDT balance decreased (to about zero for a
   full withdraw). Report amounts and tx hashes.

### Play: position-check

Read-only status. No transaction. Parameters: none.

**Typical time:** ~5s

Read `balanceOf(wallet)` on the aToken for the live position value in USDT, read
`getReserveData(USDT)` and take `currentLiquidityRate` (ray, 1e27), and report the
position value and the supply APY as `currentLiquidityRate / 1e27 * 100` percent.

## Guards (do not remove)

- After every supply or withdraw, verify balances changed as expected before
  reporting success.
- Never approve more than the amount being supplied in this action.
- Treat the aToken `balanceOf` as the position value directly; never apply an
  exchange rate to it.
- Use `type(uint256).max` only when the intent is to withdraw the entire position.
