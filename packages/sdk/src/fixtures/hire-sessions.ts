/**
 * packages/sdk/src/fixtures/hire-sessions.ts
 *
 * A small number of sample HireSession fixtures — enough to exercise the
 * `HireSession` schema end-to-end (active + revoked states). NOT the mock
 * API client (that's task B1); these exist purely so `fixtures:validate`
 * proves this schema, not just `Agent`, actually holds real-shaped data.
 */
import type { HireSession } from "../schemas/hire-session.js";
import { isoAt, mkAddress, mkHex32 } from "./helpers.js";

/** Nina's HealthGuard hire — the live, active session from docs/demo-script.md. */
const ninaHiresHealthGuard: HireSession = {
  id: "job-nina-healthguard-0001",
  escrowRef: mkHex32("job:nina-healthguard-0001:escrow"),
  agentId: "4001", // HealthGuard
  hirerAddress: mkAddress("nina:wallet"),
  status: "active",
  config: {
    amountUsd1: 200,
    spendCapUsd1: 50,
    spendCapWindow: "day",
    durationDays: 7,
    allowlist: [
      {
        protocol: "Venus",
        action: "adjust-collateral",
        market: "Venus BNB collateral",
        label: "Adjust your Venus collateral - nothing else",
      },
    ],
  },
  feeUsd1: 0.06, // 3% of a $2.00 task-in-advance chunk
  session: {
    id: "keystore-nina-healthguard-0001",
    expiresAt: isoAt(2026, 8, 23, 18, 0),
    revokedAt: null,
    revokeTx: null,
    keystoreTx: mkHex32("job:nina-healthguard-0001:keystore-tx"),
  },
  createdAt: isoAt(2026, 8, 15, 21, 40),
  updatedAt: isoAt(2026, 8, 16, 3, 6),
  completedAt: null,
};

/** A completed-then-stopped GridGoblin hire — exercises the "revoked" job/session pairing. */
const traderHiresGridGoblinThenStops: HireSession = {
  id: "job-trader-gridgoblin-0007",
  escrowRef: mkHex32("job:trader-gridgoblin-0007:escrow"),
  agentId: "1001", // GridGoblin
  hirerAddress: mkAddress("trader:wallet"),
  status: "revoked",
  config: {
    amountUsd1: 100,
    spendCapUsd1: 50,
    spendCapWindow: "day",
    durationDays: 7,
    allowlist: [
      {
        protocol: "PancakeSwap",
        action: "swap",
        market: "CAKE/USDT",
        label: "Trade CAKE/USDT on PancakeSwap - nothing else",
      },
    ],
  },
  feeUsd1: 0.07,
  session: {
    id: "keystore-trader-gridgoblin-0007",
    expiresAt: isoAt(2026, 8, 22, 18, 0),
    revokedAt: isoAt(2026, 8, 15, 15, 42),
    revokeTx: mkHex32("job:trader-gridgoblin-0007:revoke-tx"),
    keystoreTx: mkHex32("job:trader-gridgoblin-0007:keystore-tx"),
  },
  createdAt: isoAt(2026, 8, 15, 9, 0),
  updatedAt: isoAt(2026, 8, 15, 15, 42),
  completedAt: null,
};

export const HIRE_SESSIONS: HireSession[] = [ninaHiresHealthGuard, traderHiresGridGoblinThenStops];
