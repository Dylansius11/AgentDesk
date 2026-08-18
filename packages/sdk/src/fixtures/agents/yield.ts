/**
 * packages/sdk/src/fixtures/agents/yield.ts — Yield Optimisation category
 * (3 agents). YieldShepherd & AlphaYield: verified. YieldPilot: unverified
 * (fresh listing, one decision registered, nothing resolved yet).
 */
import type { Agent } from "../../schemas/agent.js";
import { buildAction, buildPendingRecord, buildResolvedRecord, isoAt, mkAddress } from "../helpers.js";

const yieldShepherd: Agent = {
  id: "3001",
  chainId: 56,
  ownerAddress: mkAddress("yieldshepherd:owner"),
  registeredAt: isoAt(2026, 6, 1, 9, 0),
  capabilities: ["pancakeswap-liquidity", "token-radar"],

  name: "YieldShepherd",
  tagline: "Moves funds to where APY actually is",
  description:
    "Scans PancakeSwap farms weekly and rotates your deposit into the pool with the best risk-adjusted APY, always staying inside a conservative, audited-pool allowlist.",
  category: "yield",
  riskLevel: "low",
  pricePerTaskUsd1: 0.6,
  status: "active",
  proofProgram: true,
  claimedBy: mkAddress("yieldshepherd:dev"),
  claimedAt: isoAt(2026, 6, 3, 9, 0),

  trustPanel: {
    allowlist: [
      {
        protocol: "PancakeSwap",
        action: "farm-rotate",
        market: "Audited farm allowlist",
        label: "Move funds between an audited allowlist of PancakeSwap farms — nothing else",
      },
    ],
    spendCapUsd1: 500,
    spendCapWindow: "week",
    durationDays: 30,
    expiresAt: isoAt(2026, 9, 15, 18, 0),
    revocable: true,
    canWithdraw: false,
    summary:
      "YieldShepherd may move your funds between an audited allowlist of PancakeSwap farms, spending at most $500 per week on gas/slippage, until Sep 15, 18:00. It cannot withdraw. You can stop it anytime.",
  },

  verified: true,
  metrics: {
    window: "30d",
    verifiedReturnPct: 14.8,
    winRate: 0.93,
    maxDrawdownPct: 1.8,
    tasksResolved: 1042,
    avgResponseMin: 12.1,
    categoryStat: { farmRotations: 58 },
    computedAt: isoAt(2026, 8, 16, 6, 0),
  },
  equityCurve: [
    { timestamp: isoAt(2026, 7, 17, 0, 0), cumulativeReturnPct: 0 },
    { timestamp: isoAt(2026, 7, 24, 0, 0), cumulativeReturnPct: 3.6 },
    { timestamp: isoAt(2026, 7, 31, 0, 0), cumulativeReturnPct: 7.2 },
    { timestamp: isoAt(2026, 8, 8, 0, 0), cumulativeReturnPct: 10.9 },
    { timestamp: isoAt(2026, 8, 16, 0, 0), cumulativeReturnPct: 14.8 },
  ],
  proofRecords: [
    buildResolvedRecord({
      recordId: 6011,
      agentId: "3001",
      seed: "yieldshepherd:6011",
      registrant: mkAddress("yieldshepherd:owner"),
      action: buildAction({
        actionType: "farm-rotate",
        market: "CAKE-BNB LP farm",
        direction: "deposit",
        sizeUsd1: 500,
        nonce: 6011,
        plainText: "Rotate into CAKE-BNB farm (APY 18.4% ≥ committed 15% floor)",
      }),
      registeredAt: isoAt(2026, 8, 9, 8, 0),
      deadlineHoursOut: 12,
      resolveMinutesAfterDeadline: 25,
      status: "win",
      pnlUsd1: 6.8,
      resolutionSource: "Farm APY + position-share snapshot",
    }),
    buildResolvedRecord({
      recordId: 6012,
      agentId: "3001",
      seed: "yieldshepherd:6012",
      registrant: mkAddress("yieldshepherd:owner"),
      action: buildAction({
        actionType: "farm-hold",
        market: "CAKE-BNB LP farm",
        direction: "harvest",
        sizeUsd1: 0,
        nonce: 6012,
        plainText: "Weekly harvest — hold position, APY still above floor",
      }),
      registeredAt: isoAt(2026, 8, 12, 8, 0),
      deadlineHoursOut: 12,
      resolveMinutesAfterDeadline: 30,
      status: "win",
      pnlUsd1: 2.1,
      resolutionSource: "Farm APY + position-share snapshot",
    }),
    buildResolvedRecord({
      recordId: 6013,
      agentId: "3001",
      seed: "yieldshepherd:6013",
      registrant: mkAddress("yieldshepherd:owner"),
      action: buildAction({
        actionType: "farm-rotate",
        market: "USDT-USD1 LP farm",
        direction: "deposit",
        sizeUsd1: 500,
        nonce: 6013,
        plainText: "Rotate into USDT-USD1 farm (APY dropped on CAKE-BNB)",
      }),
      registeredAt: isoAt(2026, 8, 15, 8, 0),
      deadlineHoursOut: 12,
      resolveMinutesAfterDeadline: 18,
      status: "neutral",
      pnlUsd1: 0.2,
      resolutionSource: "Farm APY + position-share snapshot",
    }),
  ],
};

const alphaYield: Agent = {
  id: "3002",
  chainId: 56,
  ownerAddress: mkAddress("alphayield:owner"),
  registeredAt: isoAt(2026, 6, 28, 9, 0),
  capabilities: ["pancakeswap-liquidity", "token-radar"],

  name: "AlphaYield",
  tagline: "Chases hot farms, cuts fast when they die",
  description:
    "Rotates aggressively into freshly-launched high-APY farms and exits fast the moment realized yield falls below its committed band — higher variance, higher upside, cut losses quickly.",
  category: "yield",
  riskLevel: "high",
  pricePerTaskUsd1: 1.1,
  status: "active",
  proofProgram: true,
  claimedBy: mkAddress("alphayield:dev"),
  claimedAt: isoAt(2026, 6, 30, 9, 0),

  trustPanel: {
    allowlist: [
      {
        protocol: "PancakeSwap",
        action: "farm-rotate",
        market: "High-APY farm allowlist",
        label: "Move funds between a high-APY PancakeSwap farm allowlist — nothing else",
      },
    ],
    spendCapUsd1: 300,
    spendCapWindow: "day",
    durationDays: 7,
    expiresAt: isoAt(2026, 8, 23, 18, 0),
    revocable: true,
    canWithdraw: false,
    summary:
      "AlphaYield may move your funds between a high-APY PancakeSwap farm allowlist, spending at most $300 per day on gas/slippage, until Aug 23, 18:00. It cannot withdraw. You can stop it anytime.",
  },

  verified: true,
  metrics: {
    window: "30d",
    verifiedReturnPct: 38.9,
    winRate: 0.67,
    maxDrawdownPct: 14.6,
    tasksResolved: 1877,
    avgResponseMin: 9.4,
    categoryStat: { farmRotations: 212 },
    computedAt: isoAt(2026, 8, 16, 6, 0),
  },
  equityCurve: [
    { timestamp: isoAt(2026, 7, 17, 0, 0), cumulativeReturnPct: 0 },
    { timestamp: isoAt(2026, 7, 22, 0, 0), cumulativeReturnPct: 14.0 },
    { timestamp: isoAt(2026, 7, 27, 0, 0), cumulativeReturnPct: 6.5 },
    { timestamp: isoAt(2026, 8, 1, 0, 0), cumulativeReturnPct: 22.1 },
    { timestamp: isoAt(2026, 8, 6, 0, 0), cumulativeReturnPct: 17.3 },
    { timestamp: isoAt(2026, 8, 11, 0, 0), cumulativeReturnPct: 31.0 },
    { timestamp: isoAt(2026, 8, 16, 0, 0), cumulativeReturnPct: 38.9 },
  ],
  proofRecords: [
    buildResolvedRecord({
      recordId: 6031,
      agentId: "3002",
      seed: "alphayield:6031",
      registrant: mkAddress("alphayield:owner"),
      action: buildAction({
        actionType: "farm-rotate",
        market: "New-listing farm A",
        direction: "deposit",
        sizeUsd1: 250,
        nonce: 6031,
        plainText: "Rotate into new-listing farm (opening APY 94%)",
      }),
      registeredAt: isoAt(2026, 8, 11, 5, 0),
      deadlineHoursOut: 12,
      resolveMinutesAfterDeadline: 15,
      status: "win",
      pnlUsd1: 18.2,
      resolutionSource: "Farm APY + position-share snapshot",
    }),
    buildResolvedRecord({
      recordId: 6032,
      agentId: "3002",
      seed: "alphayield:6032",
      registrant: mkAddress("alphayield:owner"),
      action: buildAction({
        actionType: "farm-exit",
        market: "New-listing farm A",
        direction: "withdraw",
        sizeUsd1: 250,
        nonce: 6032,
        plainText: "Exit new-listing farm — realized yield fell below committed band",
      }),
      registeredAt: isoAt(2026, 8, 13, 2, 0),
      deadlineHoursOut: 6,
      resolveMinutesAfterDeadline: 10,
      status: "loss",
      pnlUsd1: -4.1,
      resolutionSource: "Farm APY + position-share snapshot",
    }),
    buildResolvedRecord({
      recordId: 6033,
      agentId: "3002",
      seed: "alphayield:6033",
      registrant: mkAddress("alphayield:owner"),
      action: buildAction({
        actionType: "farm-rotate",
        market: "New-listing farm B",
        direction: "deposit",
        sizeUsd1: 250,
        nonce: 6033,
        plainText: "Rotate into new-listing farm B (opening APY 61%)",
      }),
      registeredAt: isoAt(2026, 8, 15, 6, 0),
      deadlineHoursOut: 12,
      resolveMinutesAfterDeadline: 20,
      status: "win",
      pnlUsd1: 9.7,
      resolutionSource: "Farm APY + position-share snapshot",
    }),
  ],
};

const yieldPilot: Agent = {
  id: "3003",
  chainId: 56,
  ownerAddress: mkAddress("yieldpilot:owner"),
  registeredAt: isoAt(2026, 8, 15, 12, 0),
  capabilities: ["pancakeswap-liquidity"],

  name: "YieldPilot",
  tagline: "New farm-rotation agent — opening window in progress",
  description:
    "Just joined the Proof Program with a conservative farm-rotation strategy. Its first decision is registered on-chain and awaiting resolution — no track record to show yet.",
  category: "yield",
  riskLevel: "medium",
  pricePerTaskUsd1: 0.5,
  status: "active",
  proofProgram: true,
  claimedBy: mkAddress("yieldpilot:dev"),
  claimedAt: isoAt(2026, 8, 15, 11, 0),

  trustPanel: {
    allowlist: [
      {
        protocol: "PancakeSwap",
        action: "farm-rotate",
        market: "Audited farm allowlist",
        label: "Move funds between an audited allowlist of PancakeSwap farms — nothing else",
      },
    ],
    spendCapUsd1: 100,
    spendCapWindow: "week",
    durationDays: 14,
    expiresAt: isoAt(2026, 8, 30, 18, 0),
    revocable: true,
    canWithdraw: false,
    summary:
      "YieldPilot may move your funds between an audited allowlist of PancakeSwap farms, spending at most $100 per week on gas/slippage, until Aug 30, 18:00. It cannot withdraw. You can stop it anytime.",
  },

  verified: false,
  metrics: null,
  equityCurve: [],
  proofRecords: [
    buildPendingRecord({
      recordId: 6090,
      agentId: "3003",
      seed: "yieldpilot:6090",
      registrant: mkAddress("yieldpilot:owner"),
      action: buildAction({
        actionType: "farm-rotate",
        market: "CAKE-USDT LP farm",
        direction: "deposit",
        sizeUsd1: 100,
        nonce: 6090,
        plainText: "Deposit into CAKE-USDT farm (opening allocation)",
      }),
      registeredAt: isoAt(2026, 8, 16, 5, 0),
      deadlineHoursOut: 12,
    }),
  ],
};

export const YIELD_AGENTS: Agent[] = [yieldShepherd, alphaYield, yieldPilot];
