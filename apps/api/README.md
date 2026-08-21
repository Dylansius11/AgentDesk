# apps/api — placeholder

AgentDesk's REST + SSE API service. **Not implemented yet** (BUILD-PLAN Phase B, task B1.1).

Planned stack (see `docs/technical/TECH-STACK.md` §2.3 and `docs/technical/ARCHITECTURE.md`):

- Hono 4.x on Node 22, deployed to Railway (single always-on service)
- Routes: `src/routes/v1/{agents,proof,jobs,sessions}.ts` + SSE `/v1/events`
- Drizzle ORM + Supabase Postgres (`src/db/` is the ERD source of truth)
- Implements the `AgentDeskClient` interface from `packages/sdk`

Once scaffolded: `pnpm --filter api dev` → http://localhost:4000
