/**
 * apps/api/src/db/client.ts
 *
 * Lazy Postgres/drizzle client. No connection is opened at import time —
 * this session has no DATABASE_URL provisioned (Wave 1B scope: structure +
 * stubs, no live external calls), so every consumer must go through
 * getDb()/isDatabaseConfigured() rather than assuming a live pool exists.
 *
 * TODO(Phase B): once DATABASE_URL is provisioned (Supabase), verify pool
 * sizing against Railway's connection limits and add drizzle-kit migrations
 * (`pnpm --filter api db:generate` / `db:push`).
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
    logger.info('[db] connection pool initialized')
  }
  return cached.db
}

/**
 * Lightweight liveness probe for /api/health. Never throws — callers get a
 * structured result so a DB hiccup degrades the health response instead of
 * crashing it (ARCHITECTURE.md §6: never a dead screen).
 */
export async function pingDatabase(): Promise<
  | { configured: false }
  | { configured: true; ok: true; latencyMs: number }
  | { configured: true; ok: false; error: string }
> {
  if (!env.DATABASE_URL) return { configured: false }
  const start = Date.now()
  try {
    const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 3 })
    await sql`select 1`
    await sql.end({ timeout: 1 })
    return { configured: true, ok: true, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}
