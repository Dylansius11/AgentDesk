---
name: x402-payments
description: Pay for APIs and services over HTTP with the x402 protocol from an Altana session. Per-use payments in stablecoins, no accounts or cards, spend-capped and revocable.
---

# x402 API Payments

Pay for HTTP resources that respond with `402 Payment Required` using the x402
protocol, from an Altana session wallet. Works for paid APIs, data feeds, and agent to
agent services (including Binance's B402 marketplace on BNB Chain).

## Reference

### How x402 works

1. You request a resource; the server responds `402` with payment requirements
   (`accepts` list: scheme, network, asset, amount, receiver).
2. You sign a payment authorization with your wallet (no onchain transaction from you;
   the facilitator settles it) and retry the request with the `X-PAYMENT` header.
3. The server verifies, settles, and returns the resource plus a settlement receipt.

### With the Altana SDK

`fetchWithX402(session, url, init?)` from `@altananetwork/sdk` does the whole loop:
fetches, reads requirements, signs with the session, retries, and returns the final
response. In an MCP host, the `x402_request` tool does the same.

### Quirks that matter

- Amounts are in the asset's smallest unit; USDT on BNB Chain has 18 decimals.
- The session signs with ERC-1271 through the smart account: the paying wallet is the
  smart account address, not the session key address.
- Rails on BNB Chain use Permit2 with USDT. The wallet needs a one-time USDT approval
  to Permit2, which the SDK handles on first payment.
- Payments count against the session's spend cap like any other outflow, and the
  session must not be expired.

## Playbook

### Play: pay-once

Fetch one paid resource. Parameters: URL, maximum acceptable price.

**Typical time:** ~10s

1. Call `fetchWithX402(session, url)`.
2. Before signing, compare the server's asked amount with the maximum price parameter;
   refuse and report if it asks for more.
3. Return the response body and the settlement receipt (tx hash if provided).

### Play: auto-refill

Keep a metered service topped up. Parameters: URL, per-payment maximum, total budget.

**Typical time:** runs until budget is spent

Loop pay-once against the service's top-up endpoint whenever its balance endpoint
reports low credit. Stop when the total budget parameter is spent, and report each
payment as it happens.

## Guards (do not remove)

- Always enforce the maximum price parameter; never sign an authorization above it.
- Track cumulative spend across the run and stop at the stated budget.
- Only pay endpoints the user named. Never follow a 402 from a redirect to a different
  host without reporting first.
