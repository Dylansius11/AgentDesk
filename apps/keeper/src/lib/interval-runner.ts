/**
 * apps/keeper/src/lib/interval-runner.ts
 *
 * Shared "run this job every N ms, log + swallow errors so one bad tick
 * doesn't kill the worker, support graceful shutdown" wrapper. Every job in
 * src/jobs/ is started through this rather than a bare setInterval, so
 * start/stop semantics are identical across the indexer/attester/metrics/
 * session-watcher loops (ARCHITECTURE.md §4.3).
 */
import { logger } from '../logger.js'

export interface IntervalJob {
  name: string
  intervalMs: number
  run: () => Promise<void>
}

export interface RunningJob {
  name: string
  stop: () => void
}

export function startIntervalJob(job: IntervalJob): RunningJob {
  let stopped = false
  let inFlight = false

  const tick = async () => {
    if (stopped || inFlight) return
    inFlight = true
    try {
      await job.run()
    } catch (err) {
      logger.error({ err, job: job.name }, 'job tick failed — will retry next interval')
    } finally {
      inFlight = false
    }
  }

  // fire once immediately, then on the interval — matches "every N minutes"
  // from ARCHITECTURE.md §4.3 without waiting a full interval for the first run.
  void tick()
  const handle = setInterval(() => void tick(), job.intervalMs)

  logger.info({ job: job.name, intervalMs: job.intervalMs }, 'job started')

  return {
    name: job.name,
    stop: () => {
      stopped = true
      clearInterval(handle)
      logger.info({ job: job.name }, 'job stopped')
    },
  }
}
