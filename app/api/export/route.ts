import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getV0UsageLedger, getVercelChargesLedger, type LedgerFilters } from "@/lib/queries"

export const dynamic = "force-dynamic"

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ""
    const s = typeof v === "object" ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.join(",")
  const lines = rows.map((r) => columns.map((c) => escape(r[c])).join(","))
  return [header, ...lines].join("\n")
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const type = url.searchParams.get("type") ?? "v0"
  const filters: LedgerFilters = {
    from: url.searchParams.get("from") ? new Date(url.searchParams.get("from") as string) : undefined,
    to: url.searchParams.get("to") ? new Date(url.searchParams.get("to") + "T23:59:59Z") : undefined,
    search: url.searchParams.get("q") ?? undefined,
    costCenterId: url.searchParams.get("cc") ?? undefined,
  }

  if (type === "vercel") {
    const rows = await getVercelChargesLedger(filters, 10000)
    const csv = toCsv(rows, [
      "period_start",
      "period_end",
      "service_name",
      "service_category",
      "vercel_project_name",
      "vercel_project_id",
      "cost_center_name",
      "billed_cost",
      "effective_cost",
      "billing_currency",
      "consumed_quantity",
      "consumed_unit",
      "region_name",
    ])
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vercel-charges-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  const rows = await getV0UsageLedger(filters, 10000)
  const csv = toCsv(rows, [
    "event_created_at",
    "type",
    "chat_id",
    "model",
    "user_email",
    "cost_center_name",
    "total_cost",
    "prompt_cost",
    "completion_cost",
  ])
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="v0-usage-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
