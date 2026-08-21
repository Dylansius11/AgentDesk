"""Single MCP seller agent entrypoint (the `--protocol MCP` peer to main.py).

This is the VALUABLE agent AND the SOLE key-holder/signer, serving its seller
surface over the **Model Context Protocol** instead of A2A. AWS Bedrock
AgentCore hosts MCP natively: it expects a streamable-HTTP MCP server on
`0.0.0.0:8000/mcp` and wraps the protocol (session isolation, inbound
OAuth/Cognito auth, scale-to-zero) exactly as it does for A2A. There is no
separate forwarding service — the agent IS the seller.

MCP tools (all backed by signing.py fixed code — NEVER LLM-callable):

    negotiate      → read the FIXED list price → CLAMP to [min,max] → EIP-191 SIGN
                     the offer (no LLM). A message signature; no on-chain tx, no nonce.
    notify_funded  → verify the funded job carries THIS agent's signed quote →
                     produce the deliverable (LLM) → submit_result (SIGN + broadcast
                     on-chain) — all **synchronously within this one tool call**, then
                     return the on-chain result.
    + the read-only chain tools (wallet / balances / ERC-8004 / ERC-8183 / block /
      tx / contract-view), so an MCP client can inspect state.

## How delivery works under MCP (synchronous, ≤ ~15 min)

A2A acks then finishes the work + on-chain `submit` in a background task kept
alive by reporting `HEALTHY_BUSY` to AgentCore's `/ping`. A FastMCP server has no
such hook (its only liveness is the platform's `/mcp/` probe). So under MCP the
documented long-running pattern is **synchronous**: `notify_funded` does the whole
verify → LLM work → submit **inside the single tool invocation** (AgentCore allows
a synchronous request to run up to ~15 minutes), using `ctx.report_progress` as a
heartbeat to keep the connection alive across the steps. The runtime is therefore
**stateful** (`stateless_http=False`) so progress notifications work. The blocking
signing calls run in a worker thread (`asyncio.to_thread`) so the event loop — and
the platform's liveness probe — stays responsive during the call.

## Boundaries (do NOT cross — they are the whole point)

- ALL on-chain SIGNING is FIXED code in `signing.py` — NEVER an MCP/LLM-callable
  signing tool. There is no raw `sign(...)` tool: only the bounded `negotiate`
  (sign a quote) and `notify_funded` (submit a verified, funded job) sign, and the
  LLM only produces the deliverable TEXT inside `notify_funded`.
- The price is a FIXED list price from studio.toml (clamped before signing).
- The chain tools exposed here are READ-ONLY.

You own this file — specialise the work prompt / dispatch, but keep signing bounded
to these two ops and keep the read tools read-only.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys

from mcp.server.fastmcp import Context, FastMCP

import signing
from bnbagent_studio_core.erc8183.errors import SubmitPermanentlyUnsupportedError
from bnbagent_studio_core.wallet import (
    ensure_keystore_materialized,
    ensure_twak_materialized,
)

# Read-only chain query functions (no signing, no on-chain state change).
from bnbagent_studio_core.tools.chain_readonly import (
    agent_by_address,
    agent_info,
    balance_native,
    balance_u,
    block_info,
    contract_call_view,
    job_count,
    job_list,
    job_status,
    network_info,
    pieverse_usage,
    tx_status,
    wallet_address,
    wallet_info,
    wallet_list,
)

logger = logging.getLogger("seller-agent.mcp")
APP_NAME = "agent"


# --- Logging -------------------------------------------------------------------
def _configure_logging() -> None:
    log = logging.getLogger("seller-agent")
    if log.handlers:  # idempotent (cold start may re-import)
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    log.addHandler(handler)
    log.setLevel(logging.INFO)
    log.propagate = False


_configure_logging()


# --- Runtime secrets -----------------------------------------------------------
# Keep plaintext secrets OUT of agentcore.json. When BNBAGENT_RUNTIME_SECRET_ID is
# set (deployed runtime), pull a JSON {ENV_NAME: value} blob from AWS Secrets
# Manager into the process env BEFORE anything reads it. No-op locally (setdefault
# never overrides an already-present var from .env.local).
def _load_runtime_secrets() -> None:
    secret_id = os.environ.get("BNBAGENT_RUNTIME_SECRET_ID")
    if not secret_id:
        return
    import boto3

    resp = boto3.client("secretsmanager").get_secret_value(SecretId=secret_id)
    for key, value in json.loads(resp["SecretString"]).items():
        os.environ.setdefault(key, str(value))


_load_runtime_secrets()

# --- Wallet bootstrap -----------------------------------------------------------
# Wallet material is NEVER bundled into the deploy artifact. `bag deploy` injects
# it via Secrets Manager and these calls (run once at cold start, before any
# signing) materialize it on disk. Each is a no-op for the other wallet kind and
# locally, where the wallet already lives on disk.
ensure_keystore_materialized()
ensure_twak_materialized()


def _generator_tag() -> str:
    """Deliverable ``generator`` label: this seller's own name from studio.toml
    ``[project].name`` (minus the ``-agent`` suffix). Best-effort."""
    try:
        from bnbagent_studio_core import config

        name = str(((config.load_studio_toml() or {}).get("project") or {}).get("name") or "")
    except Exception:  # noqa: BLE001 — a metadata label must never break delivery
        return APP_NAME
    return name[: -len("-agent")] if name.endswith("-agent") else (name or APP_NAME)


GENERATOR = _generator_tag()


# --- LLM work hook (lazy: built on first delivery; negotiate never needs it) ----
# Deferred construction keeps the negotiate-only path (and a cold start that only
# quotes) from building the model, and keeps this module importable without the
# ADK / provider deps until a deliverable is actually produced.
_runner = None


def _get_runner():
    global _runner
    if _runner is None:
        from google.adk.agents import Agent
        from google.adk.runners import InMemoryRunner

        from managed_model import build_model
        from tools import LLM_READ_TOOLS

        agent = Agent(
            name="seller_agent",
            model=build_model(),  # managed model w/ budget-gated LLM-credit auto-renew
            instruction=(
                "You are a seller agent. You do the actual work once a job is funded. "
                "Be concrete and concise. Use the read-only chain tools when on-chain "
                "context helps. If a paid-data tool such as `buy_with_x402` is "
                "available to you, USE IT to fetch the data a task needs — those "
                "merchants (e.g. CoinMarketCap) charge via on-chain wallet payment, "
                "NOT an API key; never reply that you cannot complete the task for "
                "lack of an API key."
            ),
            # READ-ONLY chain tools; signing is never an LLM tool. To add
            # PAID x402 fetch tools (bag x402 trust + x402-buyer recipe):
            #   from x402_buyer import x402_buyer_set
            #   tools=[*LLM_READ_TOOLS, *x402_buyer_set],
            tools=LLM_READ_TOOLS,
        )
        _runner = InMemoryRunner(agent=agent, app_name=APP_NAME)
    return _runner


async def _run_llm(prompt: str, *, session_id: str) -> str:
    """Run the agent once and return the concatenated final-response text."""
    from google.genai import types as gtypes

    runner = _get_runner()
    session_service = runner.session_service
    existing = await session_service.get_session(
        app_name=runner.app_name, user_id="service", session_id=session_id
    )
    if existing is None:
        await session_service.create_session(
            app_name=runner.app_name, user_id="service", session_id=session_id
        )
    user_msg = gtypes.Content(role="user", parts=[gtypes.Part(text=prompt)])
    parts: list[str] = []
    async for event in runner.run_async(
        user_id="service", session_id=session_id, new_message=user_msg
    ):
        if event.is_final_response() and event.content:
            for p in event.content.parts:
                if p.text:
                    parts.append(p.text)
    return "\n".join(parts).strip()


# --- MCP server ----------------------------------------------------------------
# Stateful (stateless_http=False) so `ctx.report_progress` heartbeats work during
# the multi-step `notify_funded` delivery; AgentCore routes the session to one
# microVM via Mcp-Session-Id. Contract path /mcp, port 8000 (AGENT_PORT local override).
mcp = FastMCP(
    "bnbagent-seller",
    host="0.0.0.0",
    port=int(os.environ.get("AGENT_PORT") or "8000"),
    stateless_http=False,
)


# --- Tool annotations ----------------------------------------------------------
try:
    from mcp.types import ToolAnnotations as _ToolAnnotations

    # Commerce tools are NOT read-only (they sign / move on-chain state via fixed
    # signing.py code). There is no raw signing tool — only these two bounded ops.
    _COMMERCE_ANNOTATIONS = _ToolAnnotations(readOnlyHint=False, openWorldHint=True)
    _READONLY_ANNOTATIONS = _ToolAnnotations(readOnlyHint=True, openWorldHint=True)
except Exception:  # pragma: no cover — mcp always provides ToolAnnotations
    _COMMERCE_ANNOTATIONS = None
    _READONLY_ANNOTATIONS = None


def _parse_job_id(raw) -> int:
    """Normalise a job_id (``0x..`` / decimal string / int) to int."""
    if isinstance(raw, int):
        return raw
    s = str(raw).strip()
    return int(s, 16) if s.lower().startswith("0x") else int(s)


# --- Commerce tools (signing is FIXED code in signing.py) ----------------------
@mcp.tool(annotations=_COMMERCE_ANNOTATIONS)
def negotiate(task_description: str, terms: dict | None = None) -> dict:
    """Return a wallet-signed ERC-8183 price quote for a task.

    Rule-based: the FIXED list price from studio.toml, CLAMPED to [min,max] BEFORE
    EIP-191 signing — a hostile request can never sign out of bounds. No LLM.
    Anchor the returned envelope on-chain (createJob + fund), then call
    `notify_funded` with the job_id.

    `terms` MUST include both "deliverables" and "quality_standards" (the
    on-chain evaluator requires them); a request missing either is rejected
    unsigned.

    Error contract (unified with the A2A executor): an unexpected fault here
    (wallet/signing failure) is left to PROPAGATE — FastMCP turns it into a tool
    result with ``isError=True`` (MCP's tool-execution-error channel), the peer of
    the A2A executor raising ``ServerError(InternalError)`` → JSON-RPC -32603. Only
    CLASSIFIED business outcomes are returned as a normal result. So do NOT wrap
    this in a try/except that masks a fault as a successful quote.
    """
    request = {"task_description": task_description, "terms": terms or {}}
    clamped = signing.clamp_price(signing.list_price())
    return signing.sign_quote(request, clamped)


@mcp.tool(annotations=_COMMERCE_ANNOTATIONS)
async def notify_funded(job_id: int, ctx: Context) -> dict:
    """Verify a funded job, produce the deliverable, and submit it on-chain — synchronously.

    The buyer's "I funded job X — deliver it" call. Runs the whole flow inside this
    one tool invocation (AgentCore permits ~15 min; `ctx.report_progress` keeps the
    connection warm). Blocking signing/chain ops run in a worker thread so the
    runtime's liveness probe stays responsive. Returns the on-chain result; the
    buyer can also read it back from the chain (SUBMITTED / get_deliverable_url).

    Verify-failure status is split (mirroring the A2A executor): `"rejected"` is
    TERMINAL — this agent did not sign it, the terms were tampered, it is
    underfunded or expired — re-calling will not help. `"retry"` is TRANSIENT (e.g.
    a chain read failed); the deal may be fine, so the buyer SHOULD re-call.
    """
    try:
        jid = _parse_job_id(job_id)
    except (TypeError, ValueError):
        return {"status": "rejected", "error": f"invalid job_id: {job_id!r}"}

    # 1/4 — verify the funded job carries THIS agent's signed quote (eth_calls).
    # Honour the `permanent` flag: a permanent failure is terminal ("rejected"); a
    # transient one (chain read hiccup) is "retry" so the buyer re-calls.
    await ctx.report_progress(progress=1, total=4)
    try:
        ok, reason, permanent = await asyncio.to_thread(signing.verify_signed_job, jid)
    except Exception as e:  # noqa: BLE001 — a failed verify is transient; tell the buyer to retry
        logger.exception("verify of job %s failed", jid)
        return {"status": "retry", "job_id": jid, "reason": f"{type(e).__name__}: {e}"}
    if not ok:
        status = "rejected" if permanent else "retry"
        return {"status": status, "job_id": jid, "reason": reason}

    # 2/4 — produce the deliverable (THE ONLY LLM CALL; specialise the prompt here)
    await ctx.report_progress(progress=2, total=4)
    spec = await asyncio.to_thread(signing.job_spec, jid)
    task = (
        json.dumps({"task": spec.task, "terms": spec.terms}, ensure_ascii=False)
        if spec is not None
        else f"job {jid}"
    )
    prompt = (
        "You accepted and were paid for the following job. Produce the deliverable "
        "now. Be complete and self-contained.\n\nJOB CONTEXT:\n" + task
    )
    # An unexpected fault below (LLM unavailable, RPC/submit hiccup) is left to
    # PROPAGATE — FastMCP returns it as an isError tool result (the peer of the A2A
    # executor's ServerError/-32603). Only the deterministic, classified outcome
    # SubmitPermanentlyUnsupportedError is a "rejected" business result.
    work = await _run_llm(prompt, session_id=str(jid))

    # 3/4 — sign + broadcast the on-chain submit (re-verifies FUNDED inside)
    await ctx.report_progress(progress=3, total=4)
    try:
        res = await asyncio.to_thread(
            signing.submit_result,
            jid,
            work,
            {
                "job_id": jid,
                "generator": GENERATOR,
                "built_with": "https://github.com/bnb-chain/bnbagent-studio",
            },
        )
    except SubmitPermanentlyUnsupportedError as e:
        # Deterministic for this wallet kind — submit can never succeed.
        return {"status": "rejected", "job_id": jid, "skip": True, "reason": str(e)}

    # 4/4 — done
    await ctx.report_progress(progress=4, total=4)
    return {
        "status": "submitted",
        "job_id": jid,
        "tx_hash": res.submit_tx,
        "deliverable_url": res.deliverable_url,
    }


# --- Read-only chain tools -----------------------------------------------------
mcp.tool(annotations=_READONLY_ANNOTATIONS)(wallet_info)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(wallet_list)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(wallet_address)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(balance_native)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(balance_u)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(pieverse_usage)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(agent_info)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(agent_by_address)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(job_status)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(job_list)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(job_count)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(tx_status)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(block_info)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(contract_call_view)
mcp.tool(annotations=_READONLY_ANNOTATIONS)(network_info)


if __name__ == "__main__":
    # Streamable-HTTP transport on /mcp (the AgentCore MCP contract). Host/port are
    # set on the FastMCP instance above.
    mcp.run(transport="streamable-http")
