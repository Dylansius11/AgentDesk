/**
 * packages/sdk/src/fixtures/index.ts
 *
 * Twelve simulated marketplace fixtures (3 per category, exactly 2
 * unverified) plus one live local ERC-8183 canary and a couple of sample
 * hire sessions. This is the mock seam's data; the future fixture-backed
 * `AgentDeskClient` (task B1) reads from here; nothing in `apps/*` should
 * import fixture files directly (CLAUDE.md §6).
 */

import type { Agent } from '../schemas/agent.js'
import { ERC8183_CANARY } from './agents/canary.js'
import { GRID_AGENTS } from './agents/grid.js'
import { HEALTH_AGENTS } from './agents/health.js'
import { REBALANCE_AGENTS } from './agents/rebalance.js'
import { YIELD_AGENTS } from './agents/yield.js'

export { HIRE_SESSIONS } from './hire-sessions.js'
export { ERC8183_CANARY, GRID_AGENTS, HEALTH_AGENTS, REBALANCE_AGENTS, YIELD_AGENTS }

/** Twelve simulated marketplace fixtures plus one local live ERC-8183 canary. */
export const AGENTS: Agent[] = [
  ...GRID_AGENTS,
  ...REBALANCE_AGENTS,
  ...YIELD_AGENTS,
  ...HEALTH_AGENTS,
  ERC8183_CANARY,
]

/** Convenience lookup mirroring how a real client would key by ERC-8004 id. */
export const AGENTS_BY_ID: Record<string, Agent> = Object.fromEntries(
  AGENTS.map((agent) => [agent.id, agent]),
)
