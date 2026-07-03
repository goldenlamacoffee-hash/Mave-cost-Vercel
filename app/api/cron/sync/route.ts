import { NextResponse, type NextRequest } from "next/server"
import { runSync, currentMonthRange } from "@/lib/sync"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const range = currentMonthRange()
  const outcomes = await runSync("all", { from: range.from, to: range.to })
  const allOk = outcomes.every((o) => o.ok)

  return NextResponse.json({ ok: allOk, outcomes }, { status: allOk ? 200 : 500 })
}
