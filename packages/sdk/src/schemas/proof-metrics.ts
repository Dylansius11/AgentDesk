/**
 * packages/sdk/src/schemas/proof-metrics.ts
 *
 * Mirrors ERD.md `proof_metrics` — derived per agent, recomputed by the
 * keeper from `proof_records` ONLY (CLAUDE.md §3: "the leaderboard is a view
 * of the chain, not editorial judgment"). Never hand-edited; a fixture that
 * needs different numbers is a different agent, not a patched metrics row.
 */
import { z } from "zod";
import { IsoDatetimeSchema } from "./primitives.js";

export const MetricsWindowSchema = z.enum(["7d", "30d", "all"]);
export type MetricsWindow = z.infer<typeof MetricsWindowSchema>;

export const ProofMetricsSchema = z.object({
  window: MetricsWindowSchema,
  verifiedReturnPct: z.number(),
  winRate: z.number().min(0).max(1),
  /** Stored as a non-negative magnitude — a 6.2% max drawdown is `6.2`, not `-6.2`. */
  maxDrawdownPct: z.number().nonnegative(),
  tasksResolved: z.number().int().nonnegative(),
  avgResponseMin: z.number().nonnegative(),
  /** Category-specific stat, e.g. `{ "savedLiquidations": 3 }` for health agents, `{ "gridsCompleted": 214 }` for grid agents. */
  categoryStat: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  computedAt: IsoDatetimeSchema,
});
export type ProofMetrics = z.infer<typeof ProofMetricsSchema>;
