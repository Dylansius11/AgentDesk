/**
 * packages/sdk/src/schemas/trust-panel.ts
 *
 * The Trust Panel (CLAUDE.md §7 glossary): permissions rendered as plain
 * sentences at the moment of risk. Backed by Altana scoped sessions +
 * Keystore (ERD.md `sessions` table); shape here matches
 * `listings.default_caps` (suggested config shown pre-hire) and is reused by
 * `HireSession.config` for the config a hirer actually confirmed.
 */
import { z } from "zod";
import { IsoDatetimeSchema, Usd1NonNegativeSchema } from "./primitives.js";

/**
 * One allowlist entry: what the agent's session key is scoped to call.
 * `label` is the pre-written Nina-language sentence fragment the Trust Panel
 * renders directly (SCREEN-DETAIL.md Tab 2: "Can trade CAKE/USDT on
 * PancakeSwap — nothing else").
 */
export const AllowlistEntrySchema = z.object({
  protocol: z.string().min(1), // e.g. "PancakeSwap", "Venus"
  action: z.string().min(1), // e.g. "swap", "adjust-collateral", "rebalance-range"
  market: z.string().min(1), // e.g. "CAKE/USDT", "BNB collateral"
  label: z.string().min(1), // plain-English sentence fragment for the UI
});
export type AllowlistEntry = z.infer<typeof AllowlistEntrySchema>;

/**
 * The full permission grant a hirer sees and confirms. `revocable` is
 * pinned to `true` (a `z.literal`) — one-tap revoke is a product law, never
 * a config option (CLAUDE.md §7 "Trust Panel").
 */
export const TrustPanelSchema = z.object({
  allowlist: z.array(AllowlistEntrySchema).min(1),
  spendCapUsd1: Usd1NonNegativeSchema,
  spendCapWindow: z.enum(["day", "week", "task"]),
  durationDays: z.number().int().positive(),
  expiresAt: IsoDatetimeSchema,
  revocable: z.literal(true),
  canWithdraw: z.literal(false), // "Withdrawals always stay with you" — PROTOTYPE-PROMPT.md, structurally locked off
  /** The exact confirm-screen sentence, e.g. "GridGoblin may trade CAKE/USDT with at most $50 per day until Aug 23, 18:00. It cannot withdraw. You can stop it anytime." */
  summary: z.string().min(1),
});
export type TrustPanel = z.infer<typeof TrustPanelSchema>;
