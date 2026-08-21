/**
 * packages/sdk/src/client/latency.ts
 *
 * Artificial network latency for `FixturesAgentDeskClient` — BUILD-PLAN B1's
 * AC needs "latency visible via skeletons," which only means something if
 * calls actually take a believable amount of time instead of resolving on
 * the same microtask.
 */

export interface LatencyRange {
  minMs: number;
  maxMs: number;
}

/** 150-400ms — fast enough not to feel broken, slow enough that a loading skeleton is visibly earning its place. */
export const DEFAULT_LATENCY: LatencyRange = { minMs: 150, maxMs: 400 };

export function randomLatencyMs(range: LatencyRange = DEFAULT_LATENCY): number {
  return Math.round(range.minMs + Math.random() * (range.maxMs - range.minMs));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function simulateLatency(range?: LatencyRange): Promise<void> {
  return sleep(randomLatencyMs(range));
}
