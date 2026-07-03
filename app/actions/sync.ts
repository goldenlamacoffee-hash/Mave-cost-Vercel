"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { runSync, type SyncSource, type SyncOutcome } from "@/lib/sync"

/** Parse a YYYY-MM-DD calendar date as start of day UTC. Returns null if invalid. */
function parseUtcDay(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function triggerSync(
  source: SyncSource,
  opts?: { days?: number; from?: string; to?: string },
): Promise<{ ok: boolean; outcomes?: SyncOutcome[]; error?: string }> {
  try {
    await requireAdmin()

    // Parse calendar dates (YYYY-MM-DD) as UTC — never localized browser dates.
    // "from" = start of the selected day UTC; "to" = start of the NEXT day UTC
    // because the Vercel API treats "to" as exclusive.
    let from: Date | undefined
    let to: Date | undefined
    if (opts?.from) {
      const fromDay = parseUtcDay(opts.from)
      if (!fromDay) return { ok: false, error: "Invalid from date" }
      from = fromDay
    }
    if (opts?.to) {
      const toDay = parseUtcDay(opts.to)
      if (!toDay) return { ok: false, error: "Invalid to date" }
      to = new Date(toDay.getTime() + 24 * 60 * 60 * 1000)
    }
    if (from && to && from.getTime() >= to.getTime()) {
      return { ok: false, error: "From date must be before to date" }
    }

    const outcomes = await runSync(source, { from, to, days: opts?.days })
    revalidatePath("/dashboard", "layout")
    return { ok: outcomes.every((o) => o.ok), outcomes }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { ok: false, error: "Unauthorized" }
    }
    return { ok: false, error: error instanceof Error ? error.message : "Sync failed" }
  }
}
