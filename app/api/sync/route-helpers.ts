import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import { getSession } from "@/lib/auth"
import { runSync, type SyncSource } from "@/lib/sync"

export async function handleSyncRequest(
  request: NextRequest,
  source: SyncSource,
): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let from: Date | undefined
  let to: Date | undefined
  let days: number | undefined

  try {
    const body = (await request.json().catch(() => ({}))) as {
      from?: string
      to?: string
      days?: number
    }
    if (body.from) from = new Date(body.from)
    if (body.to) to = new Date(body.to)
    if (typeof body.days === "number" && body.days > 0 && body.days <= 366) days = body.days
  } catch {
    // no body — use defaults
  }

  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
  }

  const outcomes = await runSync(source, { from, to, days })
  const allOk = outcomes.every((o) => o.ok)

  return NextResponse.json({ ok: allOk, outcomes }, { status: allOk ? 200 : 500 })
}
