/**
 * packages/sdk/src/schemas/primitives.ts
 *
 * Low-level building blocks shared by every domain schema. Kept deliberately
 * version-agnostic zod (no `.datetime()`/`.email()` shortcut sugar) so this
 * file behaves the same across zod major versions.
 *
 * Import rule (ARCHITECTURE.md §3): this package imports nothing internal —
 * it is the seam `apps/web`, `apps/api`, and `apps/keeper` all share.
 */
import { z } from "zod";

/** 0x-prefixed 20-byte EVM address (checksum not enforced — display concern, not shape concern). */
export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 20-byte EVM address");
export type Address = z.infer<typeof AddressSchema>;

/** 0x-prefixed 32-byte word — covers bytes32 hashes (intentHash/evidenceHash) and tx hashes alike. */
export const Hex32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x-prefixed 32-byte hex value");
export type Hex32 = z.infer<typeof Hex32Schema>;

/** Transaction hash — same shape as Hex32, named separately for call-site clarity. */
export const TxHashSchema = Hex32Schema;
export type TxHash = z.infer<typeof TxHashSchema>;

/**
 * ERC-8004 agent id, serialized as a decimal-string uint256 (never a JS
 * number — real ids can exceed Number.MAX_SAFE_INTEGER, and this is exactly
 * how a viem/ethers uint256 round-trips through JSON).
 */
export const AgentIdSchema = z
  .string()
  .regex(/^[0-9]+$/, "ERC-8004 agent id must be a decimal integer string");
export type AgentId = z.infer<typeof AgentIdSchema>;

/**
 * ISO-8601 datetime string. Deliberately a plain regex + Date.parse check
 * instead of zod's built-in `.datetime()` (its accepted-format surface has
 * shifted across zod major versions) — this behaves identically everywhere.
 */
export const IsoDatetimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "must be a valid ISO-8601 datetime string",
  });
export type IsoDatetime = z.infer<typeof IsoDatetimeSchema>;

/** Non-negative on-chain block number. */
export const BlockNumberSchema = z.number().int().nonnegative();

/** Monotonically-issued ProofLedger record id. */
export const RecordIdSchema = z.number().int().nonnegative();

/** A USD1-denominated amount (x402 settlement currency). Can be negative (pnl). */
export const Usd1Schema = z.number().finite();

/** A USD1-denominated amount that can never be negative (caps, prices, fees). */
export const Usd1NonNegativeSchema = z.number().finite().nonnegative();
