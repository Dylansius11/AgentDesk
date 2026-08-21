/*
 * apps/web/lib/agentdesk-client.ts
 *
 * The one sanctioned entry point into `packages/sdk`'s `AgentDeskClient`
 * (CLAUDE.md §6 mock seam) — every page/component gets agent, proof-record,
 * and hire-session data through this singleton, never by importing fixtures
 * or hand-rolled mock data directly.
 *
 * Seam switch: `NEXT_PUBLIC_DEMO_MODE` picks the backing client.
 *   - unset / `"demo"`  (default) → `FixturesAgentDeskClient` (Phase A fixtures)
 *   - `"http"`          → `HttpAgentDeskClient` hitting `apps/api` `/v1/*`
 *
 * HTTP mode currently serves real 8004scan identity; listing/proof/write
 * paths stay explicit defaults until the publish + ERC-8183 flows land.
 */
import { type AgentDeskClient, FixturesAgentDeskClient, HttpAgentDeskClient } from '@agentdesk/sdk'

export const isFixtureMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'http'

export const client: AgentDeskClient = isFixtureMode
  ? new FixturesAgentDeskClient()
  : new HttpAgentDeskClient(process.env.NEXT_PUBLIC_API_BASE_URL)
