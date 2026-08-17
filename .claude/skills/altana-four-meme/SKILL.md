---
name: four-meme
description: Buy and sell memecoins on Four.meme bonding curves on BNB Chain through an Altana session. Quote with the helper, spend native BNB on the curve, check graduation, and hand off to PancakeSwap once a token graduates.
---

# Four.meme Trading

Trade memecoins on Four.meme, BNB Chain's dominant launchpad, as an Altana session.
Tokens trade on a bonding curve inside TokenManager2 until they graduate to
PancakeSwap. Submit onchain writes only through your Altana session executor
(`execute(calls)` with the SDK, or the `session_execute` MCP tool). Reads, including
every quote, can go directly against the RPC.

## Reference

Everything you need to trade the curve well: the right contracts, how to quote,
how buys spend native BNB, and how to tell when a token has graduated.

### Addresses (BNB Chain mainnet)

| Contract | Address |
|---|---|
| TokenManager2 (curve, V2) | `0x5c952063c7fc8610FFDB798152D69F0B9550762b` |
| TokenManagerHelper3 (quotes and status) | `0xF251F83e40a78868FcfA3FA4599Dad6494E46034` |
| PancakeSwap V2 Router (after graduation) | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |

### Quirks that cause mistakes

- Curve buys spend native BNB as `msg.value`, not an ERC20. The session must be
  allowed to send native value to TokenManager2. Always size the value from a fresh
  quote, never from a guess.
- The raised token is per token. For the common case it is native BNB, and
  `getTokenInfo` returns `quote` as the zero address. Some tokens raise in an ERC20
  such as USD1. Read `tryBuy` first: if `amountMsgValue` is nonzero you send that as
  BNB value; if `amountApproval` is nonzero you approve that ERC20 to TokenManager2
  and send zero value.
- Selling returns BNB. Approve the token to TokenManager2 before selling, then call
  `sellToken`. Selling needs no native value.
- Four.meme tokens use 18 decimals.
- Graduation: `getTokenInfo` returns `liquidityAdded`. Once it is true the token has
  left the curve and trades on PancakeSwap V2. Curve buys and sells revert after
  graduation, so switch to the router.
- Curve progress: compare `funds` to `maxFunds` (BNB raised so far against the
  graduation target), or `offers` to `maxOffers` (curve token supply). When funds
  reach the target the token graduates.
- Some tokens are TaxTokens with their own transfer fees. The curve quote already
  includes the trading fee, but a token's transfer tax can still reduce what actually
  lands in the wallet, so verify the received balance rather than trusting the quote.

### Helper functions (reads, TokenManagerHelper3)

- Status: `getTokenInfo(address token) returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)`
- Buy quote: `tryBuy(address token, uint256 amount, uint256 funds) returns (address tokenManager, address quote, uint256 estimatedAmount, uint256 estimatedCost, uint256 estimatedFee, uint256 amountMsgValue, uint256 amountApproval, uint256 amountFunds)`. Pass `amount` = 0 and `funds` = the BNB you want to spend to quote by spend; `amountMsgValue` is the exact BNB value to send.
- Sell quote: `trySell(address token, uint256 amount) returns (address tokenManager, address quote, uint256 funds, uint256 fee)`. `funds` is the BNB you would receive before your min.

### Curve functions (writes, TokenManager2)

- Buy: `buyTokenAMAP(address token, uint256 funds, uint256 minAmount)` payable. `funds`
  is the BNB you spend, and you send it as value; `minAmount` is the buy quote's
  `estimatedAmount` minus 1 to 5 percent slippage. Never 0.
- Sell: `sellToken(address token, uint256 amount, uint256 minFunds)`. `minFunds` is the
  sell quote's `funds` minus 1 to 5 percent slippage. Never 0.

## Playbook

### Play: check-curve-status

Report where a token sits on the curve and whether it has graduated. Parameters:
token address.

**Typical time:** ~5s

1. Read `getTokenInfo(token)`.
2. If `liquidityAdded` is true, report graduated and point at PancakeSwap.
3. Otherwise report progress as `funds` against `maxFunds` and the last price.

### Play: buy-on-curve

Buy a token on its bonding curve with BNB. Parameters: token address, BNB to spend,
slippage (default 3%).

**Typical time:** ~15s

1. Confirm the token has not graduated with `getTokenInfo`.
2. Quote with `tryBuy(token, 0, fundsToSpend)`. Read `amountMsgValue` and
   `estimatedAmount`.
3. `execute([{ to: TokenManager2, data: buyTokenAMAP(token, fundsToSpend, estimatedAmount minus slippage), value: amountMsgValue }])`
4. Verify the token balance increased before reporting success.

### Play: sell-on-curve

Sell part or all of a curve position back to BNB. Parameters: token address, amount or
"all".

**Typical time:** ~15s

1. For "all", read the live token balance and use the full amount.
2. Quote with `trySell(token, amount)`. Read `funds`.
3. `execute([approve(token, TokenManager2, amount), sellToken(token, amount, funds minus slippage)])`
4. Verify the BNB balance increased and the token balance decreased.

### Play: round-trip

In and out in one move: buy, confirm, sell. Parameters: token, BNB to spend, slippage.

**Typical time:** ~50s including your own verification reads

Write one script that quotes with `tryBuy`, buys with the returned `amountMsgValue` as
value, reads the received token balance in the same run, then quotes with `trySell`,
approves, and sells that exact balance back. One script, three transactions, no pauses
between steps. Verify final balances onchain and report amounts and tx hashes.

### Play: graduation-handoff

Trade a token that has already graduated. Parameters: token, side, amount.

**Typical time:** ~15s

1. Read `getTokenInfo`. If `liquidityAdded` is true, the curve is closed.
2. Trade the token on PancakeSwap V2 through the router instead, quoting the
   `[WBNB, TOKEN]` path with `getAmountsOut`. See the pancakeswap-trading skill for the
   router playbook.
3. Never send curve calls for a graduated token; they revert.

## Guards (do not remove)

- Size every buy's value and every sell's min from a fresh `tryBuy` or `trySell`. Never
  send a guessed native value, and never set `minAmount` or `minFunds` to 0.
- Check `liquidityAdded` before any curve write. If it is true, hand off to PancakeSwap.
- Verify balances onchain after each leg; report only what the chain confirms.
- If a curve call reverts, requote once with 1 percent more slippage and retry a single
  time; otherwise stop and report. Do not improvise outside the session scope.
