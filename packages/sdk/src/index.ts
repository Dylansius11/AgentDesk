/**
 * packages/sdk/src/index.ts — public entry point.
 *
 * `apps/web`, `apps/api`, and `apps/keeper` import from `@agentdesk/sdk`
 * only — never reach into `src/schemas/*` or `src/fixtures/*` directly
 * (ARCHITECTURE.md §3 import rule).
 */
export * from "./schemas/index.js";
export * from "./fixtures/index.js";
export * from "./client/index.js";
export * from "./abi/index.js";
export * from "./erc8183.js";
