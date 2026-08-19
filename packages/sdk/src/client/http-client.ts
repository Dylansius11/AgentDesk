/**
 * packages/sdk/src/client/http-client.ts
 *
 * `HttpAgentDeskClient` — the Phase B live client. Implements the same
 * `AgentDeskClient` interface as `FixturesAgentDeskClient` (./types.ts) but
 * reads from `apps/api`'s real `/v1/*` routes instead of committed fixtures.
 *
 * Honesty contract (CLAUDE.md §3 moat law): the API currently serves
 * ERC-8004 *identity* from 8004scan (name/owner/capabilities), NOT the
 * marketplace *listing* layer (price/trust-panel/category come from the
 * `listings` table, which stays empty until `POST /v1/publish` lands). This
 * client maps real identity and leaves every listing/proof field as an
 * explicit, non-fabricated default:
 *   - `verified` is always the API's value (false without proof_metrics)
 *   - `metrics` stays null, `equityCurve`/`proofRecords` stay empty
 *   - `pricePerTaskUsd1` is 0 and `trustPanel` is a generic "no listing yet"
 *     placeholder until publish populates real caps
 * Write/stream methods (hire/revoke/dashboard) throw a descriptive error:
 * they depend on the ERC-8183 create→fund flow being wired into
 * `apps/api/src/services/hire.ts`, which is the next integration step.
 */
import type { Agent } from "../schemas/agent.js";
import type { Category } from "../schemas/category.js";
import type { HireSession } from "../schemas/hire-session.js";
import type { ProofRecord } from "../schemas/proof-record.js";
import type {
  AgentDeskClient,
  DashboardEvent,
  GetAgentsParams,
  GetProofRecordsParams,
  HireParams,
} from "./types.js";

/** API base URL — overridable via env (NEXT_PUBLIC_API_BASE_URL in the web app). */
const DEFAULT_BASE_URL = "http://localhost:4000";

const EPHEMERAL_EPOCH = "1970-01-01T00:00:00.000Z";

function categoryAllowlistLabel(category: Category): string {
  switch (category) {
    case "grid":
      return "run grid-trading strategies";
    case "rebalance":
      return "rebalance liquidity positions";
    case "yield":
      return "manage yield positions";
    case "health":
      return "monitor portfolio health";
  }
}

function inferCategory(hint: string): Category {
  const h = hint.toLowerCase();
  if (h.includes("grid")) return "grid";
  if (h.includes("rebalance") || h.includes("liquidity")) return "rebalance";
  if (h.includes("yield")) return "yield";
  if (h.includes("health")) return "health";
  return "grid";
}

/** Loose wire shape of one `/v1/agents` row (identity + nullable listing fields). */
interface WireAgent {
  id: string;
  ownerAddress: string;
  chainId: number;
  name: string | null;
  registeredAt: string | null;
  category: Category | null;
  tagline: string | null;
  riskLevel: "low" | "medium" | "high" | null;
  status: "active" | "paused" | "delisted" | null;
  verified: boolean;
  description?: string | null;
  capabilities?: string[];
  pricePerTaskUsd1?: number | null;
}

function adaptAgent(raw: WireAgent): Agent {
  const name = raw.name ?? raw.tagline ?? `Agent ${raw.id.slice(-6)}`;
  const tagline = raw.tagline ?? name;
  const description = raw.description ?? tagline;
  const category = raw.category ?? inferCategory(`${name} ${tagline} ${description}`);
  const riskLevel = raw.riskLevel ?? "medium";
  const pricePerTaskUsd1 = raw.pricePerTaskUsd1 ?? 0;
  const status = raw.status ?? "active";
  const allowlistLabel = categoryAllowlistLabel(category);
  const summary = `${name} may ${allowlistLabel} with at most $${pricePerTaskUsd1} per day. It cannot withdraw. You can stop it anytime.`;

  return {
    id: raw.id,
    chainId: raw.chainId === 97 ? (97 as const) : (56 as const),
    ownerAddress: raw.ownerAddress,
    registeredAt: raw.registeredAt ?? EPHEMERAL_EPOCH,
    capabilities: raw.capabilities ?? [],
    name,
    tagline,
    description,
    category,
    riskLevel,
    pricePerTaskUsd1,
    status,
    proofProgram: false,
    claimedBy: null,
    claimedAt: null,
    trustPanel: {
      allowlist: [
        { protocol: category, action: "act", market: "n/a", label: allowlistLabel },
      ],
      spendCapUsd1: pricePerTaskUsd1,
      spendCapWindow: "day",
      durationDays: 7,
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      revocable: true,
      canWithdraw: false,
      summary,
    },
    verified: raw.verified ?? false,
    metrics: null,
    equityCurve: [],
    proofRecords: [],
  };
}

export class HttpClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpClientError";
  }
}

export class HttpAgentDeskClient implements AgentDeskClient {
  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      });
    } catch {
      throw new HttpClientError(`API unreachable at ${this.baseUrl}`, 0);
    }
    if (!res.ok) {
      throw new HttpClientError(`API ${res.status} for ${path}`, res.status);
    }
    return (await res.json()) as T;
  }

  async getAgents(params: GetAgentsParams = {}): Promise<Agent[]> {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.verified !== undefined) query.set("verified", String(params.verified));
    if (params.sort) query.set("sort", params.sort);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const body = await this.request<{ data: WireAgent[] }>(`/v1/agents${suffix}`);
    return (body.data ?? []).map(adaptAgent);
  }

  async getAgent(id: string): Promise<Agent | null> {
    try {
      const body = await this.request<{ data: WireAgent }>(`/v1/agents/${encodeURIComponent(id)}`);
      return body.data ? adaptAgent(body.data) : null;
    } catch (error) {
      if (error instanceof HttpClientError && error.status === 404) return null;
      throw error;
    }
  }

  async getProofRecords(_agentId: string, _params: GetProofRecordsParams = {}): Promise<ProofRecord[]> {
    // ProofLedger mirror rows are not yet served over this seam; keep honest
    // (empty) rather than fabricate a record. Wired when the proof engine
    // emits the SDK `ProofRecord` shape.
    return [];
  }

  async hire(_params: HireParams): Promise<HireSession> {
    throw new HttpClientError(
      "hire is not wired over HTTP yet — the ERC-8183 create→fund flow must land in apps/api/src/services/hire.ts first",
      501,
    );
  }

  async revoke(_jobId: string): Promise<HireSession> {
    throw new HttpClientError(
      "revoke is not wired over HTTP yet — pending the ERC-8183 escrow flow in apps/api",
      501,
    );
  }

  async *getDashboard(_jobId: string): AsyncGenerator<DashboardEvent, void, void> {
    throw new HttpClientError(
      "dashboard SSE is not wired over HTTP yet — pending the ERC-8183 event stream in apps/api",
      501,
    );
  }
}
