/**
 * packages/sdk/src/client/fixtures-client.ts
 *
 * `FixturesAgentDeskClient` — the Phase A implementation of `AgentDeskClient`
 * (./types.ts). Reads the 12 committed, PM-verified agent fixtures
 * (`../fixtures`) plus a small in-memory hire-session store seeded from
 * `HIRE_SESSIONS`. Nothing outside `packages/sdk/src/client/*` should ever
 * import `../fixtures` directly (CLAUDE.md §6 mock seam) — this class is the
 * only consumer apps are meant to reach through.
 *
 * All mutation (hire/revoke) happens on deep clones held in `this.sessions`
 * — the original fixture exports (`AGENTS`, `HIRE_SESSIONS`) are never
 * mutated, so repeated `new FixturesAgentDeskClient()` instances (e.g. one
 * per test) start from clean, identical state.
 */
import { randomUUID } from "node:crypto";
import type { Agent } from "../schemas/agent";
import type { HireSession } from "../schemas/hire-session";
import { HireSessionSchema } from "../schemas/hire-session";
import type { ProofRecord } from "../schemas/proof-record";
import { AGENTS, AGENTS_BY_ID, HIRE_SESSIONS } from "../fixtures";
import { mkHex32 } from "../fixtures/helpers";
import { simulateLatency, sleep } from "./latency";
import type {
  AgentDeskClient,
  AgentsSort,
  DashboardEvent,
  GetAgentsParams,
  GetProofRecordsParams,
  HireParams,
} from "./types";

/** Matches INTEGRATION.md's `PROTOCOL_FEE_BPS=300` (3%). */
const PROTOCOL_FEE_BPS = 300;

/** Dashboard feed cadence — F5's AC: "Feed ticks every 5s from scripted fixture events." */
const DASHBOARD_TICK_MS = 5000;
/** How often the dashboard loop checks for a revoke while waiting out a tick — keeps STOP feeling instant without abandoning the 5s script cadence. */
const DASHBOARD_REVOKE_POLL_MS = 250;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function byRegisteredAtAsc(a: ProofRecord, b: ProofRecord): number {
  return Date.parse(a.decision.registeredAt) - Date.parse(b.decision.registeredAt);
}

function sortAgents(list: Agent[], sort: AgentsSort): Agent[] {
  const key = (agent: Agent): number => {
    switch (sort) {
      case "newest":
        return Date.parse(agent.registeredAt);
      case "winRate":
        return agent.metrics?.winRate ?? Number.NEGATIVE_INFINITY;
      case "verifiedReturn":
        return agent.metrics?.verifiedReturnPct ?? Number.NEGATIVE_INFINITY;
      default:
        return 0;
    }
  };
  return [...list].sort((a, b) => key(b) - key(a));
}

export class FixturesAgentDeskClient implements AgentDeskClient {
  /** jobId -> live session state. Seeded from the committed HIRE_SESSIONS fixtures, then grows via hire(). */
  private readonly sessions = new Map<string, HireSession>(
    HIRE_SESSIONS.map((session) => [session.id, clone(session)]),
  );

  async getAgents(params: GetAgentsParams = {}): Promise<Agent[]> {
    await simulateLatency();
    let list = AGENTS.map(clone);
    if (params.category) {
      list = list.filter((agent) => agent.category === params.category);
    }
    if (params.verified !== undefined) {
      list = list.filter((agent) => agent.verified === params.verified);
    }
    if (params.sort) {
      list = sortAgents(list, params.sort);
    }
    return list;
  }

  async getAgent(id: string): Promise<Agent | null> {
    await simulateLatency();
    const agent = AGENTS_BY_ID[id];
    return agent ? clone(agent) : null;
  }

  async getProofRecords(agentId: string, params: GetProofRecordsParams = {}): Promise<ProofRecord[]> {
    await simulateLatency();
    const agent = AGENTS_BY_ID[agentId];
    if (!agent) return [];
    let records = agent.proofRecords.map(clone).sort(byRegisteredAtAsc);
    if (params.status === "pending") {
      records = records.filter((record) => record.outcome === null);
    } else if (params.status === "resolved") {
      records = records.filter((record) => record.outcome !== null);
    }
    if (params.offset) {
      records = records.slice(params.offset);
    }
    if (params.limit !== undefined) {
      records = records.slice(0, params.limit);
    }
    return records;
  }

  async hire(params: HireParams): Promise<HireSession> {
    await simulateLatency();
    const agent = AGENTS_BY_ID[params.agentId];
    if (!agent) {
      throw new Error(`FixturesAgentDeskClient.hire: unknown agentId "${params.agentId}"`);
    }
    const now = new Date().toISOString();
    const jobId = `job-mock-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + params.config.durationDays * 24 * 60 * 60 * 1000).toISOString();
    const session: HireSession = {
      id: jobId,
      escrowRef: mkHex32(`${jobId}:escrow`),
      agentId: params.agentId,
      hirerAddress: params.hirerAddress,
      status: "active",
      config: clone(params.config),
      feeUsd1: round2((params.config.amountUsd1 * PROTOCOL_FEE_BPS) / 10_000),
      session: {
        id: `keystore-${jobId}`,
        expiresAt,
        revokedAt: null,
        revokeTx: null,
        keystoreTx: mkHex32(`${jobId}:keystore-tx`),
      },
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    // Belt-and-suspenders: a session this client hands back must itself satisfy
    // the schema it's typed against (CLAUDE.md moat-adjacent object discipline).
    HireSessionSchema.parse(session);
    this.sessions.set(jobId, session);
    return clone(session);
  }

  async revoke(jobId: string): Promise<HireSession> {
    await simulateLatency();
    const session = this.sessions.get(jobId);
    if (!session) {
      throw new Error(`FixturesAgentDeskClient.revoke: unknown jobId "${jobId}"`);
    }
    if (session.status !== "revoked") {
      const now = new Date().toISOString();
      const revoked: HireSession = {
        ...session,
        status: "revoked",
        session: {
          ...session.session,
          revokedAt: now,
          revokeTx: mkHex32(`${jobId}:revoke-tx:${now}`),
        },
        updatedAt: now,
      };
      HireSessionSchema.parse(revoked);
      this.sessions.set(jobId, revoked);
      return clone(revoked);
    }
    return clone(session);
  }

  async *getDashboard(jobId: string): AsyncGenerator<DashboardEvent, void, void> {
    if (!this.sessions.has(jobId)) {
      throw new Error(`FixturesAgentDeskClient.getDashboard: unknown jobId "${jobId}"`);
    }

    const agentId = this.sessions.get(jobId)?.agentId;
    const agent = agentId ? AGENTS_BY_ID[agentId] : undefined;
    const scriptRecords = agent ? [...agent.proofRecords].sort(byRegisteredAtAsc) : [];

    let cursor = 0;
    let cumulativePnlUsd1 = 0;

    yield { type: "connected", jobId, at: new Date().toISOString() };

    while (true) {
      const revokedNow = await this.waitTickOrRevoke(jobId);
      if (revokedNow) {
        const latest = this.sessions.get(jobId);
        const revokedAt = latest?.session.revokedAt ?? new Date().toISOString();
        const revokeTx = latest?.session.revokeTx ?? mkHex32(`${jobId}:revoke-tx:fallback`);
        yield { type: "session_revoked", jobId, at: revokedAt, revokedAt, revokeTx };
        return;
      }

      if (scriptRecords.length === 0) {
        // No proof history for this agent yet (fresh/unverified listing) — still
        // tick visibly (F5 AC) without inventing a fake trade to show.
        yield {
          type: "pnl_update",
          jobId,
          at: new Date().toISOString(),
          cumulativePnlUsd1: round2(cumulativePnlUsd1),
          sinceHireOnly: true,
        };
        continue;
      }

      const record = scriptRecords[cursor % scriptRecords.length];
      cursor += 1;
      if (!record) continue; // unreachable (scriptRecords.length > 0 guarded above); satisfies noUncheckedIndexedAccess

      if (record.outcome === null) {
        yield { type: "decision_registered", jobId, at: new Date().toISOString(), record: clone(record) };
        continue;
      }

      cumulativePnlUsd1 += record.outcome.pnlUsd1;
      yield { type: "outcome_attested", jobId, at: new Date().toISOString(), record: clone(record) };
      yield {
        type: "pnl_update",
        jobId,
        at: new Date().toISOString(),
        cumulativePnlUsd1: round2(cumulativePnlUsd1),
        sinceHireOnly: true,
      };
    }
  }

  /** Polls at DASHBOARD_REVOKE_POLL_MS granularity for up to DASHBOARD_TICK_MS; resolves `true` the moment revoke() lands, else `false` once the full tick elapses. */
  private async waitTickOrRevoke(jobId: string): Promise<boolean> {
    const deadline = Date.now() + DASHBOARD_TICK_MS;
    while (Date.now() < deadline) {
      if (this.isRevoked(jobId)) return true;
      await sleep(Math.min(DASHBOARD_REVOKE_POLL_MS, Math.max(0, deadline - Date.now())));
    }
    return this.isRevoked(jobId);
  }

  private isRevoked(jobId: string): boolean {
    return this.sessions.get(jobId)?.status === "revoked";
  }
}
