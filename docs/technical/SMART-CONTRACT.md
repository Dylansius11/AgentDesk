# AgentDesk — Smart Contract Design

| | |
|---|---|
| **Version** | 1.0 · 2026-08-16 |
| **Location** | `packages/contracts` (Foundry) |
| **Doctrine** | **One original contract, zero re-implementations of official standards.** Our moat is the *ProofLedger*; hiring/identity/payments use ERC-8183 + ERC-8004 + x402 as BNB ships them. Immutability *is* the product — no proxies, no upgradeability, no admin keys that can edit history. |

---

## 1. Contract inventory

| Contract | Origin | Chain | Purpose |
|---|---|---|---|
| **ProofLedger** | ours (this doc) | BSC Chapel → BSC mainnet | Append-only registry of pre-registered decisions + attested outcomes per ERC-8004 agent |
| ERC-8004 registries | external standard | BSC (existing deployments) | Agent identity — read/reference only |
| ERC-8183 escrow | external standard (via Altana SDK / reference impl) | BSC | Hire escrow — invoked, never redeployed |
| x402 facilitator/settlement | external (Coinbase/Binance infra) | BSC | USD1 payments — configured, not deployed |
| (P2) StakeRegistry | ours, post-hackathon | BSC | Staked listings + slashing (TermiX-aligned) |

## 2. ProofLedger — the moat, specified

### 2.1 Design goals

1. **Unfakeable:** a record exists only if it was on-chain *before* execution; outcomes only after deadlines.
2. **Append-only:** no function can mutate or remove history. Ever. (Invariant-tested.)
3. **Cheap:** decision registration must cost less than the trade it covers — minimal storage, event-heavy.
4. **Objective:** the ledger records *what happened*; profit resolution uses external objective sources, hashed into evidence.
5. **ERC-8004-native:** keyed by the agent's existing on-chain identity — reputation accrues to the agent, not to our platform.

### 2.2 Interface (solidity sketch — canonical source is `packages/contracts/src/ProofLedger.sol`)

```solidity
interface IProofLedger {
    // ── pre-execution (agent runner calls; before the action) ──
    function registerDecision(
        uint256 agentId,          // ERC-8004 agent id
        bytes32 intentHash,       // keccak256(abi.encode(actionType, market, direction, params, sizeUsd1, nonce))
        uint64  deadline          // after this, attestation resolves win/loss/neutral/expired
    ) external returns (uint256 recordId);

    // ── post-deadline (ATTESTER role: AgentDesk keeper in v1) ──
    function attestOutcome(
        uint256 recordId,
        int8    status,           // 1 win | -1 loss | 0 neutral | 2 expired-unexecuted
        int128  pnlUsd1,          // resolved from objective sources (pool/protocol state)
        bytes32 evidenceHash      // keccak256(abi.encode(intentHash, executionTx, resolutionSource, prices))
    ) external;

    // ── reads ──
    function getDecision(uint256 recordId) external view
        returns (address registrant, uint256 agentId, bytes32 intentHash,
                 uint64 deadline, uint256 registeredAt, bool resolved);
    function getOutcome(uint256 recordId) external view
        returns (int8 status, int128 pnlUsd1, bytes32 evidenceHash, uint256 attestedAt);
    function recordCount(uint256 agentId) external view returns (uint256);

    event DecisionRegistered(uint256 indexed recordId, uint256 indexed agentId,
                             bytes32 intentHash, uint64 deadline, uint256 registeredAt);
    event OutcomeAttested(uint256 indexed recordId, uint256 indexed agentId,
                          int8 status, int128 pnlUsd1, bytes32 evidenceHash, uint256 attestedAt);
}
```

### 2.3 Access model & anti-gaming

| Concern | Mechanism |
|---|---|
| Who registers decisions? | **Anyone can pay gas to register for any agentId** — but registrant identity doesn't matter; only *timing* does. (Agents register for themselves in practice.) |
| Pre-execution guarantee | `registeredAt < deadline` enforced; execution tx included in `evidenceHash`; indexer verifies `decision.block < execution.block`. A trade without a prior decision record simply has **no proof record** — it can't count. |
| Who attests? | `ATTESTER_ROLE` (v1: single keeper EOA → move to multi-set + timelock post-hackathon; see §6). Attestations are *claims with on-chain accountability* — every attestation is signed, timestamped, and disputable via evidence hash. |
| Can devs delete losses? | **No.** No update/delete functions exist. Invariant-fuzz-tested (§5). Mirror table in Postgres is insert-only at the application layer. |
| Dust-flooding (farm fake wins) | Rankings are **return-weighted** (pnlUsd1-weighted), computed off-chain from on-chain rows — dust tasks produce dust rankings. Additionally `intentHash` must commit `sizeUsd1 ≥ minSizeUsd1` (configurable constant, e.g., $5) for ranking-eligible records. |
| Self-attestation risk | Attester never derives pnl from agent input — resolution reads pool/protocol state (see §4). Post-hackathon: staked attester set + dispute window. |
| Front-running the deadline | `deadline ≤ registeredAt + MAX_WINDOW` (e.g., 24h) — stale pre-registrations can't cover future trades. |

### 2.4 Gas & cost targets (BSC, ~1–3 gwei)

| Op | Storage | Est. gas | Why it's cheap |
|---|---|---|---|
| registerDecision | 3 slots + events | ~85k | hashes only, no payload |
| attestOutcome | 3 slots + events | ~60k | fixed-size words |

Decision+outcome ≈ $0.01–0.05 total on BSC — *cheap enough to cover every trade an agent makes*; protocol fee (3%) comfortably subsidizes attestation gas for listed agents.

## 3. Interaction with external contracts (we integrate, we don't duplicate)

```
agent runner ──registerDecision──▶ ProofLedger (ours)
agent runner ──execute via skills──▶ PancakeSwap / Venus / Aave / Lista
user wallet ──hireErc8183Agent───▶ ERC-8183 escrow (external)  + Altana Keystore session
keeper ──────attestOutcome────────▶ ProofLedger
escrow release ◀─attestation────── ERC-8183 evaluator hook (keeper fulfills evaluator role v1)
payments ────x402 USD1────────────▶ facilitator (external) w/ 3% fee routing
```

**Evaluator stance:** ERC-8183's evaluator role is played by our keeper in v1, resolving from objective state (§4). This keeps the escrow flow 100% standard while our quality bar for attestation lives in the keeper + ProofLedger evidence. Post-hackathon: decentralized evaluator set.

## 4. Outcome resolution sources (keeper spec)

| Category | Objective source | Win/loss definition |
|---|---|---|
| Grid | PancakeSwap v3 Quoter/pool price at deadline vs grid bands committed in intent | band hit within window + fees > 0 |
| Rebalance | Pool position state: range re-centering delta vs committed target | range utilisation Δ > threshold |
| Yield | Farm/pool APY snapshots + position shares | realised yield ≥ committed target band |
| Health | Venus/Aave position state: HF before vs after | HF lifted above committed threshold when triggered |

All snapshots hashed into `evidenceHash` and mirrored in `proof_records.evidence_uri` bundles → the `/verify` page can re-derive every metric without trusting us.

## 5. Testing plan (Foundry)

1. **Unit:** register→attest happy path; deadline enforcement; role gating; duplicate attestation reverts.
2. **Invariant/fuzz:** *ledger is append-only* (state diff fuzz — no sequence of calls ever alters existing rows); recordId monotonicity; agent-record mapping integrity under random agents.
3. **Fork tests (Chapel fork):** end-to-end — agent decision → real PancakeSwapV3Pool swap → keeper resolution → attestation; Venus HF flow for HealthGuard.
4. **Gas snapshots** in CI (`forge snapshot`) — fail build if registerDecision > 120k gas.
5. **Deployment:** `forge script` per environment; verify on BscScan immediately; addresses pinned to INTEGRATION.md in the same commit.

## 6. Security posture & privileged keys

| Risk | v1 (hackathon) | Post-hackathon |
|---|---|---|
| ATTESTER goes rogue | Single keeper EOA, gas-capped, monitored; all attestations carry evidence hashes (disputable) | Staked attester set + dispute window + slashing |
| Add rogue ATTESTER | `SET_ATTESTER` guarded by 2-of-2 (deployer multisig + timelock) | DAO/committee |
| Upgrade trap | **None — immutable, no proxy** | Same |
| Rug surface | Contract holds **no funds** (escrow lives in ERC-8183 external contracts) | Same |
| Key ops | `KEEPER_ATTESTER_KEY` in Railway env only; never in repo; rotation runbook in CLAUDE.md | HSM/multisig |

**Deliberate sacrifices (documented, not accidental):** no upgradeability (immutability > patchability for a trust product); single attester in v1 (speed > decentralization during a 3-week hackathon, with a clean migration path because attestations are role-gated, not hardcoded).

## 7. P2 — StakeRegistry (sketch only; do not build before Sep 9)

Listing stake (USD1) slashable on proven misbehavior (attested false intent ↔ execution mismatch). Aligns with TermiX's staked-reputation model; slashing funds a user-protection pool. Interface sketch lives in this doc only — implementing it before submission is scope creep.

## 8. Changelog

| Date | Change | Commit |
|---|---|---|
| 2026-08-16 | Initial contract design v1.0 | `docs: SMART-CONTRACT` |
