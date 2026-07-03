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

/**
 * Sync v0 usage report events for a date range. Idempotent via
 * sourceEventId (when present) and sourceHash.
 */
export async function syncV0Usage(opts: { from: Date; to: Date }): Promise<SyncResult> {
  const apiKey = process.env.V0_API_KEY
  if (!apiKey) throw new Error("V0_API_KEY is not set")

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
