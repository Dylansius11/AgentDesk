// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IProofLedger
/// @notice Canonical external interface for ProofLedger, AgentDesk's
///         append-only, on-chain decision -> outcome ledger. See
///         docs/technical/SMART-CONTRACT.md §2.2 for the full design.
/// @dev    This interface is frozen alongside the intentHash / evidenceHash
///         schemes it references — a breaking change to either is a new
///         contract version, never an edit to this one.
interface IProofLedger {
    // ── pre-execution (anyone may call, before the covering action) ────

    /// @notice Pre-register a trading decision before it is executed.
    /// @param agentId ERC-8004 agent id the decision is registered for.
    /// @param intentHash keccak256(abi.encode(actionType, market, direction, params, sizeUsd1, nonce)).
    /// @param deadline Unix timestamp after which the decision becomes attestable.
    /// @return recordId Monotonically increasing id assigned to this record.
    function registerDecision(uint256 agentId, bytes32 intentHash, uint64 deadline) external returns (uint256 recordId);

    // ── post-deadline (ATTESTER_ROLE only) ──────────────────────────────

    /// @notice Attest the outcome of a previously-registered decision.
    /// @param recordId The record being resolved.
    /// @param status 1 win | -1 loss | 0 neutral | 2 expired-unexecuted.
    /// @param pnlUsd1 Resolved PnL in USD1, derived from objective on-chain state.
    /// @param evidenceHash keccak256(abi.encode(intentHash, executionTx, resolutionSource, prices)).
    function attestOutcome(uint256 recordId, int8 status, int128 pnlUsd1, bytes32 evidenceHash) external;

    // ── reads ────────────────────────────────────────────────────────

    function getDecision(uint256 recordId)
        external
        view
        returns (
            address registrant,
            uint256 agentId,
            bytes32 intentHash,
            uint64 deadline,
            uint256 registeredAt,
            bool resolved
        );

    function getOutcome(uint256 recordId)
        external
        view
        returns (int8 status, int128 pnlUsd1, bytes32 evidenceHash, uint256 attestedAt);

    function recordCount(uint256 agentId) external view returns (uint256);

    // ── events (the canonical, queryable history — indexer's source of truth) ──

    event DecisionRegistered(
        uint256 indexed recordId, uint256 indexed agentId, bytes32 intentHash, uint64 deadline, uint256 registeredAt
    );

    event OutcomeAttested(
        uint256 indexed recordId,
        uint256 indexed agentId,
        int8 status,
        int128 pnlUsd1,
        bytes32 evidenceHash,
        uint256 attestedAt
    );
}
