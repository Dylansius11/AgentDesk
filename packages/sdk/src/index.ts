/**
 * packages/sdk/src/index.ts — public entry point.
 *
 * `apps/web`, `apps/api`, and `apps/keeper` import from `@agentdesk/sdk`
 * only — never reach into `src/schemas/*` or `src/fixtures/*` directly
 * (ARCHITECTURE.md §3 import rule).
 */
export * from "./schemas/index";
export * from "./fixtures/index";
export * from "./client/index";
export * from "./abi/index";
