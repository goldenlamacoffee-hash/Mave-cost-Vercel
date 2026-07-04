import "server-only"
import { db } from "@/lib/db"
import { v0UsageEvents } from "@/lib/db/schema"
import { hashString, stableHash, type SyncResult } from "./shared"

const V0_API = "https://api.v0.dev/v1"

type UsageEvent = {
  id?: string
  type?: string
  promptCost?: string
  completionCost?: string
  totalCost?: string
  chatId?: string
  messageId?: string
  userId?: string
  user?: { id?: string; email?: string; name?: string }
  model?: string
  createdAt?: string
  [key: string]: unknown
}

type UsageResponse = {
  object: string
  data: UsageEvent[]
  pagination: { hasMore: boolean; nextCursor?: string; nextUrl?: string }
  meta: { totalCount: number }
}

const DAY_MS = 24 * 60 * 60 * 1000
/** The v0 usage API rejects ranges longer than 90 days. */
const MAX_RANGE_DAYS = 90

/** Split a date range into consecutive chunks of at most `maxDays` days each. */
export function splitRangeIntoChunks(
  from: Date,
  to: Date,
  maxDays: number = MAX_RANGE_DAYS,
): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = []
  let cursor = from.getTime()
  const end = to.getTime()
  while (cursor < end) {
    const chunkEnd = Math.min(cursor + maxDays * DAY_MS, end)
    chunks.push({ from: new Date(cursor), to: new Date(chunkEnd) })
    cursor = chunkEnd
  }
  return chunks.length > 0 ? chunks : [{ from, to }]
}

/**
 * Sync v0 usage report events for a date range. Idempotent via
 * sourceEventId (when present) and sourceHash.
 *
 * The v0 API rejects ranges over 90 days, so longer ranges are
 * automatically split into sequential chunks of at most 90 days.
 */
export async function syncV0Usage(opts: { from: Date; to: Date }): Promise<SyncResult> {
  const apiKey = process.env.V0_API_KEY
  if (!apiKey) throw new Error("V0_API_KEY is not set")

  if (Number.isNaN(opts.from.getTime()) || Number.isNaN(opts.to.getTime())) {
    throw new Error("Invalid sync date range: from/to must be valid dates")
  }
  if (opts.from.getTime() >= opts.to.getTime()) {
    throw new Error("Invalid sync date range: from must be before to")
  }

  const rangeDays = Math.ceil((opts.to.getTime() - opts.from.getTime()) / DAY_MS)
  const chunks = splitRangeIntoChunks(opts.from, opts.to)

  let imported = 0
  let updated = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log("[v0] sync", {
      source: "v0_usage",
      fromIso: chunk.from.toISOString(),
      toIso: chunk.to.toISOString(),
      rangeDays,
      chunkIndex: i + 1,
      totalChunks: chunks.length,
    })
    const result = await syncV0UsageChunk(apiKey, chunk)
    imported += result.rowsImported ?? 0
    updated += result.rowsUpdated ?? 0
  }

  return { rowsImported: imported, rowsUpdated: updated }
}

/** Sync a single ≤90-day window of v0 usage events. */
async function syncV0UsageChunk(
  apiKey: string,
  opts: { from: Date; to: Date },
): Promise<SyncResult> {
  let imported = 0
  let updated = 0

  let cursor: string | undefined
  let page = 0
  const maxPages = 200

  while (page < maxPages) {
    page++
    const url = new URL(`${V0_API}/reports/usage`)
    url.searchParams.set("startDate", opts.from.toISOString().replace(/\.\d{3}Z$/, "Z"))
    url.searchParams.set("endDate", opts.to.toISOString().replace(/\.\d{3}Z$/, "Z"))
    url.searchParams.set("limit", "100")
    if (cursor) url.searchParams.set("cursor", cursor)

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(
        `v0 usage API returned ${response.status}: ${body.slice(0, 300) || response.statusText}`,
      )
    }

    const json = (await response.json()) as UsageResponse
    const events = json.data ?? []

    for (const event of events) {
      const sourceEventId = event.id ?? null
      const sourceHash = sourceEventId ? hashString(`v0-usage:${sourceEventId}`) : stableHash(event)

      const result = await db
        .insert(v0UsageEvents)
        .values({
          sourceEventId,
          sourceHash,
          type: event.type ?? null,
          totalCost: event.totalCost ?? "0",
          promptCost: event.promptCost ?? null,
          completionCost: event.completionCost ?? null,
          chatId: event.chatId ?? null,
          messageId: event.messageId ?? null,
          userId: event.user?.id ?? event.userId ?? null,
          userEmail: event.user?.email ?? null,
          model: typeof event.model === "string" ? event.model : null,
          eventCreatedAt: event.createdAt ? new Date(event.createdAt) : null,
          rawJson: event,
        })
        .onConflictDoNothing({ target: v0UsageEvents.sourceHash })
        .returning({ id: v0UsageEvents.id })

      if (result.length > 0) imported++
      else updated++
    }

    if (!json.pagination?.hasMore || !json.pagination.nextCursor) break
    cursor = json.pagination.nextCursor
  }

  return { rowsImported: imported, rowsUpdated: updated }
}
