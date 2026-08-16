// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ProofLedger} from "../src/ProofLedger.sol";
import {IProofLedger} from "../src/interfaces/IProofLedger.sol";

contract ProofLedgerTest is Test {
    ProofLedger internal ledger;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal registrant = makeAddr("registrant");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant AGENT_ID = 42;
    bytes32 internal constant INTENT_HASH = keccak256("intent-1");
    bytes32 internal constant EVIDENCE_HASH = keccak256("evidence-1");

    function setUp() public {
        ledger = new ProofLedger(admin, attester);
        vm.warp(1_800_000_000); // fixed, sane "now" so deadlines are never accidentally in the past
    }

    // ── helpers ──────────────────────────────────────────────────────

    function _registerDefault() internal returns (uint256 recordId, uint64 deadline) {
        deadline = uint64(block.timestamp + 1 hours);
        vm.prank(registrant);
        recordId = ledger.registerDecision(AGENT_ID, INTENT_HASH, deadline);
    }

    // ── registerDecision ─────────────────────────────────────────────

    function test_RegisterDecision_StoresAndReturnsIncrementingIds() public {
        (uint256 id1,) = _registerDefault();
        (uint256 id2,) = _registerDefault();
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_RegisterDecision_AnyoneCanCall_ForAnyAgentId() public {
        // Spec: "Anyone can pay gas to register for any agentId" — only timing matters.
        vm.prank(stranger);
        uint256 recordId = ledger.registerDecision(AGENT_ID, INTENT_HASH, uint64(block.timestamp + 1 hours));
        (address registrantOut,,,,,) = ledger.getDecision(recordId);
        assertEq(registrantOut, stranger);
    }

    function test_RegisterDecision_EmitsDecisionRegistered() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.expectEmit(true, true, false, true, address(ledger));
        emit IProofLedger.DecisionRegistered(1, AGENT_ID, INTENT_HASH, deadline, block.timestamp);
        vm.prank(registrant);
        ledger.registerDecision(AGENT_ID, INTENT_HASH, deadline);
    }

    function test_RegisterDecision_IncrementsPerAgentRecordCount() public {
        assertEq(ledger.recordCount(AGENT_ID), 0);
        _registerDefault();
        assertEq(ledger.recordCount(AGENT_ID), 1);
        _registerDefault();
        assertEq(ledger.recordCount(AGENT_ID), 2);
        // a different agent's count is unaffected
        assertEq(ledger.recordCount(AGENT_ID + 1), 0);
    }

    function test_RevertWhen_DeadlineIsNotInFuture() public {
        vm.expectRevert(ProofLedger.DeadlineNotInFuture.selector);
        ledger.registerDecision(AGENT_ID, INTENT_HASH, uint64(block.timestamp));

        vm.expectRevert(ProofLedger.DeadlineNotInFuture.selector);
        ledger.registerDecision(AGENT_ID, INTENT_HASH, uint64(block.timestamp - 1));
    }

    function test_RevertWhen_WindowExceedsMaxWindow() public {
        uint64 tooFar = uint64(block.timestamp + ledger.MAX_WINDOW() + 1);
        vm.expectRevert(ProofLedger.WindowTooLong.selector);
        ledger.registerDecision(AGENT_ID, INTENT_HASH, tooFar);
    }

    function test_RegisterDecision_AllowsExactlyMaxWindow() public {
        uint64 exact = uint64(block.timestamp + ledger.MAX_WINDOW());
        uint256 recordId = ledger.registerDecision(AGENT_ID, INTENT_HASH, exact);
        (,,, uint64 deadlineOut,,) = ledger.getDecision(recordId);
        assertEq(deadlineOut, exact);
    }

    // ── attestOutcome ────────────────────────────────────────────────

    function test_AttestOutcome_HappyPath() public {
        (uint256 recordId, uint64 deadline) = _registerDefault();
        vm.warp(deadline + 1);

        vm.prank(attester);
        ledger.attestOutcome(recordId, int8(1), int128(1_000e18), EVIDENCE_HASH);

        (int8 status, int128 pnl, bytes32 evidence, uint256 attestedAt) = ledger.getOutcome(recordId);
        assertEq(status, int8(1));
        assertEq(pnl, int128(1_000e18));
        assertEq(evidence, EVIDENCE_HASH);
        assertEq(attestedAt, block.timestamp);

        (,,,,, bool resolved) = ledger.getDecision(recordId);
        assertTrue(resolved);
    }

    function test_AttestOutcome_EmitsOutcomeAttested() public {
        (uint256 recordId, uint64 deadline) = _registerDefault();
        vm.warp(deadline + 1);

        vm.expectEmit(true, true, false, true, address(ledger));
        emit IProofLedger.OutcomeAttested(recordId, AGENT_ID, int8(-1), int128(-50e18), EVIDENCE_HASH, block.timestamp);
        vm.prank(attester);
        ledger.attestOutcome(recordId, int8(-1), int128(-50e18), EVIDENCE_HASH);
    }

    function test_RevertWhen_AttestBeforeDeadline() public {
        (uint256 recordId,) = _registerDefault();
        vm.prank(attester);
        vm.expectRevert(ProofLedger.DeadlineNotReached.selector);
        ledger.attestOutcome(recordId, int8(1), int128(0), EVIDENCE_HASH);
    }

    function test_AttestOutcome_AllowedExactlyAtDeadline() public {
        (uint256 recordId, uint64 deadline) = _registerDefault();
        vm.warp(deadline); // exactly at deadline, not after
        vm.prank(attester);
        ledger.attestOutcome(recordId, int8(0), int128(0), EVIDENCE_HASH);
        (,,,, uint256 attestedAt) = (0, 0, bytes32(0), 0, 0); // unused placeholder to keep signature explicit
        (,,, attestedAt) = ledger.getOutcome(recordId);
        assertEq(attestedAt, deadline);
    }

    function test_RevertWhen_AttestingNonexistentRecord() public {
        vm.prank(attester);
        vm.expectRevert(ProofLedger.RecordDoesNotExist.selector);
        ledger.attestOutcome(999, int8(1), int128(0), EVIDENCE_HASH);
    }

    function test_RevertWhen_AttestingTwice() public {
        (uint256 recordId, uint64 deadline) = _registerDefault();
        vm.warp(deadline + 1);

        vm.prank(attester);
        ledger.attestOutcome(recordId, int8(1), int128(10), EVIDENCE_HASH);

        vm.prank(attester);
        vm.expectRevert(ProofLedger.AlreadyAttested.selector);
        ledger.attestOutcome(recordId, int8(-1), int128(-999), keccak256("different-evidence"));
    }

    function test_RevertWhen_StatusOutOfRange() public {
        (uint256 recordId, uint64 deadline) = _registerDefault();
        vm.warp(deadline + 1);

        vm.prank(attester);
        vm.expectRevert(ProofLedger.InvalidStatus.selector);
        ledger.attestOutcome(recordId, int8(5), int128(0), EVIDENCE_HASH);

        vm.prank(attester);
        vm.expectRevert(ProofLedger.InvalidStatus.selector);
        ledger.attestOutcome(recordId, int8(-2), int128(0), EVIDENCE_HASH);
    }

    // ── access control ───────────────────────────────────────────────

    function test_RevertWhen_NonAttesterCallsAttestOutcome() public {
        (uint256 recordId, uint64 deadline) = _registerDefault();
        vm.warp(deadline + 1);

        // NOTE: `ledger.ATTESTER_ROLE()` must be read BEFORE vm.prank(stranger) —
        // vm.prank only affects the very next external call, and evaluating it
        // as an inline argument below would itself be that next call, silently
        // consuming the prank before `attestOutcome` ever runs as `stranger`.
        bytes32 attesterRole = ledger.ATTESTER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, attesterRole)
        );
        ledger.attestOutcome(recordId, int8(1), int128(0), EVIDENCE_HASH);
    }

    function test_AdminCanGrantAndRevokeAttesterRole() public {
        address newAttester = makeAddr("newAttester");
        bytes32 attesterRole = ledger.ATTESTER_ROLE(); // read before pranking — see note above
        assertFalse(ledger.hasRole(attesterRole, newAttester));

        vm.prank(admin);
        ledger.grantRole(attesterRole, newAttester);
        assertTrue(ledger.hasRole(attesterRole, newAttester));

        (uint256 recordId, uint64 deadline) = _registerDefault();
        vm.warp(deadline + 1);
        vm.prank(newAttester);
        ledger.attestOutcome(recordId, int8(1), int128(1), EVIDENCE_HASH);

        vm.prank(admin);
        ledger.revokeRole(attesterRole, newAttester);
        assertFalse(ledger.hasRole(attesterRole, newAttester));
    }

    function test_RevertWhen_NonAdminGrantsAttesterRole() public {
        // read both roles before pranking — see note in test_RevertWhen_NonAttesterCallsAttestOutcome
        bytes32 attesterRole = ledger.ATTESTER_ROLE();
        bytes32 defaultAdminRole = ledger.DEFAULT_ADMIN_ROLE();

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, defaultAdminRole)
        );
        ledger.grantRole(attesterRole, stranger);
    }

    // ── gas discipline (SMART-CONTRACT.md §2.4 / CLAUDE.md non-negotiable #5) ──

    /// @notice The worst case for `registerDecision` — a brand-new agentId,
    ///         so every mapping slot it touches is cold (zero -> nonzero) —
    ///         must stay at or under the 120k gas budget: a proof must
    ///         always cost less than the trade it covers. This is the
    ///         explicit, CI-enforced check; `forge snapshot` additionally
    ///         tracks this and every other test's gas for regression review.
    ///
    /// @dev    STATUS (2026-08-16, first pass): this assertion currently
    ///         FAILS — measured 124,095 gas vs. a 120,000 budget (~3.4%
    ///         over), reported here honestly rather than loosened to pass.
    ///         Requires `foundry.toml`'s `isolate = true` to observe: without
    ///         it, this same call measures ~102k because it shares warm
    ///         EIP-2929 access-list state with this test's constructor call
    ///         in the same non-isolated transaction — an artifact that does
    ///         NOT hold on a real chain, where each tx starts cold. `isolate
    ///         = true` makes every external call metered as its own
    ///         transaction, which is the honest number to hold this budget
    ///         against.
    ///
    ///         Root cause: registering a brand-new agentId's first-ever
    ///         decision writes 4 cold storage slots — `_agentIdOf[recordId]`,
    ///         `_intentHashOf[recordId]`, `_decisions[recordId]`, and
    ///         `_recordCountByAgent[agentId]` — not the 3 SMART-CONTRACT.md
    ///         §2.4's original ~85k estimate assumed; `recordCount(agentId)`
    ///         being a required on-chain view (not just derivable from
    ///         events) is what adds the 4th slot. `_recordCountByAgent` is
    ///         warm for every registration after an agent's first, which is
    ///         why `test_Gas_RegisterDecision_WarmAgentSteadyStateCost` below
    ///         measures a comfortably-under-budget ~102k for that (much more
    ///         common) case.
    ///
    ///         Left as a genuine failing assertion, not silently passed —
    ///         see this task's report to the PM for two candidate fixes
    ///         (neither implemented here, both change real assumptions and
    ///         need a decision, not a unilateral call from this pass):
    ///         (a) bound `agentId` to fit alongside the packed Decision
    ///         fields in one slot (e.g. uint32/uint40) if BSC's live ERC-8004
    ///         registries confirm IDs are small sequential integers, which
    ///         would drop one cold SSTORE and bring the worst case under
    ///         budget with room to spare; or (b) treat the 120k target as
    ///         governing steady-state cost (what most trades actually pay)
    ///         rather than the once-per-agent-lifetime first registration.
    ///
    ///         PM decision (docs/AGENT-TASKS.md, 2026-08-17): (b). SMART-
    ///         CONTRACT.md's "a proof must always cost less than the trade
    ///         it covers" principle is about recurring per-decision cost —
    ///         a first-time agentId's one-time +4,095 gas onboarding premium
    ///         (124,095 vs. 120k, 3.4% over) is amortized across that
    ///         agent's entire trading history and isn't a per-trade cost.
    ///         (a) is not taken up here because it requires confirming real
    ///         ERC-8004 registry ID ranges, an external fact this repo
    ///         doesn't control and shouldn't guess at. This is now a
    ///         logged diagnostic, not a build-failing gate; revisit if (a)
    ///         becomes cheap to verify before mainnet.
    function test_Gas_RegisterDecision_ColdCallStaysUnderBudget() public {
        uint256 gasBefore = gasleft();
        ledger.registerDecision(999_999, keccak256("gas-budget-check"), uint64(block.timestamp + 1 hours));
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("registerDecision cold-call gas used (brand-new agentId):", gasUsed);
        assertLe(gasUsed, 130_000, "registerDecision cold-call regressed past the documented ~124k first-registration cost");
    }

    /// @dev Pass/fail gate for SMART-CONTRACT.md 2.4's 120k budget: the
    ///      realistic steady-state cost for an agent's SECOND-and-later
    ///      decision, where only the recordId-keyed slots are cold —
    ///      `_recordCountByAgent[agentId]` is already warm from storage.
    ///      This is the cost that applies to the overwhelming majority of
    ///      real registrations, since "brand new agentId" only happens once
    ///      per agent's lifetime (see PM decision above).
    function test_Gas_RegisterDecision_WarmAgentSteadyStateCost() public {
        ledger.registerDecision(1_000_000, keccak256("warm-up"), uint64(block.timestamp + 1 hours));

        uint256 gasBefore = gasleft();
        ledger.registerDecision(1_000_000, keccak256("second-decision-same-agent"), uint64(block.timestamp + 1 hours));
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("registerDecision steady-state gas used (agent's 2nd+ decision):", gasUsed);
        assertLe(gasUsed, 120_000, "registerDecision steady-state cost exceeds the 120k gas budget from SMART-CONTRACT.md 2.4");
    }

    // ── reads on missing records ─────────────────────────────────────

    function test_RevertWhen_GetDecisionForNonexistentRecord() public {
        vm.expectRevert(ProofLedger.RecordDoesNotExist.selector);
        ledger.getDecision(999);
    }

    function test_RevertWhen_GetOutcomeBeforeAttested() public {
        (uint256 recordId,) = _registerDefault();
        vm.expectRevert(ProofLedger.RecordDoesNotExist.selector);
        ledger.getOutcome(recordId);
    }

    // ── append-only: direct, readable regression tests ──────────────
    // (complements the fuzz/invariant suite in ProofLedgerInvariant.t.sol)

    /// @notice A decision's CORE fields (registrant, agentId, intentHash,
    ///         deadline, registeredAt) must be byte-identical before and
    ///         after any number of unrelated contract interactions —
    ///         registering other decisions, attesting other outcomes,
    ///         attesting this very record's outcome. Nothing mutates a
    ///         Decision after creation; this test proves it end-to-end for
    ///         one record. (`resolved` is intentionally excluded from the
    ///         fingerprint: it is derived from whether an Outcome exists,
    ///         and legitimately flips false -> true exactly once — that is
    ///         new information being attached, not a past record being
    ///         edited. `test_AttestOutcome_HappyPath` above already proves
    ///         that flip happens; this test proves everything else doesn't move.)
    function test_AppendOnly_DecisionNeverChangesAcrossUnrelatedActivity() public {
        (uint256 recordId, uint64 deadline) = _registerDefault();
        bytes32 before = _decisionCoreFingerprint(recordId);

        // unrelated activity: more registrations, for the same and other agents
        _registerDefault();
        vm.prank(stranger);
        ledger.registerDecision(AGENT_ID + 1, keccak256("other-intent"), uint64(block.timestamp + 30 minutes));
        assertEq(_decisionCoreFingerprint(recordId), before);

        // this record's own attestation must not change the Decision fields either
        vm.warp(deadline + 1);
        vm.prank(attester);
        ledger.attestOutcome(recordId, int8(1), int128(42), EVIDENCE_HASH);
        assertEq(_decisionCoreFingerprint(recordId), before);

        // more activity after attestation
        vm.prank(registrant);
        ledger.registerDecision(AGENT_ID, keccak256("yet-another-intent"), uint64(block.timestamp + 10 minutes));
        assertEq(_decisionCoreFingerprint(recordId), before);
    }

    /// @notice Once attested, an outcome's fields must be byte-identical
    ///         forever — the only defense against a second attestation is
    ///         `AlreadyAttested`, proven above; this proves that even
    ///         *reading* the outcome after further activity never reflects
    ///         anything but the original attestation.
    function test_AppendOnly_OutcomeNeverChangesAcrossUnrelatedActivity() public {
        (uint256 recordId, uint64 deadline) = _registerDefault();
        vm.warp(deadline + 1);
        vm.prank(attester);
        ledger.attestOutcome(recordId, int8(1), int128(777), EVIDENCE_HASH);
        bytes32 before = _outcomeFingerprint(recordId);

        _registerDefault();
        vm.prank(registrant);
        uint256 other = ledger.registerDecision(AGENT_ID, keccak256("another"), uint64(block.timestamp + 5 minutes));
        vm.warp(block.timestamp + 6 minutes);
        vm.prank(attester);
        ledger.attestOutcome(other, int8(-1), int128(-1), EVIDENCE_HASH);

        assertEq(_outcomeFingerprint(recordId), before);
    }

    /// @notice `resolved` is derived state (presence of an Outcome), not a
    ///         stored flag — but it must still only ever move one way, false
    ///         -> true, exactly once per record, and never back.
    function test_AppendOnly_ResolvedFlipsExactlyOnceAndNeverReverts() public {
        (uint256 recordId, uint64 deadline) = _registerDefault();
        (,,,,, bool resolvedBefore) = ledger.getDecision(recordId);
        assertFalse(resolvedBefore);

        vm.warp(deadline + 1);
        vm.prank(attester);
        ledger.attestOutcome(recordId, int8(1), int128(0), EVIDENCE_HASH);

        (,,,,, bool resolvedAfter) = ledger.getDecision(recordId);
        assertTrue(resolvedAfter);

        // further unrelated activity cannot un-resolve it
        _registerDefault();
        (,,,,, bool resolvedStill) = ledger.getDecision(recordId);
        assertTrue(resolvedStill);
    }

    /// @notice There is no function on this contract, callable by anyone in
    ///         any role, that can delete a record's existence. `getDecision`
    ///         must keep resolving the same recordId after arbitrarily many
    ///         other operations.
    function test_AppendOnly_RecordCountNeverDecreases() public {
        _registerDefault();
        _registerDefault();
        uint256 countAfterTwo = ledger.recordCount(AGENT_ID);
        assertEq(countAfterTwo, 2);

        (uint256 recordId, uint64 deadline) = _registerDefault();
        assertEq(ledger.recordCount(AGENT_ID), 3);

        vm.warp(deadline + 1);
        vm.prank(attester);
        ledger.attestOutcome(recordId, int8(0), int128(0), EVIDENCE_HASH);

        // attesting an outcome must never reduce how many decisions exist for the agent
        assertEq(ledger.recordCount(AGENT_ID), 3);
    }

    /// @dev Fingerprint of ONLY the fields that must never change once a
    ///      decision is created — deliberately excludes `resolved` (see
    ///      test_AppendOnly_DecisionNeverChangesAcrossUnrelatedActivity).
    function _decisionCoreFingerprint(uint256 recordId) internal view returns (bytes32) {
        (address r, uint256 a, bytes32 i, uint64 d, uint256 t,) = ledger.getDecision(recordId);
        return keccak256(abi.encode(r, a, i, d, t));
    }

    function _outcomeFingerprint(uint256 recordId) internal view returns (bytes32) {
        (int8 s, int128 p, bytes32 e, uint256 t) = ledger.getOutcome(recordId);
        return keccak256(abi.encode(s, p, e, t));
    }
}
