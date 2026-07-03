import Link from "next/link"
import { getEnvStatus, getMissingEnvVars } from "@/lib/env"
import {
  getOverviewTotals,
  getCostByCenter,
  getDailySpend,
  getRecentSyncRuns,
  getSetupState,
  currentMonthRange,
} from "@/lib/queries"
import { formatUsd, formatDateTime } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DailySpendChart } from "@/components/daily-spend-chart"
import { SyncButtons } from "@/components/sync-buttons"
import { SetupChecklist } from "@/components/setup-checklist"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const missing = getMissingEnvVars()
  const range = currentMonthRange()

  const [totals, byCenter, daily, syncRuns, setup] = await Promise.all([
    getOverviewTotals(range),
    getCostByCenter(range),
    getDailySpend(range),
    getRecentSyncRuns(5),
    getSetupState(),
  ])

  const needsSetup = missing.length > 0 || !setup.firstSyncCompleted

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Current month ({range.from.toLocaleDateString("en-US", { month: "long", year: "numeric" })})
        </p>
      </div>

      {needsSetup && (
        <SetupChecklist
          envStatus={getEnvStatus()}
          migrationsApplied={setup.migrationsApplied}
          firstSyncCompleted={setup.firstSyncCompleted}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total cost" value={formatUsd(totals.total)} />
        <StatCard label="v0 cost" value={formatUsd(totals.v0Total)} />
        <StatCard label="Vercel cost" value={formatUsd(totals.vercelTotal)} />
        <StatCard
          label="Unmapped cost"
          value={formatUsd(totals.unmappedTotal)}
          warning={totals.unmappedTotal > 0}
        />
      </div>

      <SyncButtons />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily spend</CardTitle>
          </CardHeader>
          <CardContent>
            {daily.length === 0 ? (
              <EmptyState message="No cost data yet. Run a sync to import real usage from Vercel and v0." />
            ) : (
              <DailySpendChart data={daily} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent syncs</CardTitle>
          </CardHeader>
          <CardContent>
            {syncRuns.length === 0 ? (
              <EmptyState message="No syncs have run yet." />
            ) : (
              <ul className="flex flex-col gap-3">
                {syncRuns.map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          run.status === "success"
                            ? "default"
                            : run.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="font-mono text-[10px]"
                      >
                        {run.status}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">{run.source}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(run.startedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/dashboard/sync"
              className="mt-4 inline-block text-xs text-primary hover:underline"
            >
              View sync history
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top cost centers this month</CardTitle>
        </CardHeader>
        <CardContent>
          {byCenter.every((c) => c.totalCost === 0) ? (
            <EmptyState message="No cost data yet for this month." />
          ) : (
            <div className="flex flex-col gap-3">
              {byCenter
                .filter((c) => c.totalCost > 0)
                .slice(0, 8)
                .map((c) => (
                  <div key={c.id ?? "unmapped"} className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-2">
                      {c.id ? (
                        <Link
                          href={`/dashboard/cost-centers/${c.id}`}
                          className="truncate text-sm text-foreground hover:text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2 truncate text-sm text-foreground">
                          Unmapped
                          <Badge variant="destructive" className="text-[10px]">
                            needs mapping
                          </Badge>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                        v0 {formatUsd(c.v0Cost)} · Vercel {formatUsd(c.vercelCost)}
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {formatUsd(c.totalCost)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  warning,
}: {
  label: string
  value: string
  warning?: boolean
}) {
  return (
    <Card className={warning ? "border-destructive/50" : undefined}>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div
          className={`mt-1 font-mono text-2xl font-semibold ${warning ? "text-destructive" : "text-foreground"}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
