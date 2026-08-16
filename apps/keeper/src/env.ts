/**
 * apps/keeper/src/env.ts
 *
 * Env access for the keeper. Mirrors apps/api/src/env.ts's shape (kept
 * separate rather than shared, per ARCHITECTURE.md §3 import rule: apps
 * never import each other) — every var here is documented in
 * docs/technical/INTEGRATION.md and the repo-root `.env.example`.
 *
 * Everything is optional this session: no BSC RPC, no KEEPER_ATTESTER_KEY,
 * no DATABASE_URL provisioned (Wave 1B scope = structure + stubs). The
 * worker must still start and run its loop shape without them — each job
 * checks `keeperConfigured` and no-ops with a clear log line instead of
 * throwing.
 *
 * NEVER log KEEPER_ATTESTER_KEY (CLAUDE.md §4) — it is read here as a plain
 * value so services can check *presence*, never passed to logger.info/etc.
 */
import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1).optional(),

  BSC_RPC_URL: z.string().url().optional(),
  BSC_TESTNET_RPC_URL: z.string().url().optional(),

  PROOFLEDGER_ADDRESS_MAINNET: z.string().min(1).optional(),
  PROOFLEDGER_ADDRESS_TESTNET: z.string().min(1).optional(),

  /**
   * New var (Wave 4): the block ProofLedger was deployed at (mirrors
   * exported/addresses.<network>.json's `deployedAtBlock`, see
   * packages/contracts/script/README.md's patch-deployed-block.sh note).
   * jobs/indexer.ts starts its getContractEvents scan here instead of block
   * 0 — on a real chain, re-scanning from genesis on every cold start would
   * be slow and pointless (ProofLedger didn't exist before this block).
   * String, not bigint, at the env layer — parsed with BigInt() where used,
   * same reasoning as primitives.ts's uint256-as-string convention.
   */
  PROOFLEDGER_DEPLOY_BLOCK: z.string().optional(),

  /** ProofLedger ATTESTER role key — the sole privileged secret we operate. Never logged. */
  KEEPER_ATTESTER_KEY: z.string().min(1).optional(),

  /** New var (not in INTEGRATION.md before this task) — see .env.example + INTEGRATION.md addition. */
  KEEPER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  KEEPER_METRICS_INTERVAL_MS: z.coerce.number().int().positive().default(3_600_000),
})

export type Env = z.infer<typeof EnvSchema>

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('[env] invalid environment configuration:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment configuration — see stderr for field errors')
  }
  return parsed.data
}

export const env = loadEnv()

export const keeperConfigured = {
  database: Boolean(env.DATABASE_URL),
  chainRpc: Boolean(env.BSC_RPC_URL || env.BSC_TESTNET_RPC_URL),
  attester: Boolean(env.KEEPER_ATTESTER_KEY),
  proofLedger: Boolean(env.PROOFLEDGER_ADDRESS_MAINNET || env.PROOFLEDGER_ADDRESS_TESTNET),
} as const
