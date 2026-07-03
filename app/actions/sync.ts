"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { runSync, type SyncSource, type SyncOutcome } from "@/lib/sync"

export async function triggerSync(
  source: SyncSource,
  opts?: { days?: number; from?: string; to?: string },
): Promise<{ ok: boolean; outcomes?: SyncOutcome[]; error?: string }> {
  try {
    await requireAdmin()

    let from: Date | undefined
    let to: Date | undefined
    if (opts?.from) {
      from = new Date(opts.from)
      if (Number.isNaN(from.getTime())) return { ok: false, error: "Invalid from date" }
    }
    if (opts?.to) {
      to = new Date(opts.to)
      // Include the whole "to" day
      to.setUTCHours(23, 59, 59, 999)
      if (Number.isNaN(to.getTime())) return { ok: false, error: "Invalid to date" }
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
