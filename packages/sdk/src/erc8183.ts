/**
 * packages/sdk/src/erc8183.ts
 *
 * BSC testnet (chain 97) ERC-8183 deployment addresses, sourced from the
 * bnbagent SDK + confirmed on-chain during the job-548 canary. The buyer flow
 * is: createJob (commerce) → registerJob (router) → setBudget (commerce) →
 * approve $U + fund (commerce). The seller later submits on the commerce
 * contract and settlement is approved through the router/policy.
 *
 * Mainnet addresses differ — resolve them per-network before a mainnet launch.
 */
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
