/*
 * apps/web/lib/agentdesk-client.ts
 *
 * The one sanctioned entry point into `packages/sdk`'s `AgentDeskClient`
 * (CLAUDE.md §6 mock seam) — every page/component gets agent, proof-record,
 * and hire-session data through this singleton, never by importing fixtures
 * or hand-rolled mock data directly.
 *
 * Seam switch: `NEXT_PUBLIC_DEMO_MODE` picks the backing client.
 *   - `"demo"`  (default) → `FixturesAgentDeskClient` (Phase A fixtures)
 *   - any other  → `HttpAgentDeskClient` hitting `apps/api` `/v1/*`
 *
 * HTTP mode currently serves real 8004scan identity; listing/proof/write
 * paths stay explicit defaults until the publish + ERC-8183 flows land.
 */
import {
  FixturesAgentDeskClient,
  HttpAgentDeskClient,
  type AgentDeskClient,
} from '@agentdesk/sdk'

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'demo'

export const client: AgentDeskClient = demoMode
  ? new FixturesAgentDeskClient()
  : new HttpAgentDeskClient(process.env.NEXT_PUBLIC_API_BASE_URL)
