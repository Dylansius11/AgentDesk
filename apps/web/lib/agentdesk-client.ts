/*
 * apps/web/lib/agentdesk-client.ts
 *
 * The one sanctioned entry point into `packages/sdk`'s `AgentDeskClient`
 * (CLAUDE.md §6 mock seam) — every page/component gets agent, proof-record,
 * and hire-session data through this singleton, never by importing fixtures
 * or hand-rolled mock data directly. Phase A: fixtures-backed. Phase B swaps
 * this for an HTTP client hitting `apps/api`'s real `/v1/*` routes without
 * any page needing to change, since both satisfy the same `AgentDeskClient`
 * interface.
 */
import { FixturesAgentDeskClient, type AgentDeskClient } from '@agentdesk/sdk'

export const client: AgentDeskClient = new FixturesAgentDeskClient()
