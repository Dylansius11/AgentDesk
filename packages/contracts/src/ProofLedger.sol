// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IProofLedger} from "./interfaces/IProofLedger.sol";

/// @title ProofLedger
/// @notice Append-only, on-chain registry of pre-registered agent trading
///         decisions and their objectively-attested outcomes. This contract
///         is AgentDesk's moat: a record counts only if it was registered
///         on-chain *before* the trade it covers, and once written, neither
///         a decision nor an outcome can ever be edited or deleted — by
///         anyone, including AgentDesk itself. The leaderboard is a view of
///         this ledger, nothing more.
/// @dev    Append-only is enforced structurally, not just by convention:
///         `_decisions[recordId]` is written exactly once, inside
///         `registerDecision`, and no other function in this contract ever
///         writes to that mapping again. `_outcomes[recordId]` is written
///         exactly once, inside `attestOutcome`, guarded by a check that
///         reverts if a record has already been attested. There is no
///         update path and no delete path for either — not behind a role,
///         not behind a timelock, not at all. If a future change seems to
///         need one, the change is wrong, not this comment.
///
///         Immutable by design: no proxy, no pause, no upgrade path. A
///         pause function would itself be a trust bug in a contract whose
///         entire purpose is to be a record nobody can tamper with. The
///         contract has no payable functions and no receive/fallback, so it
///         can never come to hold funds — hiring, escrow, and payment flows
///         live entirely in external ERC-8183 / x402 contracts.
///
///         See docs/technical/SMART-CONTRACT.md for the full design
///         rationale, gas targets, and the keeper's outcome-resolution spec.
contract ProofLedger is AccessControl, IProofLedger {
    // ── roles ────────────────────────────────────────────────────────

    /// @notice Role allowed to call `attestOutcome`. v1: a single keeper EOA
    ///         (`KEEPER_ATTESTER_KEY`, held only in Railway env). Migration
    ///         path to a staked attester set + dispute window is documented
    ///         in SMART-CONTRACT.md §6 — this role is intentionally
    ///         re-grantable (via `DEFAULT_ADMIN_ROLE`) so that migration
    ///         never requires redeploying or touching history.
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    // ── constants ────────────────────────────────────────────────────

    /// @notice Maximum gap between registration and the attestable
    ///         deadline. Stops a decision registered today from being
    ///         stretched to cover some unrelated trade made weeks later.
    uint256 public constant MAX_WINDOW = 24 hours;

    // ── storage ──────────────────────────────────────────────────────

    /// @dev One slot: address(20) + registeredAt(5) + window(3) = 28 bytes.
    ///      `deadline` is not stored directly — it is `registeredAt + window`,
    ///      which is always ≤ `registeredAt + MAX_WINDOW` by construction,
    ///      so the pre-registration window invariant cannot be violated by
    ///      any write to this struct, now or later.
    struct Decision {
        address registrant; // who paid gas to register — informational only, only timing matters
        uint40 registeredAt; // block.timestamp at registration (fits until year ~36,812)
        uint24 window; // seconds from registeredAt to deadline, enforced ≤ MAX_WINDOW at write time
    }

    struct Outcome {
        int8 status; // 1 win | -1 loss | 0 neutral | 2 expired-unexecuted
        int128 pnlUsd1; // resolved PnL, USD1, from objective on-chain sources only
        bytes32 evidenceHash; // keccak256(abi.encode(intentHash, executionTx, resolutionSource, prices))
        uint40 attestedAt; // block.timestamp at attestation; 0 means "not yet attested"
    }

    /// @dev recordId => agentId. Own full slot, kept separate so `Decision`
    ///      itself stays packed to a single slot.
    mapping(uint256 => uint256) private _agentIdOf;
    /// @dev recordId => intentHash. Own full slot (bytes32).
    mapping(uint256 => bytes32) private _intentHashOf;
    /// @dev recordId => packed decision fields. Written once, in registerDecision, forever.
    mapping(uint256 => Decision) private _decisions;
    /// @dev recordId => attested outcome. Written once, in attestOutcome, forever.
    ///      Presence (`attestedAt != 0`) is what "resolved" means — there is
    ///      no separate mutable "resolved" flag anywhere in this contract.
    mapping(uint256 => Outcome) private _outcomes;
    /// @dev agentId => number of decisions ever registered for that agent.
    ///      Monotonically incremented, never decremented.
    mapping(uint256 => uint256) private _recordCountByAgent;

    /// @notice Next recordId to be assigned. recordId 0 is never issued, so
    ///         callers may treat 0 as "no such record".
    uint256 public nextRecordId = 1;

    // ── errors ───────────────────────────────────────────────────────

    error DeadlineNotInFuture();
    error WindowTooLong();
    error RecordDoesNotExist();
    error DeadlineNotReached();
    error AlreadyAttested();
    error InvalidStatus();

    constructor(address admin, address attester) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (attester != address(0)) {
            _grantRole(ATTESTER_ROLE, attester);
        }
    }

    // ── pre-execution: anyone may register, for any agentId ────────────

    /// @inheritdoc IProofLedger
    /// @dev Registrant identity is never checked against `agentId` — only
    ///      the fact that this call landed on-chain, at this block, before
    ///      `deadline` matters. The indexer separately enforces
    ///      `decision.block < execution.block` when deriving proof metrics;
    ///      a trade with no prior decision record simply has no proof and
    ///      does not count, by construction of how metrics are derived.
    function registerDecision(uint256 agentId, bytes32 intentHash, uint64 deadline)
        external
        override
        returns (uint256 recordId)
    {
        if (deadline <= block.timestamp) revert DeadlineNotInFuture();
        uint256 window = uint256(deadline) - block.timestamp;
        if (window > MAX_WINDOW) revert WindowTooLong();

        recordId = nextRecordId++;

        _agentIdOf[recordId] = agentId;
        _intentHashOf[recordId] = intentHash;
        // forge-lint: disable-next-line(unsafe-typecast)
        // casting 'window' to uint24 is safe: it is checked <= MAX_WINDOW (86400) two lines above.
        // casting block.timestamp to uint40 is safe until year ~36,812.
        _decisions[recordId] =
            Decision({registrant: msg.sender, registeredAt: uint40(block.timestamp), window: uint24(window)});

        unchecked {
            // agentId is caller-supplied and unbounded; a wraparound here
            // would need 2^256 registrations for a single agent, which is
            // not reachable — unchecked only to save gas on the common path.
            _recordCountByAgent[agentId]++;
        }

        emit DecisionRegistered(recordId, agentId, intentHash, deadline, block.timestamp);
    }

    // ── post-deadline: ATTESTER_ROLE only, from objective sources ──────

    /// @inheritdoc IProofLedger
    /// @dev Reverts if the record does not exist, if it was already
    ///      attested, or if `deadline` has not yet passed. There is no
    ///      argument or code path that lets a second call for the same
    ///      `recordId` change a first attestation's outcome — the guard
    ///      below is unconditional.
    function attestOutcome(uint256 recordId, int8 status, int128 pnlUsd1, bytes32 evidenceHash)
        external
        override
        onlyRole(ATTESTER_ROLE)
    {
        Decision storage d = _decisions[recordId];
        if (d.registeredAt == 0) revert RecordDoesNotExist();
        if (_outcomes[recordId].attestedAt != 0) revert AlreadyAttested();
        if (status < -1 || status > 2) revert InvalidStatus();

        uint256 deadline = uint256(d.registeredAt) + uint256(d.window);
        if (block.timestamp < deadline) revert DeadlineNotReached();

        _outcomes[recordId] = Outcome({
            status: status, pnlUsd1: pnlUsd1, evidenceHash: evidenceHash, attestedAt: uint40(block.timestamp)
        });

        emit OutcomeAttested(recordId, _agentIdOf[recordId], status, pnlUsd1, evidenceHash, block.timestamp);
    }

    // ── reads ────────────────────────────────────────────────────────

    /// @inheritdoc IProofLedger
    function getDecision(uint256 recordId)
        external
        view
        override
        returns (
            address registrant,
            uint256 agentId,
            bytes32 intentHash,
            uint64 deadline,
            uint256 registeredAt,
            bool resolved
        )
    {
        Decision storage d = _decisions[recordId];
        if (d.registeredAt == 0) revert RecordDoesNotExist();

        registrant = d.registrant;
        agentId = _agentIdOf[recordId];
        intentHash = _intentHashOf[recordId];
        deadline = uint64(uint256(d.registeredAt) + uint256(d.window));
        registeredAt = d.registeredAt;
        resolved = _outcomes[recordId].attestedAt != 0;
    }

    /// @inheritdoc IProofLedger
    function getOutcome(uint256 recordId)
        external
        view
        override
        returns (int8 status, int128 pnlUsd1, bytes32 evidenceHash, uint256 attestedAt)
    {
        if (_decisions[recordId].registeredAt == 0) revert RecordDoesNotExist();
        Outcome storage o = _outcomes[recordId];
        if (o.attestedAt == 0) revert RecordDoesNotExist(); // exists but not yet attested

        status = o.status;
        pnlUsd1 = o.pnlUsd1;
        evidenceHash = o.evidenceHash;
        attestedAt = o.attestedAt;
    }

    /// @inheritdoc IProofLedger
    function recordCount(uint256 agentId) external view override returns (uint256) {
        return _recordCountByAgent[agentId];
    }
}
