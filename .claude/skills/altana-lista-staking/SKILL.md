---
name: lista-staking
description: Liquid stake BNB on Lista DAO through an Altana session. Deposit native BNB to receive slisBNB, check your position and the exchange rate, and run the two-step async withdrawal (request now, claim after the unbonding period).
---

# Lista Liquid Staking

Liquid stake BNB with Lista DAO on BNB Chain as an Altana session. Deposit native
BNB into the ListaStakeManager and receive slisBNB, a reward-bearing token whose
value in BNB grows over time. Submit onchain writes only through your Altana session
executor (`execute(calls)` with the SDK, or the `session_execute` MCP tool). Reads,
including the exchange rate and your withdrawal requests, can go directly against the
RPC.

## Reference

### Addresses (BNB Chain mainnet)

| Contract | Address |
|---|---|
| ListaStakeManager (deposit BNB, get slisBNB) | `0x1adB950d8bB3dA4bE104211D5AB038628e477fE6` |
| slisBNB (Staked Lista BNB) | `0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B` |

### How Lista liquid staking works

- Staking is a native BNB deposit: call `deposit()` payable on the ListaStakeManager
  with the BNB you want to stake as `msg.value`. The manager mints slisBNB to your
  wallet. The session must be allowed to send native value to the manager.
- slisBNB is reward-bearing, not rebasing: your balance stays fixed and each slisBNB
  is worth more BNB over time. One slisBNB is worth more than one BNB, so a deposit of
  1 BNB mints fewer than 1 slisBNB. Read the rate before staking; never assume 1:1.
- Exchange rate reads on the manager:
  - `convertBnbToSnBnb(uint256 bnbAmount) view returns (uint256)` is the slisBNB you
    receive for a given BNB deposit.
  - `convertSnBnbToBnb(uint256 slisBnbAmount) view returns (uint256)` is the BNB a
    given slisBNB balance is currently worth.
- Withdrawing is asynchronous and two-step (see the quirks below).
- slisBNB has 18 decimals. BNB is native (18 decimals).

### Withdrawal flow (two steps, with an unbonding wait between)

You cannot swap slisBNB back to BNB on the manager in one call. The flow mirrors BNB
Chain native unstaking:

1. `requestWithdraw(uint256 amountInSlisBnb)` burns/escrows that slisBNB and records a
   pending withdrawal request against your address. This transfers slisBNB from your
   wallet into the manager, so you must `approve(manager, amountInSlisBnb)` on slisBNB
   first.
2. Wait out the unbonding period (the BNB staking cooldown, roughly 7 to 15 days).
   The request is not claimable until it elapses.
3. `claimWithdraw(uint256 index)` pays out the BNB for a matured request. `index` is
   the position in your request list.

Because the cooldown spans days, a stake and its claim never happen in one session.
Stake and request are immediate; the claim is a separate later action.

### Withdrawal reads (manager)

- `getUserWithdrawalRequests(address user) view returns ((uint256 uuid, uint256 amountInSnBnb, uint256 startTime)[])`
  is the list of your pending requests. Each entry carries a `uuid`, the
  `amountInSnBnb` (slisBNB) requested, and the `startTime`. A fresh entry appears here
  the moment `requestWithdraw` lands.
- `getUserRequestStatus(address user, uint256 index) view returns (bool isClaimable, uint256 amount)`
  tells you whether request `index` has matured (`isClaimable`) and the BNB `amount`
  it will pay. It reverts with "Invalid index" if the request does not exist. Poll
  this and only call `claimWithdraw(index)` once `isClaimable` is true.

### Quirks that cause mistakes

- Stake spends native BNB as `msg.value` on `deposit()`, not an ERC20. Size the value
  from the amount you intend to stake, and expect slisBNB back at the current rate,
  which is less than the BNB sent because slisBNB is worth more than BNB.
- `requestWithdraw` pulls slisBNB via `transferFrom`. Without a prior slisBNB approve
  to the manager it reverts with "ERC20: insufficient allowance". Approve exactly the
  amount you are requesting.
- The claim is gated by the unbonding period. Right after a request,
  `getUserRequestStatus` returns `isClaimable = false`. Do not call `claimWithdraw`
  until it flips true, or the claim reverts.
- Verify the slisBNB received (stake) and the request recorded (withdraw) by reading
  onchain state; do not trust the amount you sent.

## Playbook

### Play: stake

Liquid stake BNB and receive slisBNB. Parameters: BNB amount.

**Typical time:** ~15s

1. Read `convertBnbToSnBnb(bnbAmount)` on the manager for the expected slisBNB out.
2. `execute([{ to: ListaStakeManager, data: deposit(), value: bnbAmount }])`
3. Verify the slisBNB balance increased by roughly the expected amount and report the
   slisBNB received and the tx hash.

### Play: unstake-request

Start an async withdrawal of a slisBNB amount back to BNB. Parameters: slisBNB amount
or "all".

**Typical time:** ~15s

1. For "all", read the live slisBNB `balanceOf(wallet)` and use the full balance.
2. `execute([approve(slisBNB, ListaStakeManager, amount), requestWithdraw(amount)])`
3. Verify the slisBNB balance dropped by the amount and read
   `getUserWithdrawalRequests(wallet)` to confirm a new request is recorded. Report
   the request index and that the BNB becomes claimable after the unbonding period
   (roughly 7 to 15 days). Do not attempt to claim in this run.

### Play: claim (after the unbonding period)

Claim a matured withdrawal request. Parameters: request index (default 0). Run this
only days after `unstake-request`, once the cooldown has elapsed.

**Typical time:** ~15s

1. Read `getUserRequestStatus(wallet, index)`. If `isClaimable` is false, report that
   the request has not matured and stop; do not send a claim.
2. If true, `execute([{ to: ListaStakeManager, data: claimWithdraw(index) }])`.
3. Verify the native BNB balance increased by about the status `amount` and report the
   BNB claimed and the tx hash.

### Play: position-check

Read-only status. No transaction. Parameters: none.

**Typical time:** ~5s

Read slisBNB `balanceOf(wallet)`, convert it to BNB with
`convertSnBnbToBnb(balance)` for the position value, and read
`getUserWithdrawalRequests(wallet)` for any pending withdrawals. Report the slisBNB
held, its current BNB value, and the state of any pending requests.

## Guards (do not remove)

- Size the stake value from the BNB you intend to stake and expect less slisBNB back;
  never assume a 1:1 rate. Read `convertBnbToSnBnb` first.
- Before `requestWithdraw`, approve exactly the slisBNB amount being requested to the
  manager, never more.
- Never call `claimWithdraw` until `getUserRequestStatus` reports the request
  claimable; an early claim reverts.
- Verify onchain state after each leg (slisBNB balance for a stake, the recorded
  request for a withdrawal, native BNB for a claim); report only what the chain
  confirms.
