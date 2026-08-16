/**
 * apps/api/src/lib/circuit-breaker.ts
 *
 * Minimal three-state circuit breaker (closed → open → half-open) for wrapping
 * external calls (8004scan, Altana, chain RPC, x402 facilitator) per CLAUDE.md
 * §2 and ARCHITECTURE.md §6 ("every external call has timeout + circuit
 * breaker; on failure the page renders last-cached data with a staleness
 * chip"). Phase A: structural only — no live call uses this yet.
 */

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  /** consecutive failures before tripping open */
  failureThreshold: number
  /** ms to stay open before allowing a half-open trial call */
  cooldownMs: number
}

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private consecutiveFailures = 0
  private openedAt: number | undefined

  constructor(
    private readonly name: string,
    private readonly opts: CircuitBreakerOptions = { failureThreshold: 5, cooldownMs: 30_000 },
  ) {}

  getState(): CircuitState {
    if (
      this.state === 'open' &&
      this.openedAt &&
      Date.now() - this.openedAt >= this.opts.cooldownMs
    ) {
      this.state = 'half-open'
    }
    return this.state
  }

  /** Call before attempting a live call — throws if the circuit is open. */
  assertCallAllowed(): void {
    if (this.getState() === 'open') {
      throw new CircuitOpenError(this.name)
    }
  }

  onSuccess(): void {
    this.consecutiveFailures = 0
    this.state = 'closed'
    this.openedAt = undefined
  }

  onFailure(): void {
    this.consecutiveFailures += 1
    if (this.consecutiveFailures >= this.opts.failureThreshold) {
      this.state = 'open'
      this.openedAt = Date.now()
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(circuitName: string) {
    super(`circuit "${circuitName}" is open — serving last-cache fallback`)
    this.name = 'CircuitOpenError'
  }
}
