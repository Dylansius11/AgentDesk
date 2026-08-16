/**
 * apps/api/src/env.ts
 *
 * Single point of env-var access for the API. Every var here is documented
 * in docs/technical/INTEGRATION.md ("Environment variables" table) and
 * mirrored in the repo-root `.env.example` — that's the doc-contract this
 * file must never violate (CLAUDE.md §4 env discipline).
 *
 * Everything is OPTIONAL at the type level for Phase A: no external API keys
 * are provisioned this session (8004scan / Altana / TermiX / RPCs / DB), and
 * the API must still boot + serve /api/health without them. Services that
 * need a given var check for it themselves and report "unconfigured" rather
 * than throwing at import time.
 *
 * NEVER log KEEPER_ATTESTER_KEY or any private key (CLAUDE.md §4). This file
 * exposes it as a value, not a getter that logs — callers must not console.log it.
 */
import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Postgres (Supabase) — cache/derived views only, never authoritative (ERD.md §1)
  DATABASE_URL: z.string().min(1).optional(),

  // 8004scan (AltLayer) — I2
  SCAN8004_API_KEY: z.string().min(1).optional(),
  SCAN8004_BASE_URL: z.string().url().default('https://api.8004scan.io'),

  // BSC RPC — I1/I3 chain reads/writes
  BSC_RPC_URL: z.string().url().optional(),
  BSC_TESTNET_RPC_URL: z.string().url().optional(),

  // ProofLedger (ours) — pinned at deploy time (SMART-CONTRACT.md)
  PROOFLEDGER_ADDRESS_MAINNET: z.string().min(1).optional(),
  PROOFLEDGER_ADDRESS_TESTNET: z.string().min(1).optional(),
  ERC8004_REGISTRY_ADDRESS: z.string().min(1).optional(),

  // Keeper's sole privileged secret — read here only so services can check
  // "is attestation configured", never printed/logged.
  KEEPER_ATTESTER_KEY: z.string().min(1).optional(),

  // Altana (I6) — sessions, Keystore, hireErc8183Agent
  ALTANA_API_KEY: z.string().min(1).optional(),
  ALTANA_BASE_URL: z.string().url().default('https://api.altana.network'),

  // x402 / B402 (I5) — per-task payments, USD1 settlement
  X402_FACILITATOR_URL: z.string().url().optional(),
  PROTOCOL_FEE_BPS: z.coerce.number().int().nonnegative().default(300),

  // TermiX (I9)
  TERMIX_API_KEY: z.string().min(1).optional(),

  // web origin, for CORS
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
})

export type Env = z.infer<typeof EnvSchema>

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    // Env vars are all optional/defaulted by design (Phase A stub) — a parse
    // failure here means a *malformed* value (e.g. bad URL), not a missing
    // one. Fail loudly; this should never happen in CI/dev with .env.example.
    console.error('[env] invalid environment configuration:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment configuration — see stderr for field errors')
  }
  return parsed.data
}

export const env = loadEnv()

/** True once every var a given integration needs is present. Never true this session (Phase A). */
export const integrationConfigured = {
  database: Boolean(env.DATABASE_URL),
  scan8004: Boolean(env.SCAN8004_API_KEY),
  bscRpc: Boolean(env.BSC_RPC_URL),
  bscTestnetRpc: Boolean(env.BSC_TESTNET_RPC_URL),
  altana: Boolean(env.ALTANA_API_KEY),
  keeperAttester: Boolean(env.KEEPER_ATTESTER_KEY),
  termix: Boolean(env.TERMIX_API_KEY),
} as const
