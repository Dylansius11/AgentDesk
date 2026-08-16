/**
 * packages/sdk/src/schemas/hire-session.ts
 *
 * The hirer-facing view of an ERC-8183 escrow job + its Altana Keystore
 * session, merging ERD.md `jobs` and `sessions` tables into the one object
 * a client call (and the Dashboard/Jobs History screens) actually needs.
 * `config` reuses the same allowlist shape as `Agent.trustPanel` — the
 * config a hirer confirms in the wizard IS a Trust Panel, just one they
 * chose rather than one suggested.
 */
import { z } from "zod";
import { AddressSchema, AgentIdSchema, IsoDatetimeSchema, TxHashSchema, Usd1NonNegativeSchema } from "./primitives.js";
import { AllowlistEntrySchema } from "./trust-panel.js";

export const JobStatusSchema = z.enum([
  "created",
  "funded",
  "active",
  "awaiting_attestation",
  "completed",
  "revoked",
  "failed",
  "expired",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const HireConfigSchema = z.object({
  amountUsd1: Usd1NonNegativeSchema,
  spendCapUsd1: Usd1NonNegativeSchema,
  spendCapWindow: z.enum(["day", "week", "task"]),
  durationDays: z.number().int().positive(),
  allowlist: z.array(AllowlistEntrySchema).min(1),
});
export type HireConfig = z.infer<typeof HireConfigSchema>;

export const SessionGrantSchema = z.object({
  id: z.string().min(1), // Altana Keystore session/entry id
  expiresAt: IsoDatetimeSchema,
  revokedAt: IsoDatetimeSchema.nullable(),
  revokeTx: TxHashSchema.nullable(),
  keystoreTx: TxHashSchema,
});
export type SessionGrant = z.infer<typeof SessionGrantSchema>;

export const HireSessionSchema = z
  .object({
    id: z.string().min(1), // job id (uuid)
    escrowRef: z.string().min(1), // ERC-8183 on-chain job identifier
    agentId: AgentIdSchema,
    hirerAddress: AddressSchema,
    status: JobStatusSchema,
    config: HireConfigSchema,
    feeUsd1: Usd1NonNegativeSchema, // 3% protocol fee
    session: SessionGrantSchema,
    createdAt: IsoDatetimeSchema,
    updatedAt: IsoDatetimeSchema,
    completedAt: IsoDatetimeSchema.nullable(),
  })
  .refine(
    (job) => {
      // "revoked" job status and a live (non-revoked) session are contradictory states
      const sessionIsRevoked = job.session.revokedAt !== null;
      if (job.status === "revoked" && !sessionIsRevoked) return false;
      if (sessionIsRevoked && job.status !== "revoked" && job.status !== "completed") return false;
      return true;
    },
    {
      message: "job.status and session.revokedAt must agree: a revoked session implies a revoked (or completed) job",
      path: ["status"],
    },
  )
  .refine(
    (job) => {
      if (job.completedAt === null) return true;
      return Date.parse(job.completedAt) >= Date.parse(job.createdAt);
    },
    { message: "completedAt cannot precede createdAt", path: ["completedAt"] },
  );
export type HireSession = z.infer<typeof HireSessionSchema>;

export const HireSessionListSchema = z.array(HireSessionSchema);
