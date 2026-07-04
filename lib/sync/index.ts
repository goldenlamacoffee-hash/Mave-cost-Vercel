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

/**
 * Backfill range spanning exactly `days` days, ending tomorrow 00:00Z.
 * E.g. days=90 → from = tomorrow - 90 days, so the span never exceeds
 * the v0 API's 90-day maximum in a single call.
 */
function defaultRange(days: number): { from: Date; to: Date } {
  const to = startOfTomorrowUtc()
  return {
    from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000),
    to,
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
 * Run a sync. Range priority: explicit from/to → `days` backfill window →
 * current month (the default for "Sync now" and cron). Each source fails
 * gracefully and independently — one failure never blocks the others.
 */
export async function runSync(
  source: SyncSource,
  opts?: { from?: Date; to?: Date; days?: number },
): Promise<SyncOutcome[]> {
  const range =
    opts?.from && opts?.to
      ? { from: opts.from, to: opts.to }
      : opts?.days
        ? defaultRange(opts.days)
        : currentMonthRange()

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
