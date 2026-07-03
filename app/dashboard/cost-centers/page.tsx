import { Suspense } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getAllCostCenters, getCostByCenter, currentMonthRange } from "@/lib/queries"
import { formatUsd } from "@/lib/format"
import { CostCenterForm } from "@/components/cost-center-form"

export const dynamic = "force-dynamic"

export default function CostCentersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cost Centers</h1>
        <p className="text-sm text-muted-foreground">
          Business initiatives that costs are attributed to. Current month spend vs budget.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <CostCentersContent />
      </Suspense>
    </div>
  )
}

async function CostCentersContent() {
  const range = currentMonthRange()
  const [centers, costs] = await Promise.all([getAllCostCenters(), getCostByCenter(range)])
  const costById = new Map(costs.filter((c) => c.id).map((c) => [c.id as string, c]))
  const unmapped = costs.find((c) => c.id === null)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {centers.map((center) => {
          const cost = costById.get(center.id)
          const total = cost?.totalCost ?? 0
          const budget = center.monthlyBudgetUsd ? Number(center.monthlyBudgetUsd) : null
          const pct = budget && budget > 0 ? Math.min((total / budget) * 100, 100) : null
          const over = budget !== null && total > budget

          return (
            <Link key={center.id} href={`/dashboard/cost-centers/${center.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{center.name}</CardTitle>
                    {over && <Badge variant="destructive">Over budget</Badge>}
                  </div>
                  {center.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{center.description}</p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-semibold tabular-nums">{formatUsd(total)}</span>
                    {budget !== null && (
                      <span className="text-xs text-muted-foreground">of {formatUsd(budget)}</span>
                    )}
                  </div>
                  {pct !== null && <Progress value={pct} className={over ? "[&>div]:bg-destructive" : ""} />}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>v0: {formatUsd(cost?.v0Cost ?? 0)}</span>
                    <span>Vercel: {formatUsd(cost?.vercelCost ?? 0)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {unmapped && unmapped.totalCost > 0 && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Unmapped spend this month</span>
              <span className="text-xs text-muted-foreground">
                Costs not yet attributed to any cost center
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-lg font-semibold tabular-nums text-destructive">
                {formatUsd(unmapped.totalCost)}
              </span>
              <Link href="/dashboard/unmapped" className="text-sm text-primary underline-offset-4 hover:underline">
                Resolve
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add cost center</CardTitle>
        </CardHeader>
        <CardContent>
          <CostCenterForm />
        </CardContent>
      </Card>
    </div>
  )
}
