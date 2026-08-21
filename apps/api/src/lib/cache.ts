/**
 * apps/api/src/lib/cache.ts
 *
 * Minimal in-process TTL cache with "last-known-good" fallback semantics —
 * the shape every service in src/services/ should sit behind once its live
 * call lands (CLAUDE.md §2: "typed, timeout, circuit breaker, last-cache
 * fallback"; ARCHITECTURE.md §6 rate-limit budget: 8004scan Pro 500 req/min,
 * cache-first, refresh-in-background).
 *
 * Phase A: structural only. Nothing calls this with real data yet — services
 * import it so the *shape* of read-through caching is fixed early.
 *
 * TODO(Phase B): swap the in-memory Map for the Postgres cache tables
 * (agents/listings/proof_metrics) per ERD.md §5 sync rules — this in-memory
 * version is fine for a single Railway instance but not for multi-instance.
 */

export interface CacheEntry<T> {
  value: T
  fetchedAt: number
  /** ms after which the entry is considered stale (but still servable as fallback) */
  ttlMs: number
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  constructor(private defaultTtlMs: number) {}

  get(key: string): CacheEntry<T> | undefined {
    return this.store.get(key)
  }

  /** True if the entry exists and is within its TTL. */
  isFresh(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    return Date.now() - entry.fetchedAt < entry.ttlMs
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, fetchedAt: Date.now(), ttlMs })
  }

  /** Age of a cached entry in ms, or undefined if there is none — drives the UI staleness chip. */
  ageMs(key: string): number | undefined {
    const entry = this.store.get(key)
    return entry ? Date.now() - entry.fetchedAt : undefined
  }

  delete(key: string): void {
    this.store.delete(key)
  }
}

/** TTL budgets per ARCHITECTURE.md §6 / INTEGRATION.md I2. Cache-first reads protect external API quotas. */
export const CACHE_TTL_MS = {
  agentList: 60_000,
  agentDetail: 30_000,
  leaderboard: 120_000,
} as const
