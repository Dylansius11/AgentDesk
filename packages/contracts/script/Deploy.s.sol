// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ProofLedger} from "../src/ProofLedger.sol";

/// @title Deploy
/// @notice Single, environment-parameterized deploy script for ProofLedger.
///         Same bytecode, same script, for local anvil / Chapel / mainnet —
///         only `--rpc-url` and the env vars below change. See
///         `script/README.md` for the exact commands per environment.
///
/// @dev    Env vars (all optional on `anvil`/chainid 31337; required — no
///         silent fallback — everywhere else):
///
///         PRIVATE_KEY                  deployer key. On chainid 31337 only,
///                                       falls back to anvil's published
///                                       default account #0 key so this
///                                       script runs against a fresh `anvil`
///                                       with zero setup. That fallback key
///                                       is publicly known test-only
///                                       material — it is intentionally
///                                       never used as a fallback on any
///                                       other chainid; Chapel/mainnet
///                                       revert loudly if PRIVATE_KEY is
///                                       unset rather than risk it.
///         PROOFLEDGER_ADMIN_ADDRESS    granted DEFAULT_ADMIN_ROLE (can
///                                       later grant/revoke ATTESTER_ROLE,
///                                       see SMART-CONTRACT.md §6). Defaults
///                                       to the deployer address on every
///                                       network — that's an accepted v1
///                                       posture (deployer-as-admin), not
///                                       anvil-only.
///         PROOFLEDGER_ATTESTER_ADDRESS granted ATTESTER_ROLE — must be the
///                                       keeper's public address (never its
///                                       private key; the deploy script
///                                       never touches KEEPER_ATTESTER_KEY).
///                                       Defaults to the deployer on
///                                       chainid 31337 only, so a solo local
///                                       dry-run can self-attest without a
///                                       second funded account. Required,
///                                       no fallback, on every other chain —
///                                       reusing the deployer as attester on
///                                       a real network would be a security
///                                       regression (single EOA controlling
///                                       both admin and attestation).
///         MAINNET_CONFIRM               must equal exactly "yes" to deploy
///                                       when chainid == 56. Mirrors the
///                                       `bsc-foundry` skill's documented
///                                       mainnet gate.
contract Deploy is Script {
    /// @dev anvil's well-known, publicly-documented default account #0 key
    ///      (mnemonic "test test test ... junk", index 0). Never used
    ///      outside chainid 31337 — see the require() below.
    uint256 internal constant ANVIL_DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external returns (ProofLedger ledger) {
        uint256 deployerKey = _resolveDeployerKey();
        address deployer = vm.addr(deployerKey);

        address admin = vm.envOr("PROOFLEDGER_ADMIN_ADDRESS", deployer);
        address attester = _resolveAttester(deployer);

        if (block.chainid == 56) {
            require(
                keccak256(bytes(vm.envOr("MAINNET_CONFIRM", string("")))) == keccak256(bytes("yes")),
                "Deploy: set MAINNET_CONFIRM=yes to deploy to BSC mainnet"
            );
        }

        console2.log("Deploying ProofLedger");
        console2.log("  chainid   :", block.chainid);
        console2.log("  deployer  :", deployer);
        console2.log("  admin     :", admin);
        console2.log("  attester  :", attester);

        vm.startBroadcast(deployerKey);
        ledger = new ProofLedger(admin, attester);
        vm.stopBroadcast();

        console2.log("ProofLedger deployed at:", address(ledger));

        _writeAddressExport(address(ledger), admin, attester);
    }

    /// @dev PRIVATE_KEY is required (reverts if unset) on every chain except
    ///      local anvil, where it falls back to ANVIL_DEFAULT_KEY.
    function _resolveDeployerKey() internal view returns (uint256) {
        if (block.chainid == 31337) {
            return vm.envOr("PRIVATE_KEY", ANVIL_DEFAULT_KEY);
        }
        return vm.envUint("PRIVATE_KEY");
    }

    /// @dev PROOFLEDGER_ATTESTER_ADDRESS is required (reverts if unset) on
    ///      every chain except local anvil, where it falls back to the
    ///      deployer so a solo dry-run needs only one funded account.
    function _resolveAttester(address deployer) internal view returns (address) {
        if (block.chainid == 31337) {
            return vm.envOr("PROOFLEDGER_ATTESTER_ADDRESS", deployer);
        }
        return vm.envAddress("PROOFLEDGER_ATTESTER_ADDRESS");
    }

    /// @dev Writes exported/addresses.<network>.json — the file
    ///      `packages/sdk` and `docs/technical/INTEGRATION.md` are meant to
    ///      be pinned from, per SMART-CONTRACT.md §5.5 and the bsc-foundry
    ///      skill ("record address + start block ... in the same commit").
    ///      Requires `fs_permissions = [{ access = "read-write", path =
    ///      "./exported" }]` in foundry.toml (already set).
    function _writeAddressExport(address ledger, address admin, address attester) internal {
        string memory network = _networkName(block.chainid);
        string memory path = string.concat("exported/addresses.", network, ".json");

        string memory key = "proofledger-deploy";
        vm.serializeAddress(key, "proofLedger", ledger);
        vm.serializeAddress(key, "admin", admin);
        vm.serializeAddress(key, "attester", attester);
        vm.serializeUint(key, "chainId", block.chainid);
        string memory out = vm.serializeUint(key, "deployedAtBlock", block.number);

        vm.writeJson(out, path);
        console2.log("  exported ->", path);
    }

    function _networkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 56) return "mainnet";
        if (chainId == 97) return "chapel";
        if (chainId == 31337) return "anvil";
        return "unknown";
    }
}
