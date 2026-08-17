/**
 * apps/api/src/services/scan8004.ts
 *
 * Read-through client for 8004scan (AltLayer) — INTEGRATION.md I2. This is
 * the ONLY place that should ever call api.8004scan.io.
 *
 * LIVE (2026-08-17): SCAN8004_API_KEY / SCAN8004_BASE_URL are provisioned.
 * Real base path is `/api/v1/...` (NOT `/v1/...` as the original stub
 * assumed — confirmed against the live OpenAPI doc at
 * `${SCAN8004_BASE_URL}/openapi.json` and a live `GET /api/v1/agents` call
 * that returned real rows, e.g. total=740636 across chains, chain_id=97
 * (BSC Chapel) rows present including AgentDesk's own demo-agent
 * registrations). Response shape confirmed from the real API, not guessed —
 * see AgentSummaryResponseSchema/AgentDetailResponseSchema below, which
 * zod-parse the *actual* field names 8004scan returns (snake_case,
 * `agent_id` composite `chain_id:registry_address:token_id`, etc.).
 *
 * Every function below zod-parses the live response before mapping into our
 * local domain shapes (types/domain.ts). Per CLAUDE.md rule 3, fields that
 * only exist in AgentDesk's own `listings` table (category, tagline,
 * riskLevel, status) are NOT available from 8004scan and are left `null`
 * here rather than fabricated — the listings join happens downstream (a
 * separate, not-yet-wired concern) once Postgres `listings` rows exist.
 * `verified` stays `false`/`verifiedReturnPct`/`winRate` stay `null` here
 * for the same reason: only ProofLedger-derived proof_metrics rows may ever
 * render as "verified" (CLAUDE.md rule 3) — 8004scan's own `total_score` /
 * `average_score` are agent-reported reputation signals, not proof.
 */
import { z } from 'zod'
import { CACHE_TTL_MS, TtlCache } from '../lib/cache.js'
import { CircuitBreaker, CircuitOpenError } from '../lib/circuit-breaker.js'
import { env } from '../env.js'
import { fetchWithTimeout } from '../lib/http.js'
import { logger } from '../logger.js'
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

// ---------------------------------------------------------------------------
// Real 8004scan wire shapes (zod) — field names as returned by the live API,
// confirmed via GET /openapi.json + a live GET /api/v1/agents probe.
// ---------------------------------------------------------------------------

const RawAgentSummarySchema = z.object({
  id: z.string(),
  agent_id: z.string(), // composite: "chain_id:registry_address:token_id"
  token_id: z.string(),
  chain_id: z.number(),
  chain_type: z.string().default('evm'),
  contract_address: z.string(),
  is_testnet: z.boolean().default(true),
  owner_address: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  is_verified: z.boolean().default(false),
  star_count: z.number().default(0),
  supported_protocols: z.array(z.string()).default([]),
  x402_supported: z.boolean().default(false),
  total_score: z.number().default(0),
  rank: z.number().nullable().optional(),
  network_rank: z.number().nullable().optional(),
  health_score: z.number().nullable().optional(),
  total_feedbacks: z.number().default(0),
  average_score: z.number().default(0),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

const AgentSummaryListResponseSchema = z.object({
  items: z.array(RawAgentSummarySchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})

// Detail response is a strict superset of the summary fields — only the
// handful we actually surface are asserted; unknown extra fields pass
// through untouched (no .strict()), which is deliberate: 8004scan's schema
// is much larger (services, health_status, raw_metadata, parse_status, ...)
// and we don't want an additive field to break parsing (schema-drift
// resilience per the bnb-agent-stack skill).
const RawAgentDetailSchema = RawAgentSummarySchema.extend({
  agent_wallet: z.string().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
})

function mapCategoryHint(tags: string[], categories: string[]): Category | null {
  const combined = [...tags, ...categories].map((s) => s.toLowerCase())
  if (combined.some((s) => s.includes('grid'))) return 'grid'
  if (combined.some((s) => s.includes('rebalance') || s.includes('liquidity'))) return 'rebalance'
  if (combined.some((s) => s.includes('yield'))) return 'yield'
  if (combined.some((s) => s.includes('health'))) return 'health'
  return null
}

function toAgentSummary(raw: z.infer<typeof RawAgentSummarySchema>): AgentSummary {
  return {
    id: raw.agent_id,
    ownerAddress: raw.owner_address,
    chainId: raw.chain_id,
    // Only AgentDesk's own `listings` table (not yet joined here) can supply
    // category/tagline/riskLevel/status — never fabricated from 8004scan.
    category: null,
    tagline: raw.description,
    riskLevel: null,
    status: null,
    // Only ProofLedger-derived proof_metrics rows may ever render as
    // "verified" (CLAUDE.md rule 3) — 8004scan's `is_verified` is an
    // ERC-8004 registry/endpoint-verification flag, a different concept.
    verified: false,
    verifiedReturnPct: null,
    winRate: null,
    lastSyncedAt: raw.updated_at ?? null,
  }
}

function toAgentDetail(raw: z.infer<typeof RawAgentDetailSchema>): AgentDetail {
  return {
    ...toAgentSummary(raw),
    category: mapCategoryHint(raw.tags, raw.categories),
    description: raw.description,
    capabilities: raw.supported_protocols,
    defaultCaps: null,
    pricePerTaskUsd1: null,
  }
}

/** chain_id + token_id (what 8004scan's detail endpoint needs) parsed out of our route :id param. */
function parseAgentRouteId(id: string): { chainId: string; tokenId: string } | null {
  const parts = id.split(':').filter(Boolean)
  if (parts.length === 2) {
    const [chainId, tokenId] = parts
    return chainId && tokenId ? { chainId, tokenId } : null
  }
  if (parts.length === 3) {
    // agent_id composite: chain:registry:token
    const [chainId, , tokenId] = parts
    return chainId && tokenId ? { chainId, tokenId } : null
  }
  return null
}

function buildQuery(params: Scan8004ListParams): string {
  const q = new URLSearchParams()
  q.set('limit', String(params.limit ?? 20))
  if (params.cursor) q.set('offset', params.cursor)
  if (params.verified !== undefined) q.set('is_endpoint_verified', String(params.verified))
  // NOTE: `category` has no direct 8004scan filter (it's an AgentDesk
  // `listings` concept) — best-effort maps to their free-text `categories`
  // filter so a category query still narrows results server-side.
  if (params.category) q.set('categories', params.category)
  return q.toString()
}

function authHeaders(): Record<string, string> {
  return env.SCAN8004_API_KEY ? { Authorization: `Bearer ${env.SCAN8004_API_KEY}` } : {}
}

/**
 * List agents from 8004scan (joined with our listings/proof_metrics
 * downstream, not here).
 */
export async function listAgents(params: Scan8004ListParams): Promise<StaleAware<AgentSummary[]>> {
  const cacheKey = JSON.stringify(params)

  if (!env.SCAN8004_API_KEY) {
    const cached = listCache.get(cacheKey)
    return { data: cached?.value ?? [], stale: Boolean(cached), fetchedAt: null }
  }

  try {
    circuit.assertCallAllowed()
    const qs = buildQuery(params)
    const res = await fetchWithTimeout(`${env.SCAN8004_BASE_URL}/api/v1/agents?${qs}`, {
      headers: authHeaders(),
      timeoutMs: 5_000,
    })
    if (!res.ok) throw new Error(`scan8004 listAgents: HTTP ${res.status}`)
    const json = await res.json()
    const parsed = AgentSummaryListResponseSchema.parse(json)
    const data = parsed.items.map(toAgentSummary)
    listCache.set(cacheKey, data)
    circuit.onSuccess()
    return { data, stale: false, fetchedAt: new Date().toISOString() }
  } catch (err) {
    circuit.onFailure()
    const cached = listCache.get(cacheKey)
    logger.warn(
      { err: err instanceof Error ? err.message : err, circuitState: circuit.getState() },
      'scan8004.listAgents: live call failed — serving last-cache fallback',
    )
    if (cached) {
      return { data: cached.value, stale: true, fetchedAt: new Date(cached.fetchedAt).toISOString() }
    }
    if (err instanceof CircuitOpenError) {
      return { data: [], stale: true, fetchedAt: null }
    }
    return { data: [], stale: true, fetchedAt: null }
  }
}

/** Fetch one agent's detail from 8004scan. */
export async function getAgentDetail(agentRouteId: string): Promise<StaleAware<AgentDetail | null>> {
  const cacheKey = agentRouteId
  const ids = parseAgentRouteId(agentRouteId)

  if (!env.SCAN8004_API_KEY || !ids) {
    const cached = detailCache.get(cacheKey)
    return { data: cached?.value ?? null, stale: Boolean(cached), fetchedAt: null }
  }

  try {
    circuit.assertCallAllowed()
    const res = await fetchWithTimeout(
      `${env.SCAN8004_BASE_URL}/api/v1/agents/${ids.chainId}/${ids.tokenId}`,
      { headers: authHeaders(), timeoutMs: 5_000 },
    )
    if (res.status === 404) {
      circuit.onSuccess()
      return { data: null, stale: false, fetchedAt: new Date().toISOString() }
    }
    if (!res.ok) throw new Error(`scan8004 getAgentDetail: HTTP ${res.status}`)
    const json = await res.json()
    const parsed = RawAgentDetailSchema.parse(json)
    const data = toAgentDetail(parsed)
    detailCache.set(cacheKey, data)
    circuit.onSuccess()
    return { data, stale: false, fetchedAt: new Date().toISOString() }
  } catch (err) {
    circuit.onFailure()
    const cached = detailCache.get(cacheKey)
    logger.warn(
      { err: err instanceof Error ? err.message : err, circuitState: circuit.getState() },
      'scan8004.getAgentDetail: live call failed — serving last-cache fallback',
    )
    if (cached) {
      return { data: cached.value, stale: true, fetchedAt: new Date(cached.fetchedAt).toISOString() }
    }
    return { data: null, stale: true, fetchedAt: null }
  }
}

/** Spot-check a claim against the ERC-8004 registry directly (fallback path when 8004scan is stale/down). */
export async function verifyAgentOwnerOnChain(
  _agentId: string,
  _claimedOwner: string,
): Promise<{ matches: boolean } | { matches: null; reason: 'not_implemented' }> {
  // TODO(Phase B): direct registry read via viem against ERC8004_REGISTRY_ADDRESS.
  // Not part of this wave's scope — 8004scan is live and is the primary path;
  // this remains the documented fallback for when 8004scan itself is down.
  return { matches: null, reason: 'not_implemented' }
}
