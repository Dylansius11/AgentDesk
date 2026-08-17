/**
 * apps/keeper/src/db/client.ts
 *
 * Lazy Postgres/drizzle client for the keeper — mirrors
 * apps/api/src/db/client.ts's shape exactly (lazy pool, never throws,
 * isDatabaseConfigured() gate) so both apps degrade the same way when
 * DATABASE_URL is absent. Kept as a separate file rather than an import
 * from apps/api per ARCHITECTURE.md §3 ("apps never import each other") —
 * see db/schema.ts's banner for the full rationale.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.js'
import { logger } from '../logger.js'
import * as schema from './schema.js'

export type Database = ReturnType<typeof drizzle<typeof schema>>

let cached: { sql: postgres.Sql; db: Database } | undefined

export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL)
}

/** Returns the shared drizzle client, or undefined if DATABASE_URL isn't set. Never throws. */
export function getDb(): Database | undefined {
  if (!env.DATABASE_URL) return undefined
  if (!cached) {
    const sql = postgres(env.DATABASE_URL, { max: 5, prepare: false })
    cached = { sql, db: drizzle(sql, { schema }) }
    logger.info('[db] keeper connection pool initialized')
  }
  return cached.db
}
