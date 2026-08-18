/**
 * packages/sdk/src/fixtures/agents/grid.ts — Grid Trading category (3 agents).
 * GridGoblin & GridMind: verified. MoonMechanic: unverified (fresh listing,
 * one decision registered, nothing resolved yet — the "grey card" state
 * from PROTOTYPE-PROMPT.md Screen 2).
 */
import type { Agent } from "../../schemas/agent.js";
import { buildAction, buildPendingRecord, buildResolvedRecord, isoAt, mkAddress } from "../helpers.js";

const gridGoblin: Agent = {
  id: "1001",
  chainId: 56,
  ownerAddress: mkAddress("gridgoblin:owner"),
  registeredAt: isoAt(2026, 6, 10, 9, 0),
  capabilities: ["pancakeswap-trading", "token-radar"],

  name: "GridGoblin",
  tagline: "Grids CAKE/USDT while you sleep",
  description:
    "Places buy/sell bands around the current CAKE/USDT price and harvests the spread as price oscillates through them — every band fill pre-registered before it fires.",
  category: "grid",
  riskLevel: "medium",
  pricePerTaskUsd1: 0.8,
  status: "active",
  proofProgram: true,
  claimedBy: mkAddress("gridgoblin:dev"),
  claimedAt: isoAt(2026, 6, 12, 10, 0),

  trustPanel: {
    allowlist: [
      {
        protocol: "PancakeSwap",
        action: "swap",
        market: "CAKE/USDT",
        label: "Trade CAKE/USDT on PancakeSwap — nothing else",
      },
    ],
    spendCapUsd1: 50,
    spendCapWindow: "day",
    durationDays: 7,
    expiresAt: isoAt(2026, 8, 23, 18, 0),
    revocable: true,
    canWithdraw: false,
    summary:
      "GridGoblin may trade CAKE/USDT with at most $50 per day until Aug 23, 18:00. It cannot withdraw. You can stop it anytime.",
  },

  verified: true,
  metrics: {
    window: "30d",
    verifiedReturnPct: 31.4,
    winRate: 0.82,
    maxDrawdownPct: 6.2,
    tasksResolved: 1204,
    avgResponseMin: 3.8,
    categoryStat: { gridsCompleted: 214 },
    computedAt: isoAt(2026, 8, 16, 6, 0),
  },
  equityCurve: [
    { timestamp: isoAt(2026, 7, 17, 0, 0), cumulativeReturnPct: 0 },
    { timestamp: isoAt(2026, 7, 22, 0, 0), cumulativeReturnPct: 7.1 },
    { timestamp: isoAt(2026, 7, 27, 0, 0), cumulativeReturnPct: 12.9 },
    { timestamp: isoAt(2026, 8, 1, 0, 0), cumulativeReturnPct: 9.4 },
    { timestamp: isoAt(2026, 8, 6, 0, 0), cumulativeReturnPct: 21.0 },
    { timestamp: isoAt(2026, 8, 11, 0, 0), cumulativeReturnPct: 27.8 },
    { timestamp: isoAt(2026, 8, 16, 0, 0), cumulativeReturnPct: 31.4 },
  ],
  proofRecords: [
    buildResolvedRecord({
      recordId: 4821,
      agentId: "1001",
      seed: "gridgoblin:4821",
      registrant: mkAddress("gridgoblin:owner"),
      action: buildAction({
        actionType: "grid-band-fill",
        market: "CAKE/USDT",
        direction: "buy",
        sizeUsd1: 24.96,
        nonce: 4821,
        plainText: "Buy 12 CAKE if price ≤ $2.10",
      }),
      registeredAt: isoAt(2026, 8, 15, 14, 2),
      deadlineHoursOut: 1,
      resolveMinutesAfterDeadline: 8,
      status: "win",
      pnlUsd1: 1.2,
      resolutionSource: "PancakeSwap v3 Quoter",
    }),
    buildResolvedRecord({
      recordId: 4822,
      agentId: "1001",
      seed: "gridgoblin:4822",
      registrant: mkAddress("gridgoblin:owner"),
      action: buildAction({
        actionType: "grid-band-fill",
        market: "CAKE/USDT",
        direction: "sell",
        sizeUsd1: 26.52,
        nonce: 4822,
        plainText: "Sell 12 CAKE if price ≥ $2.21",
      }),
      registeredAt: isoAt(2026, 8, 15, 14, 7),
      deadlineHoursOut: 1,
      resolveMinutesAfterDeadline: 5,
      status: "win",
      pnlUsd1: 0.95,
      resolutionSource: "PancakeSwap v3 Quoter",
    }),
    buildResolvedRecord({
      recordId: 4823,
      agentId: "1001",
      seed: "gridgoblin:4823",
      registrant: mkAddress("gridgoblin:owner"),
      action: buildAction({
        actionType: "grid-band-widen",
        market: "CAKE/USDT",
        direction: "rebalance",
        sizeUsd1: 0,
        nonce: 4823,
        plainText: "Widen grid bands — volatility spike detected",
      }),
      registeredAt: isoAt(2026, 8, 15, 14, 31),
      deadlineHoursOut: 2,
      resolveMinutesAfterDeadline: 12,
      status: "neutral",
      pnlUsd1: 0,
      resolutionSource: "PancakeSwap v3 Quoter",
    }),
  ],
};

const gridMind: Agent = {
  id: "1002",
  chainId: 56,
  ownerAddress: mkAddress("gridmind:owner"),
  registeredAt: isoAt(2026, 6, 18, 11, 0),
  capabilities: ["pancakeswap-trading", "token-radar"],

  name: "GridMind",
  tagline: "Adaptive grid bands with volatility brakes",
  description:
    "Widens or tightens its BNB/USDT grid bands automatically based on realized volatility, and pauses new fills entirely when volatility spikes past its brake threshold.",
  category: "grid",
  riskLevel: "low",
  pricePerTaskUsd1: 1.2,
  status: "active",
  proofProgram: true,
  claimedBy: mkAddress("gridmind:dev"),
  claimedAt: isoAt(2026, 6, 20, 9, 30),

  trustPanel: {
    allowlist: [
      {
        protocol: "PancakeSwap",
        action: "swap",
        market: "BNB/USDT",
        label: "Trade BNB/USDT on PancakeSwap — nothing else",
      },
    ],
    spendCapUsd1: 75,
    spendCapWindow: "day",
    durationDays: 7,
    expiresAt: isoAt(2026, 8, 23, 18, 0),
    revocable: true,
    canWithdraw: false,
    summary:
      "GridMind may trade BNB/USDT with at most $75 per day until Aug 23, 18:00. It cannot withdraw. You can stop it anytime.",
  },

  verified: true,
  metrics: {
    window: "30d",
    verifiedReturnPct: 18.2,
    winRate: 0.76,
    maxDrawdownPct: 4.0,
    tasksResolved: 842,
    avgResponseMin: 5.1,
    categoryStat: { gridsCompleted: 133 },
    computedAt: isoAt(2026, 8, 16, 6, 0),
  },
  equityCurve: [
    { timestamp: isoAt(2026, 7, 17, 0, 0), cumulativeReturnPct: 0 },
    { timestamp: isoAt(2026, 7, 24, 0, 0), cumulativeReturnPct: 4.4 },
    { timestamp: isoAt(2026, 7, 31, 0, 0), cumulativeReturnPct: 8.1 },
    { timestamp: isoAt(2026, 8, 7, 0, 0), cumulativeReturnPct: 12.6 },
    { timestamp: isoAt(2026, 8, 16, 0, 0), cumulativeReturnPct: 18.2 },
  ],
  proofRecords: [
    buildResolvedRecord({
      recordId: 4841,
      agentId: "1002",
      seed: "gridmind:4841",
      registrant: mkAddress("gridmind:owner"),
      action: buildAction({
        actionType: "grid-band-fill",
        market: "BNB/USDT",
        direction: "buy",
        sizeUsd1: 60,
        nonce: 4841,
        plainText: "Buy 0.1 BNB if price ≤ $600",
      }),
      registeredAt: isoAt(2026, 8, 14, 10, 12),
      deadlineHoursOut: 2,
      resolveMinutesAfterDeadline: 10,
      status: "win",
      pnlUsd1: 2.4,
      resolutionSource: "PancakeSwap v3 Quoter",
    }),
    buildResolvedRecord({
      recordId: 4842,
      agentId: "1002",
      seed: "gridmind:4842",
      registrant: mkAddress("gridmind:owner"),
      action: buildAction({
        actionType: "grid-band-fill",
        market: "BNB/USDT",
        direction: "sell",
        sizeUsd1: 62,
        nonce: 4842,
        plainText: "Sell 0.1 BNB if price ≥ $618",
      }),
      registeredAt: isoAt(2026, 8, 14, 15, 40),
      deadlineHoursOut: 2,
      resolveMinutesAfterDeadline: 6,
      status: "loss",
      pnlUsd1: -0.6,
      resolutionSource: "PancakeSwap v3 Quoter",
    }),
    buildResolvedRecord({
      recordId: 4843,
      agentId: "1002",
      seed: "gridmind:4843",
      registrant: mkAddress("gridmind:owner"),
      action: buildAction({
        actionType: "grid-band-pause",
        market: "BNB/USDT",
        direction: "rebalance",
        sizeUsd1: 0,
        nonce: 4843,
        plainText: "Pause new fills — volatility brake triggered",
      }),
      registeredAt: isoAt(2026, 8, 15, 8, 5),
      deadlineHoursOut: 4,
      resolveMinutesAfterDeadline: 20,
      status: "neutral",
      pnlUsd1: 0,
      resolutionSource: "PancakeSwap v3 Quoter",
    }),
  ],
};

const moonMechanic: Agent = {
  id: "1003",
  chainId: 56,
  ownerAddress: mkAddress("moonmechanic:owner"),
  registeredAt: isoAt(2026, 8, 14, 16, 0),
  capabilities: ["pancakeswap-trading", "token-radar"],

  name: "MoonMechanic",
  tagline: "Fresh agent, first proofs landing soon",
  description:
    "Runs high-frequency micro-grids on newly-listed pairs. Just joined the Proof Program — its first decision is registered on-chain and awaiting resolution.",
  category: "grid",
  riskLevel: "medium",
  pricePerTaskUsd1: 0.3,
  status: "active",
  proofProgram: true,
  claimedBy: mkAddress("moonmechanic:dev"),
  claimedAt: isoAt(2026, 8, 14, 15, 0),

  trustPanel: {
    allowlist: [
      {
        protocol: "PancakeSwap",
        action: "swap",
        market: "BABYDOGE/USDT",
        label: "Trade BABYDOGE/USDT on PancakeSwap — nothing else",
      },
    ],
    spendCapUsd1: 20,
    spendCapWindow: "day",
    durationDays: 3,
    expiresAt: isoAt(2026, 8, 19, 18, 0),
    revocable: true,
    canWithdraw: false,
    summary:
      "MoonMechanic may trade BABYDOGE/USDT with at most $20 per day until Aug 19, 18:00. It cannot withdraw. You can stop it anytime.",
  },

  // No proof yet — this is the honest "unproven, not unsafe" state (PROTOTYPE-PROMPT.md Screen 2 grey card).
  verified: false,
  metrics: null,
  equityCurve: [],
  proofRecords: [
    buildPendingRecord({
      recordId: 4890,
      agentId: "1003",
      seed: "moonmechanic:4890",
      registrant: mkAddress("moonmechanic:owner"),
      action: buildAction({
        actionType: "grid-band-fill",
        market: "BABYDOGE/USDT",
        direction: "buy",
        sizeUsd1: 5,
        nonce: 4890,
        plainText: "Buy BABYDOGE if price ≤ opening band low",
      }),
      registeredAt: isoAt(2026, 8, 16, 7, 0),
      deadlineHoursOut: 6,
    }),
  ],
};

export const GRID_AGENTS: Agent[] = [gridGoblin, gridMind, moonMechanic];
