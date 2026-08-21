/**
 * packages/sdk/src/client/types.ts
 *
 * The `AgentDeskClient` interface — CLAUDE.md §6's "mock seam": `apps/web`
 * pages consume this interface only, never fixtures and never `fetch`
 * directly. Two implementations satisfy it:
 *   - Phase A (this task, B1): `FixturesAgentDeskClient` (./fixtures-client.ts)
 *     reads the 12 committed agent fixtures with artificial latency.
 *   - Phase B (B1.1, blocked on 8004scan/Altana API keys): a Hono-backed
 *     HTTP client hitting `apps/api`'s real `/v1/*` routes.
 *
 * Every method signature below is deliberately shaped against ERD.md §4's
 * API surface table and against the route stubs that already exist in
 * `apps/api/src/routes/v1/*` (agents.ts, proof.ts, jobs.ts, sessions.ts) —
 * this is genuinely the contract Phase B's client has to fulfil too, not a
 * Phase-A-only convenience shape:
 *
 *   getAgents         ~ GET /v1/agents?category&verified&sort
 *   getAgent          ~ GET /v1/agents/:id
 *   getProofRecords   ~ GET /v1/agents/:id/proof (paginated)
 *   hire              ~ POST /v1/jobs (+ /v1/jobs/:id/fund, orchestrated
 *                       behind one call for the mock — see fixtures-client.ts)
 *   revoke            ~ POST /v1/jobs/:id/revoke
 *   getDashboard      ~ GET /v1/jobs/:id/events (SSE) — see apps/api's
 *                       `streamJobEvents(): AsyncGenerator<JobEvent>` stub in
 *                       services/hire.ts, which this intentionally mirrors in
 *                       shape (`type`/`jobId`/`at` fields) so wiring the real
 *                       SSE-backed client later is close to mechanical.
 *
 * Return values are already-unwrapped, schema-typed domain objects (never a
 * raw `{ data: ... }` HTTP envelope) — envelope parsing is an implementation
 * detail of whichever concrete client is doing the actual network call.
 *
 * Not in scope for this interface: CLAUDE.md §6's "typed (zod), timeout,
 * circuit breaker, last-cache fallback" per-external-call rule applies to
 * Phase B's real client, which makes real 8004scan/Altana network calls.
 * `FixturesAgentDeskClient` makes none — it only reads local fixture data —
 * so timeout/circuit-breaker/staleness-chip plumbing is N-A here and belongs
 * in the Phase B implementation instead.
 */
import type { Agent } from "../schemas/agent.js";
import type { AgentId, Address } from "../schemas/primitives.js";
import type { Category } from "../schemas/category.js";
import type { HireConfig, HireSession } from "../schemas/hire-session.js";
import type { ProofRecord } from "../schemas/proof-record.js";

// ── getAgents ──

export type AgentsSort = "verifiedReturn" | "winRate" | "newest";

export interface GetAgentsParams {
  category?: Category;
  /** Filter to verified-only or unverified-only; omit for both. */
  verified?: boolean;
  /** Default (omitted): fixture/registry order. Agents with no metrics sort last on either numeric sort. */
  sort?: AgentsSort;
}

// ── getProofRecords ──

export interface GetProofRecordsParams {
  /** `"pending"` = outcome is null (registered, deadline not yet resolved); `"resolved"` = outcome present. Omit for both. */
  status?: "pending" | "resolved";
  /** Slice offset, applied after status filtering and chronological (registeredAt asc) sort. */
  offset?: number;
  /** Max records to return after offset. Omit for unbounded. */
  limit?: number;
}

// ── hire ──

export interface HireParams {
  agentId: AgentId;
  hirerAddress: Address;
  config: HireConfig;
}

// ── getDashboard ──

/**
 * Live dashboard feed event (F5's AC: "Feed ticks every 5s from scripted
 * fixture events"). Field names (`type`/`jobId`/`at`) intentionally match
 * `apps/api/src/services/hire.ts`'s `JobEvent` stub shape for an easy swap;
 * unlike that stub's untyped `payload: Record<string, unknown>`, this is a
 * discriminated union so consumers get real types per event kind. Job
 * lifecycle events (`created`/`funded`) are deliberately NOT part of this
 * stream — those are request/response outcomes of `hire()` itself, not
 * live-feed ticks; only what happens *after* a job is already active shows
 * up here. Flag this divergence to whoever wires the real SSE client in
 * B1.1 (`apps/api`'s stub union currently includes created/funded too).
 */
export type DashboardEventType =
  | "connected"
  | "decision_registered"
  | "outcome_attested"
  | "pnl_update"
  | "session_revoked";

interface DashboardEventBase {
  jobId: string;
  at: string; // IsoDatetime
}

export type DashboardEvent =
  | (DashboardEventBase & { type: "connected" })
  | (DashboardEventBase & { type: "decision_registered"; record: ProofRecord })
  | (DashboardEventBase & { type: "outcome_attested"; record: ProofRecord })
  | (DashboardEventBase & {
      type: "pnl_update";
      /** Cumulative USD1 P&L across outcome_attested events emitted so far in THIS stream (i.e. "since hire", per F5's "P&L-since-hire counter" — not the agent's all-time verified return). */
      cumulativePnlUsd1: number;
      sinceHireOnly: true;
    })
  | (DashboardEventBase & {
      type: "session_revoked";
      revokedAt: string; // IsoDatetime
      revokeTx: string; // TxHash
    });

/**
 * The mock seam interface. `getDashboard` is an async generator (not a
 * callback) so "STOP kills the feed" is just breaking out of the caller's
 * `for await` loop or calling `.return()` on the generator — no separate
 * unsubscribe handle to manage. A real SSE-backed implementation adapts an
 * `EventSource`/fetch-stream reader into the same generator shape.
 */
export interface AgentDeskClient {
  getAgents(params?: GetAgentsParams): Promise<Agent[]>;
  /** `null` when no agent with this id exists — mirrors a real client's 404. */
  getAgent(id: AgentId): Promise<Agent | null>;
  getProofRecords(agentId: AgentId, params?: GetProofRecordsParams): Promise<ProofRecord[]>;
  /** Throws if `agentId` doesn't resolve to a known agent. */
  hire(params: HireParams): Promise<HireSession>;
  /** Throws if `jobId` doesn't resolve to a known session. Idempotent: revoking an already-revoked job returns its current state without error. */
  revoke(jobId: string): Promise<HireSession>;
  /** Throws if `jobId` doesn't resolve to a known session. Ends (returns) the moment the job is revoked, after emitting one final `session_revoked` event. */
  getDashboard(jobId: string): AsyncGenerator<DashboardEvent, void, void>;
}
