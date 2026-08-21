/**
 * packages/sdk/src/erc8183.ts
 *
 * ERC-8183 buyer-side surface: contract addresses + the negotiation
 * canonicalization that anchors a seller's signed quote in the on-chain job
 * description. `buildJobDescription` is a faithful port of the bnbagent
 * Python SDK's `build_job_description` (verified byte-for-byte against the
 * job-548 canary) — it must stay in exact lock-step with that canonicalization
 * or `ecrecover(negotiation_hash, provider_sig) == job.provider` breaks.
 */

/** BSC testnet (chain 97) ERC-8183 deployment, confirmed on-chain during the job-548 canary. */
export const ERC8183_ADDRESSES = {
  /** AgenticCommerce escrow contract (createJob/fund/submit/settle). */
  commerce: "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE",
  /** EvaluatorRouter (registerJob + settle dispatch). */
  router: "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25",
  /** OptimisticPolicy (dispute window + voting). */
  policy: "0xd6a4217588F6B1F5657a92A3E94E6422aD771cEA",
  /** $U settlement token (ERC-20, 18 decimals). */
  usdToken: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
} as const;

export type Erc8183Addresses = typeof ERC8183_ADDRESSES;

/** The wire envelope a seller's `/negotiate` A2A skill returns. */
export interface NegotiationEnvelope {
  request?: { task_description?: string; terms?: Record<string, unknown> };
  response?: {
    accepted?: boolean;
    terms?: Record<string, unknown>;
    quote_expires_at?: number | string;
    negotiated_at?: number | string;
  };
  negotiation_hash?: string;
  provider_sig?: string;
  chain_id?: number;
  verifying_contract?: string;
}

/** Port of bnbagent `_sanitize_for_claim`: UMA claim-marker + control-char safety. */
function sanitizeForClaim(value: unknown): string {
  if (typeof value !== "string") return String(value);
  let result = value.replace(/\[/g, "(").replace(/\]/g, ")");
  result = [...result]
    .filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x20 || ch === "\t" || ch === "\n")
    .join("");
  return result;
}

/** Recursively sort object keys — mirrors Python `json.dumps(sort_keys=True)`. */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Build the on-chain `createJob` description string from a seller's signed
 * negotiation envelope. The output is the canonical JSON the seller's
 * `provider_sig` actually signed, so it can be ecrecover-verified on-chain.
 */
export function buildJobDescription(envelope: NegotiationEnvelope): string {
  const response = envelope.response ?? {};
  const request = envelope.request ?? {};
  if (!response.accepted) {
    throw new Error("Cannot build description from a rejected negotiation");
  }
  const responseTerms = response.terms ?? {};
  const price = String(responseTerms.price ?? "");
  const currency = String(responseTerms.currency ?? "");
  if (!price) throw new Error("Negotiation response missing price");
  if (!currency) throw new Error("Negotiation response missing currency");

  const terms: Record<string, unknown> = {
    deliverables: sanitizeForClaim(responseTerms.deliverables ?? ""),
    quality_standards: sanitizeForClaim(responseTerms.quality_standards ?? ""),
  };
  if (Array.isArray(responseTerms.success_criteria)) {
    terms.success_criteria = (responseTerms.success_criteria as unknown[]).map(sanitizeForClaim);
  }

  const negotiatedAt =
    (envelope.response?.negotiated_at as number | undefined) ??
    (envelope.response?.negotiated_at as string | undefined) ??
    Math.floor(Date.now() / 1000);
  const quoteExpiresAt = envelope.response?.quote_expires_at;

  const content: Record<string, unknown> = {
    version: 1,
    negotiated_at: negotiatedAt,
    task: sanitizeForClaim(request.task_description ?? ""),
    terms,
    price,
    currency,
  };
  if (quoteExpiresAt != null) content.quote_expires_at = quoteExpiresAt;
  if (envelope.chain_id != null) content.chain_id = envelope.chain_id;
  if (envelope.verifying_contract != null) {
    content.verifying_contract = envelope.verifying_contract;
  }
  if (envelope.negotiation_hash) content.negotiation_hash = envelope.negotiation_hash;
  if (envelope.provider_sig) content.provider_sig = envelope.provider_sig;

  const description = JSON.stringify(sortKeysDeep(content));
  if (new TextEncoder().encode(description).length > 4096) {
    throw new Error("on-chain description exceeds 4096 bytes");
  }
  return description;
}

/**
 * POST the `negotiate` A2A skill to a seller and return its signed envelope.
 * The seller is the source of truth for price/terms; the buyer only anchors
 * what the seller signed.
 */
export async function negotiateWithSeller(
  endpoint: string,
  taskDescription: string,
): Promise<NegotiationEnvelope> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "message/send",
    params: {
      message: {
        role: "user",
        messageId: crypto.randomUUID(),
        parts: [
          {
            kind: "data",
            data: {
              skill: "negotiate",
              task_description: taskDescription,
              terms: {
                deliverables: "deterministic deliverable",
                quality_standards: "no LLM, verifiable",
              },
            },
          },
        ],
      },
    },
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`negotiate failed: HTTP ${res.status}`);
  const json = (await res.json()) as { result?: { parts?: { data?: NegotiationEnvelope }[] } };
  const envelope = json?.result?.parts?.[0]?.data;
  if (!envelope) throw new Error("negotiate response missing envelope");
  return envelope;
}
