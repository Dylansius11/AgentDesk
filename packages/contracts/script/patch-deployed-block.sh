#!/usr/bin/env bash
# script/patch-deployed-block.sh <network>
#
# Gotcha this exists to fix: forge scripts read `block.number` against the
# script's *simulation* backend, not the chain's post-broadcast state — so
# the `deployedAtBlock` field `Deploy.s.sol` writes into
# `exported/addresses.<network>.json` is reliably wrong (observed: reads 0
# for a fresh chain whose deploy tx actually landed in block 1). The
# broadcast artifact Foundry writes under `broadcast/Deploy.s.sol/<chainid>/
# run-latest.json` DOES carry the real receipt, so this script patches the
# exported JSON from that source of truth immediately after a deploy.
#
# Run this right after `forge script script/Deploy.s.sol:Deploy --broadcast`
# for any network — the deploy:* pnpm scripts do this automatically.
#
# Usage: script/patch-deployed-block.sh anvil|chapel|mainnet
set -euo pipefail
cd "$(dirname "$0")/.."

network="${1:?usage: patch-deployed-block.sh <anvil|chapel|mainnet>}"
export_file="exported/addresses.${network}.json"

if [[ ! -f "$export_file" ]]; then
  echo "patch-deployed-block: $export_file does not exist, nothing to patch" >&2
  exit 1
fi

chain_id="$(jq -r '.chainId' "$export_file")"
broadcast_file="broadcast/Deploy.s.sol/${chain_id}/run-latest.json"

if [[ ! -f "$broadcast_file" ]]; then
  echo "patch-deployed-block: no broadcast artifact at $broadcast_file — was --broadcast passed?" >&2
  exit 1
fi

block_hex="$(jq -r '.receipts[0].blockNumber' "$broadcast_file")"
block_dec="$((block_hex))"

tmp="$(mktemp)"
jq --argjson block "$block_dec" '.deployedAtBlock = $block' "$export_file" > "$tmp"
mv "$tmp" "$export_file"

echo "patch-deployed-block: $export_file deployedAtBlock -> $block_dec"
