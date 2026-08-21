// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProofLedger} from "../src/ProofLedger.sol";
import {ProofLedgerHandler} from "./invariant/ProofLedgerHandler.sol";

/// @notice Invariant/fuzz suite proving the append-only guarantee holds
///         across arbitrary sequences of registerDecision / attestOutcome
///         calls, not just the specific call orderings hand-written in
///         ProofLedger.t.sol. This is the CI-enforced regression guard
///         referenced in CLAUDE.md's non-negotiable #1: if a future change
///         ever introduces a way to mutate or remove a past record, these
///         invariants fail the build.
contract ProofLedgerInvariantTest is Test {
    ProofLedger internal ledger;
    ProofLedgerHandler internal handler;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");

    function setUp() public {
        vm.warp(1_800_000_000);
        ledger = new ProofLedger(admin, attester);
        handler = new ProofLedgerHandler(ledger, attester);

        // Fuzz calls only against the handler's bounded entry points —
        // this is standard Foundry invariant practice: it keeps the fuzzer
        // from wasting its budget on access-control reverts (e.g. random
        // callers hitting attestOutcome directly) and instead spends it
        // exploring valid call *sequences*, which is what append-only needs
        // to be tested against.
        targetContract(address(handler));
    }

    /// @dev For every record the fuzzer has ever created, its immutable
    ///      core fields (registrant, agentId, intentHash, deadline,
    ///      registeredAt) must still match the fingerprint captured the
    ///      instant it was registered — no matter what other registrations
    ///      or attestations happened afterward, for this record or any
    ///      other. This is the append-only invariant, proven structurally:
    ///      there is no function that writes to `_decisions` after
    ///      `registerDecision`, and this test fuzzes arbitrarily many other
    ///      calls in between to make sure nothing incidental changes it either.
    function invariant_DecisionCoreFieldsNeverChange() public view {
        uint256 count = handler.recordIdsLength();
        for (uint256 idx = 0; idx < count; idx++) {
            uint256 recordId = handler.recordIds(idx);
            (address r, uint256 a, bytes32 i, uint64 d, uint256 t,) = ledger.getDecision(recordId);
            bytes32 current = keccak256(abi.encode(r, a, i, d, t));
            assertEq(current, handler.decisionSnapshot(recordId), "decision core fields mutated");
        }
    }

    /// @dev Once a record has been attested, (a) it must never report
    ///      "unresolved" again, and (b) its outcome fields must be
    ///      byte-identical to the fingerprint captured at the moment of
    ///      first attestation, forever after — proving there is no way to
    ///      overwrite an outcome once submitted.
    function invariant_OutcomeNeverChangesOnceAttested() public view {
        uint256 count = handler.recordIdsLength();
        for (uint256 idx = 0; idx < count; idx++) {
            uint256 recordId = handler.recordIds(idx);
            if (!handler.isAttested(recordId)) continue;

            (,,,,, bool resolved) = ledger.getDecision(recordId);
            assertTrue(resolved, "attested record reverted to unresolved");

            (int8 s, int128 p, bytes32 e, uint256 t) = ledger.getOutcome(recordId);
            bytes32 current = keccak256(abi.encode(s, p, e, t));
            assertEq(current, handler.outcomeSnapshot(recordId), "outcome fields mutated after attestation");
        }
    }

    /// @dev recordId assignment is strictly monotonic and gapless — nothing
    ///      can shrink `nextRecordId` back down or cause it to skip.
    function invariant_RecordIdMonotonic() public view {
        assertEq(ledger.nextRecordId(), handler.recordIdsLength() + 1);
    }

    /// @dev Total per-agent recordCount across the handler's agentId domain
    ///      must always equal total registrations — proves counts are
    ///      neither lost nor double-counted, i.e. never decremented (there
    ///      is no code path that could decrement them).
    function invariant_RecordCountsSumToTotalRegistrations() public view {
        uint256 domain = handler.agentDomain();
        uint256 total;
        for (uint256 agentId = 0; agentId <= domain; agentId++) {
            total += ledger.recordCount(agentId);
        }
        assertEq(total, handler.recordIdsLength());
    }
}
