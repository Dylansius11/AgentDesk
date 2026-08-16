/**
 * apps/api/src/lib/http.ts
 *
 * Timeout-guarded fetch — the "timeout" half of CLAUDE.md §2's per-call
 * checklist (typed / timeout / circuit breaker / last-cache fallback).
 * Every live external call (Phase B: scan8004.ts, altana.ts, hire.ts) should
 * route through this instead of a bare fetch().
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number
}

export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`request to ${url} timed out after ${timeoutMs}ms`)
    this.name = 'FetchTimeoutError'
  }
}

const DEFAULT_TIMEOUT_MS = 5_000

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FetchTimeoutError(url, timeoutMs)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
