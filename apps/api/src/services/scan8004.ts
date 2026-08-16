/**
 * apps/api/src/services/scan8004.ts
 *
 * Read-through client for 8004scan (AltLayer) — INTEGRATION.md I2. This is
 * the ONLY place that should ever call api.8004scan.io.
 *
 * NOT LIVE THIS SESSION: no SCAN8004_API_KEY is provisioned (Wave 1B scope
 * is structure + stubs). Every function below has the real signature the
 * routes/services layer will call in Phase B, but returns obviously-stub
 * data instead of fetching. Do NOT hardcode realistic-looking numbers here —
 * per CLAUDE.md rule 3/6, only ProofLedger-derived data is ever "verified".
 *
 * TODO(Phase B):
 *  - Implement fetchWithTimeout() calls to `${env.SCAN8004_BASE_URL}/...`
 *    with `Authorization: Bearer ${env.SCAN8004_API_KEY}`.
 *  - zod-parse every response (schema drift is the #1 wiring risk per the
 *    bnb-agent-stack skill) — schemas should live in packages/sdk once that
 *    package's Agent shape lands, imported here rather than redefined.
 *  - Wrap each call in the CircuitBreaker below; on open circuit or fetch
 *    failure, fall back to the TtlCache's last value and set `stale: true`
 *    on the returned envelope so the UI can render a staleness chip.
 *  - Respect the 500 req/min budget (cache-first, refresh-in-background).
 */
import { CACHE_TTL_MS, TtlCache } from '../lib/cache.js'
import { CircuitBreaker } from '../lib/circuit-breaker.js'
import type { AgentDetail, AgentSummary, Category } from '../types/domain.js'

export interface Scan8004ListParams {
  category?: Category
  verified?: boolean
  cursor?: string
  limit?: number
}

/** Envelope every read-through service returns — carries staleness for the UI chip (ARCHITECTURE.md §6). */
export interface StaleAware<T> {
  data: T
  stale: boolean
  fetchedAt: string | null
}

const listCache = new TtlCache<AgentSummary[]>(CACHE_TTL_MS.agentList)
const detailCache = new TtlCache<AgentDetail>(CACHE_TTL_MS.agentDetail)
const circuit = new CircuitBreaker('scan8004')

/**
 * List agents from 8004scan (joined with our listings/proof_metrics
 * downstream, not here). Returns an empty array + stale:false — this is a
 * structural stub, not a fabricated result set.
 */
export async function listAgents(_params: Scan8004ListParams): Promise<StaleAware<AgentSummary[]>> {
  // TODO(Phase B): read listCache first; on miss/stale, assertCallAllowed(),
  // fetchWithTimeout the 8004scan list endpoint, zod-parse, listCache.set(),
  // circuit.onSuccess(); on failure circuit.onFailure() + serve last cache.
  void listCache
  void circuit
  return { data: [], stale: false, fetchedAt: null }
}

/** Fetch one agent's detail from 8004scan. Returns null (not-found stub) until wired. */
export async function getAgentDetail(_agentId: string): Promise<StaleAware<AgentDetail | null>> {
  void detailCache
  return { data: null, stale: false, fetchedAt: null }
}

/** Spot-check a claim against the ERC-8004 registry directly (fallback path when 8004scan is stale/down). */
export async function verifyAgentOwnerOnChain(
  _agentId: string,
  _claimedOwner: string,
): Promise<{ matches: boolean } | { matches: null; reason: 'not_implemented' }> {
  // TODO(Phase B): direct registry read via viem against ERC8004_REGISTRY_ADDRESS.
  return { matches: null, reason: 'not_implemented' }
}
