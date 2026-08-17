---
name: venus-lending
description: Lend stablecoins on Venus Protocol on BNB Chain through an Altana session. Supply USDT to earn yield, check your position, and withdraw on command.
---

# Venus Lending

Supply and withdraw USDT on Venus Protocol (core pool) on BNB Chain as an Altana
session. Submit onchain writes only through your Altana session executor; reads can go
directly against the RPC.

## Reference

### Addresses (BNB Chain mainnet)

| Contract | Address |
|---|---|
| vUSDT (Venus USDT market, core pool) | `0xfD5840Cd36d94D7229439859C0112a4185BC0255` |
| USDT (BSC-USD) | `0x55d398326f99059fF775485246999027B3197955` |

### How Venus core pool markets work

- A market is a vToken contract. Supplying the underlying mints vTokens; the exchange
  rate between vToken and underlying grows over time, which is how interest accrues.
- Supply: `approve(vUSDT, amount)` on USDT, then `vUSDT.mint(uint256 amount)`.
  `mint` returns 0 on success (Compound-style error codes, it does not revert on some
  failures). Always verify by reading balances after.
- Withdraw by underlying amount: `vUSDT.redeemUnderlying(uint256 amount)`; withdraw
  everything: `vUSDT.redeem(uint256 vTokenAmount)` with your full vToken balance.
- Position value: `balanceOfUnderlying(address)` (non-view, call it with a static call)
  or `balanceOf(address)` times `exchangeRateStored()` divided by 1e18.
- USDT has 18 decimals on BNB Chain. vUSDT has 8 decimals.

### Quirks that cause mistakes

- Compound-style calls return error codes instead of reverting. A transaction can
  succeed while the operation failed. Verify the vToken balance actually changed.
- `balanceOfUnderlying` is not a view function; use a static call to read it.
- Redeeming can fail if the market lacks liquidity; check `getCash()` first for large
  amounts.

## Playbook

### Play: supply

Lend USDT to earn yield. Parameters: USDT amount.

**Typical time:** ~15s

1. `execute([approve(USDT, vUSDT, amount), vUSDT.mint(amount)])`
2. Verify vUSDT balance increased and USDT decreased by the amount. Report the position
   value via a static call to `balanceOfUnderlying`.

### Play: withdraw

Withdraw part or all of the position. Parameters: amount or "all".

**Typical time:** ~15s

1. For a partial amount: `execute([vUSDT.redeemUnderlying(amount)])`.
   For "all": read `balanceOf(wallet)` on vUSDT and `execute([vUSDT.redeem(fullVTokenBalance)])`.
2. Verify USDT increased and vUSDT decreased. Report amounts and tx hashes.

### Play: position-check

Read-only status. No transaction. Parameters: none.

**Typical time:** ~5s

Static-call `balanceOfUnderlying(wallet)`, read `exchangeRateStored` and the current
supply rate `supplyRatePerBlock()`, and report the position value and approximate APY
(rate per block times blocks per year, about 10.5M on BNB Chain).

## Guards (do not remove)

- After every mint or redeem, verify balances changed as expected; success of the
  transaction alone does not mean the operation succeeded.
- Never approve more than the amount being supplied in this action.
- If a redeem fails, check `getCash()` and report the market liquidity rather than
  retrying blindly.
