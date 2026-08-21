/**
 * apps/keeper/src/index.ts
 *
 * Entry point — starts the four ERD.md §5 keeper loops. Runs as its own
 * process this session; ARCHITECTURE.md §5 notes it deploys in-process with
 * apps/api during Phase B week 1 and only splits out under load — when that
 * happens, `startKeeperLoops()` below is the function apps/api would import
 * and call instead of spawning a separate process.
 */
import { env, keeperConfigured } from './env.js'
import { runAttesterTick } from './jobs/attester.js'
import { runIndexerTick } from './jobs/indexer.js'
import { runMetricsHourlyTick } from './jobs/metrics.js'
import { runSessionWatcherTick } from './jobs/session-watcher.js'
import { type RunningJob, startIntervalJob } from './lib/interval-runner.js'
import { logger } from './logger.js'

export function startKeeperLoops(): RunningJob[] {
  return [
    startIntervalJob({
      name: 'indexer',
      intervalMs: env.KEEPER_POLL_INTERVAL_MS,
      run: runIndexerTick,
    }),
    startIntervalJob({
      name: 'attester',
      intervalMs: env.KEEPER_POLL_INTERVAL_MS,
      run: runAttesterTick,
    }),
    startIntervalJob({
      name: 'session-watcher',
      intervalMs: env.KEEPER_POLL_INTERVAL_MS,
      run: runSessionWatcherTick,
    }),
    startIntervalJob({
      name: 'metrics-hourly',
      intervalMs: env.KEEPER_METRICS_INTERVAL_MS,
      run: runMetricsHourlyTick,
    }),
  ]
}

function main(): void {
  logger.info(
    { configured: keeperConfigured, pollIntervalMs: env.KEEPER_POLL_INTERVAL_MS },
    'AgentDesk keeper starting — Wave 1B scope: loop shape only, no live chain calls this session',
  )

  const jobs = startKeeperLoops()

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'keeper shutting down')
    for (const job of jobs) job.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main()
