/**
 * packages/sdk/src/fixtures/index.ts
 *
 * The 12-agent mock roster (3 per category, exactly 2 unverified) plus a
 * couple of sample hire sessions. This is the mock seam's data — the future
 * fixture-backed `AgentDeskClient` (task B1) reads from here; nothing in
 * `apps/*` should import fixture files directly (CLAUDE.md §6).
 */
import { GRID_AGENTS } from "./agents/grid.js";
import { REBALANCE_AGENTS } from "./agents/rebalance.js";
import { YIELD_AGENTS } from "./agents/yield.js";
import { HEALTH_AGENTS } from "./agents/health.js";
import type { Agent } from "../schemas/agent.js";

export { GRID_AGENTS, REBALANCE_AGENTS, YIELD_AGENTS, HEALTH_AGENTS };
export { HIRE_SESSIONS } from "./hire-sessions.js";

/** All 12 mock agents, 3 per category. */
export const AGENTS: Agent[] = [...GRID_AGENTS, ...REBALANCE_AGENTS, ...YIELD_AGENTS, ...HEALTH_AGENTS];

/** Convenience lookup mirroring how a real client would key by ERC-8004 id. */
export const AGENTS_BY_ID: Record<string, Agent> = Object.fromEntries(AGENTS.map((agent) => [agent.id, agent]));
