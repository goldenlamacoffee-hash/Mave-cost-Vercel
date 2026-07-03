import { Suspense } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  getAllCostCenters,
  getV0UsageLedger,
  getVercelChargesLedger,
  type LedgerFilters as Filters,
} from "@/lib/queries"
import { formatUsd, formatDate, formatDateTime } from "@/lib/format"
import { LedgerFilters } from "@/components/ledger-filters"

export const dynamic = "force-dynamic"

type SearchParams = {
  tab?: string
  from?: string
  to?: string
  q?: string
  cc?: string
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const tab: "v0" | "vercel" = params.tab === "vercel" ? "vercel" : "v0"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Raw cost line items from both sources. Filter and export as CSV.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <TabLink href={{ ...params, tab: undefined }} active={tab === "v0"}>
          v0 Usage Events
        </TabLink>
        <TabLink href={{ ...params, tab: "vercel" }} active={tab === "vercel"}>
          Vercel Charges
        </TabLink>
      </div>

      <Suspense
        key={JSON.stringify(params)}
        fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
      >
        <LedgerContent params={params} tab={tab} />
      </Suspense>
    </div>
  )
}

function TabLink({
  href,
  active,
  children,
}: {
  href: SearchParams
  active: boolean
  children: React.ReactNode
}) {
  const qs = new URLSearchParams(
    Object.entries(href).filter(([, v]) => v !== undefined) as Array<[string, string]>,
  ).toString()
  return (
    <Link
      href={`/dashboard/ledger${qs ? `?${qs}` : ""}`}
      className={cn(
        "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  )
}

async function LedgerContent({ params, tab }: { params: SearchParams; tab: "v0" | "vercel" }) {
  const filters: Filters = {
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(params.to + "T23:59:59Z") : undefined,
    search: params.q,
    costCenterId: params.cc,
  }

  const costCenters = await getAllCostCenters()
  const ccOptions = costCenters.map((cc) => ({ id: cc.id, name: cc.name }))

  return (
    <div className="flex flex-col gap-4">
      <LedgerFilters costCenters={ccOptions} activeTab={tab} />
      <Card>
        <CardContent className="pt-6">
          {tab === "v0" ? <V0Table filters={filters} /> : <VercelTable filters={filters} />}
        </CardContent>
      </Card>
    </div>
  )
}

async function V0Table({ filters }: { filters: Filters }) {
  const rows = await getV0UsageLedger(filters)
  const total = rows.reduce((sum, r) => sum + Number(r.total_cost ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{rows.length} events (max 500 shown)</span>
        <span>
          Sum shown: <span className="font-medium text-foreground tabular-nums">{formatUsd(total)}</span>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No usage events match these filters.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Chat</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Cost center</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id as string}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(r.event_created_at as string)}
                </TableCell>
                <TableCell>{(r.type as string) ?? "—"}</TableCell>
                <TableCell className="max-w-40 truncate font-mono text-xs">
                  {(r.chat_id as string) ?? "—"}
                </TableCell>
                <TableCell className="max-w-40 truncate">{(r.model as string) ?? "—"}</TableCell>
                <TableCell className="max-w-40 truncate">{(r.user_email as string) ?? "—"}</TableCell>
                <TableCell>
                  {r.cost_center_name ? (
                    <Badge variant="secondary">{r.cost_center_name as string}</Badge>
                  ) : (
                    <Badge variant="destructive">Unmapped</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(Number(r.total_cost ?? 0), { precise: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

async function VercelTable({ filters }: { filters: Filters }) {
  const rows = await getVercelChargesLedger(filters)
  const total = rows.reduce((sum, r) => sum + Number(r.effective_cost ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{rows.length} charges (max 500 shown)</span>
        <span>
          Sum shown: <span className="font-medium text-foreground tabular-nums">{formatUsd(total)}</span>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No charges match these filters.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Cost center</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id as string}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(r.period_start as string)}
                </TableCell>
                <TableCell className="max-w-52 truncate font-medium">
                  {(r.service_name as string) ?? "—"}
                </TableCell>
                <TableCell className="max-w-40 truncate">
                  {(r.vercel_project_name as string) ?? (r.vercel_project_id as string) ?? "Team-level"}
                </TableCell>
                <TableCell>
                  {r.cost_center_name ? (
                    <Badge variant="secondary">{r.cost_center_name as string}</Badge>
                  ) : (
                    <Badge variant="destructive">Unmapped</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {r.consumed_quantity != null
                    ? `${Number(r.consumed_quantity).toLocaleString()} ${(r.consumed_unit as string) ?? ""}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(Number(r.effective_cost ?? 0), { precise: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
