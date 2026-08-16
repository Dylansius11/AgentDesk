/**
 * packages/sdk/src/schemas/category.ts
 *
 * The four official BNB "Build the Era" agent categories — see CLAUDE.md §2.1
 * ("all four categories, equally deep") and ERD.md `listings.category` enum.
 * Values match the ERD enum literally: never rename these without updating
 * ERD.md in the same commit (ERD doc contract).
 */
import { z } from "zod";

export const CategorySchema = z.enum(["grid", "rebalance", "yield", "health"]);
export type Category = z.infer<typeof CategorySchema>;

export const CATEGORIES = CategorySchema.options;

/** Nina-language labels for the four category cards (PRD §5.1 step 1). Display metadata only — not part of the wire schema. */
export const CATEGORY_META: Record<
  Category,
  { label: string; ninaLabel: string; description: string }
> = {
  grid: {
    label: "Grid Trading",
    ninaLabel: "Trade for me while I sleep",
    description: "Places buy/sell bands around a price range and harvests the spread.",
  },
  rebalance: {
    label: "Rebalancing",
    ninaLabel: "Keep my liquidity working",
    description: "Re-centers PancakeSwap v3 LP ranges as price moves.",
  },
  yield: {
    label: "Yield Optimisation",
    ninaLabel: "Find the best yield for me",
    description: "Rotates deposits toward the highest-quality farm/pool APY.",
  },
  health: {
    label: "Health-Factor Monitoring",
    ninaLabel: "Protect my position",
    description: "Watches a lending position's health factor and tops up collateral before liquidation.",
  },
};
