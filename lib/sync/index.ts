import "server-only"
import { syncVercelBilling } from "./vercel"
import { syncV0Usage } from "./v0-usage"
import { syncV0Chats } from "./v0-chats"
import { startSyncRun, finishSyncRun, sanitizeError, type SyncResult } from "./shared"

export type SyncSource = "vercel" | "v0_usage" | "v0_chats" | "all"

export type SyncOutcome = {
  source: SyncSource
  ok: boolean
  result?: SyncResult
  error?: string
}

/** Start of the current day in UTC. */
function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Tomorrow at 00:00:00.000Z ("to" is exclusive on the Vercel API). */
function startOfTomorrowUtc(): Date {
  const today = startOfTodayUtc()
  return new Date(today.getTime() + 24 * 60 * 60 * 1000)
}

/** Backfill range: start of day UTC `days` ago → tomorrow start of day UTC. */
function defaultRange(days: number): { from: Date; to: Date } {
  const today = startOfTodayUtc()
  return {
    from: new Date(today.getTime() - days * 24 * 60 * 60 * 1000),
    to: startOfTomorrowUtc(),
  }
}

/** Current month range: first day of month 00:00Z → tomorrow 00:00Z. */
export function currentMonthRange(): { from: Date; to: Date } {
  const now = new Date()
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    to: startOfTomorrowUtc(),
  }
}

async function runSingle(
  source: Exclude<SyncSource, "all">,
  range: { from: Date; to: Date },
): Promise<SyncOutcome> {
  const runId = await startSyncRun(source)
  try {
    let result: SyncResult
    if (source === "vercel") result = await syncVercelBilling(range)
    else if (source === "v0_usage") result = await syncV0Usage(range)
    else result = await syncV0Chats()

    await finishSyncRun(runId, "success", result)
    return { source, ok: true, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishSyncRun(runId, "failed", {}, message)
    return { source, ok: false, error: sanitizeError(message) }
  }
}

/**
 * Run a sync. `days` controls the backfill window (default 35 to cover the
 * current month plus a buffer). Each source fails gracefully and
 * independently — one failure never blocks the others.
 */
export async function runSync(
  source: SyncSource,
  opts?: { from?: Date; to?: Date; days?: number },
): Promise<SyncOutcome[]> {
  const range =
    opts?.from && opts?.to ? { from: opts.from, to: opts.to } : defaultRange(opts?.days ?? 35)

  if (source !== "all") {
    return [await runSingle(source, range)]
  }

  const outcomes: SyncOutcome[] = []
  // Chats first so usage/charges can map against fresh projects
  outcomes.push(await runSingle("v0_chats", range))
  outcomes.push(await runSingle("v0_usage", range))
  outcomes.push(await runSingle("vercel", range))
  return outcomes
}
