/**
 * apps/keeper/src/jobs/session-watcher.ts
 *
 * ERD.md §5: "keeper session watcher | Keystore events | update sessions
 * (revocation/expiry)". Watches Altana's public Keystore for revoke/expiry
 * events and mirrors them into the `sessions` table so the Trust Panel's
 * "still active?" check is API-fast (ARCHITECTURE.md §1) without a chain
 * read on every page load.
 *
 * NOT WIRED THIS SESSION — no ALTANA_API_KEY / chain RPC provisioned. This
 * loop runs on the same poll interval as the indexer (KEEPER_POLL_INTERVAL_MS)
 * and no-ops until Altana credentials land (Phase B).
 *
 * TODO(Phase B): subscribe to (or poll) Altana Keystore revoke/expiry events,
 * update `sessions.revoked_at` / compare `sessions.expires_at` against now(),
 * per bnb-agent-stack skill: "if the chain and the sentence disagree, that's
 * a P0 bug" — this loop is what keeps the mirror honest.
 */
import { keeperConfigured } from '../env.js'
import { logger } from '../logger.js'

export async function runSessionWatcherTick(): Promise<void> {
  if (!keeperConfigured.database) {
    logger.debug('session-watcher: skipped — DATABASE_URL not configured this session')
    return
  }
  // TODO(Phase B): poll/subscribe Altana Keystore events; update sessions rows.
  logger.debug('session-watcher: tick (no-op stub)')
}
