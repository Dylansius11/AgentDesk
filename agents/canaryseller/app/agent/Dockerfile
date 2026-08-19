# syntax=docker/dockerfile:1
# Agent image for wallet.kind = "twak" — SHIPPED BY `bag init`.
#
# Why a custom image: the managed AgentCore Python runtime (CodeZip) has no
# Node.js, and every signing / on-chain intent for a twak wallet shells out to
# the `twak` CLI (npm @trustwallet/cli, Node >= 20). agentcore.json points at
# this file via runtimes[].build = "Container" + dockerfile = "Dockerfile";
# `agentcore deploy` builds it and pushes to ECR through CDK.
#
# AgentCore runtimes execute on linux/arm64 — pin the platform so an x86
# deploy machine cross-builds the right arch (needs docker buildx/containerd).
# buildkit may warn "FromPlatformFlagConstDisallowed" — expected; arm64 is pinned intentionally (see above).
FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.12-slim-trixie

# Node >= 20 + the pinned twak CLI.
#
# ARCH WARNING: `npm install` MUST run with this image's own node (as below).
# Installing on the host (or any other arch) and COPYing node_modules in
# breaks at runtime: twak's `@napi-rs/keyring` native binding is selected at
# install time per-arch (known npm optional-deps bug) — an x64-installed tree
# crashes under arm64 node. Multi-arch images must install per-arch too.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install -g @trustwallet/cli@0.19.1 \
 && npm cache clean --force \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
# wheels/ may carry dev-override bnbagent-studio-core / bnbagent wheels
# (mirrors the agent pyproject's [tool.uv.pip] find-links = ["./wheels"]).
ARG UV_INDEX_URL=""
COPY pyproject.toml ./
COPY wheels/ ./wheels/
RUN --mount=type=cache,target=/root/.cache/uv \
    sh -c 'if [ -n "$UV_INDEX_URL" ]; then export UV_INDEX_URL; else unset UV_INDEX_URL; fi; uv pip install --system --find-links ./wheels -r pyproject.toml'

COPY . .

# AgentCore protocol contract:
#   A2A → 0.0.0.0:9000 at /
#   MCP → 0.0.0.0:8000/mcp
# `bag init` renders 9000 / main.py from the selected
# protocol so CodeBuild never falls back to the HTTP-only 8080 contract.
ENV AGENT_PORT=9000
EXPOSE 9000
CMD ["opentelemetry-instrument", "python", "main.py"]
