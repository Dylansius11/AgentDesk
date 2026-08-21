// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProofLedger} from "../../src/ProofLedger.sol";

/// @notice Fuzzing handler for the ProofLedger invariant suite.
/// @dev    Bounds every input to a valid range so the fuzzer's budget goes
///         toward exploring *sequences* of registerDecision / attestOutcome
///         calls rather than mostly bouncing off revert paths (those are
///         already covered directly in ProofLedger.t.sol). For every record
///         created, it snapshots a fingerprint of the record's immutable
///         fields at creation time, and again the moment it is first
///         attested — the invariant test compares live contract state
///         against these snapshots after arbitrary further activity.
contract ProofLedgerHandler is Test {
    ProofLedger public immutable ledger;
    address public immutable attester;

    /// @dev Small, deliberately-colliding domain so multiple decisions land
    ///      on the same agentId and recordCount accounting gets exercised.
    uint256 internal constant AGENT_DOMAIN = 20;

    uint256[] public recordIds;
    mapping(uint256 => bytes32) public decisionSnapshot;
    mapping(uint256 => bool) public isAttested;
    mapping(uint256 => bytes32) public outcomeSnapshot;

    constructor(ProofLedger _ledger, address _attester) {
        ledger = _ledger;
        attester = _attester;
    }

    function recordIdsLength() external view returns (uint256) {
        return recordIds.length;
    }

    function agentDomain() external pure returns (uint256) {
        return AGENT_DOMAIN;
    }

    function registerDecision(uint256 agentIdSeed, bytes32 intentHash, uint256 windowSeed) external {
        uint256 agentId = bound(agentIdSeed, 0, AGENT_DOMAIN);
        uint256 window = bound(windowSeed, 1, ledger.MAX_WINDOW());
        uint64 deadline = uint64(block.timestamp + window);

        uint256 recordId = ledger.registerDecision(agentId, intentHash, deadline);
        recordIds.push(recordId);
        decisionSnapshot[recordId] = _decisionCoreFingerprint(recordId);
    }

    function attestOutcome(
        uint256 recordIdSeed,
        int256 statusSeed,
        int128 pnlUsd1,
        bytes32 evidenceHash,
        uint256 warpSeed
    ) external {
        if (recordIds.length == 0) return;
        uint256 recordId = recordIds[bound(recordIdSeed, 0, recordIds.length - 1)];
        if (isAttested[recordId]) return; // already resolved by a prior fuzz call in this run — skip, don't revert-spam

        (,,, uint64 deadline,,) = ledger.getDecision(recordId);
        if (block.timestamp < deadline) {
            vm.warp(deadline + bound(warpSeed, 0, 7 days));
        }

        int8 status = int8(bound(statusSeed, -1, 2));

        vm.prank(attester);
        ledger.attestOutcome(recordId, status, pnlUsd1, evidenceHash);

        isAttested[recordId] = true;
        outcomeSnapshot[recordId] = _outcomeFingerprint(recordId);
    }

    /// @dev Fingerprint of ONLY the fields that must never change after
    ///      creation. `resolved` is deliberately excluded: it legitimately
    ///      flips false -> true exactly once when an outcome is attested —
    ///      that is new information being attached, not a past record being
    ///      edited. `invariant_OutcomeNeverChangesOnceAttested` in the test
    ///      contract separately checks that flip is monotonic.
    function _decisionCoreFingerprint(uint256 recordId) internal view returns (bytes32) {
        (address r, uint256 a, bytes32 i, uint64 d, uint256 t,) = ledger.getDecision(recordId);
        return keccak256(abi.encode(r, a, i, d, t));
    }

    function _outcomeFingerprint(uint256 recordId) internal view returns (bytes32) {
        (int8 s, int128 p, bytes32 e, uint256 t) = ledger.getOutcome(recordId);
        return keccak256(abi.encode(s, p, e, t));
    }
}
