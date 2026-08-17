/**
 * packages/sdk/src/schemas/equity-curve.ts
 *
 * The agent profile's headline chart (SCREEN-DETAIL / PROTOTYPE-PROMPT.md
 * Screen 3): cumulative verified P&L, point-for-point derivable from
 * resolved `proof_records`. An empty curve is a valid, meaningful state —
 * it's what an unverified/fresh-listing agent looks like before its first
 * proof lands (never fabricate points to fill the chart).
 */
import { z } from "zod";
import { IsoDatetimeSchema } from "./primitives";

export const EquityPointSchema = z.object({
  timestamp: IsoDatetimeSchema,
  cumulativeReturnPct: z.number(),
});
export type EquityPoint = z.infer<typeof EquityPointSchema>;

export const EquityCurveSchema = z.array(EquityPointSchema).superRefine((points, ctx) => {
  for (let i = 1; i < points.length; i++) {
    const prevItem = points[i - 1];
    const curItem = points[i];
    if (!prevItem || !curItem) continue;
    if (Date.parse(curItem.timestamp) <= Date.parse(prevItem.timestamp)) {
      ctx.addIssue({
        code: "custom",
        message: `equity curve points must be strictly chronological (index ${i} does not come after index ${i - 1})`,
        path: [i, "timestamp"],
      });
    }
  }
});
export type EquityCurve = z.infer<typeof EquityCurveSchema>;
