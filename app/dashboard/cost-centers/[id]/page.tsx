import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getCostCenterById,
  getCostCenterDetail,
  getCostByCenter,
  getDailySpend,
  currentMonthRange,
} from "@/lib/queries"
import { formatUsd, formatDateTime } from "@/lib/format"
import { CostCenterForm } from "@/components/cost-center-form"
import { DailySpendChart } from "@/components/daily-spend-chart"

export const dynamic = "force-dynamic"

export default async function CostCenterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/cost-centers"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Cost Centers
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <DetailContent id={id} />
      </Suspense>
    </div>
  )
}

async function DetailContent({ id }: { id: string }) {
  const center = await getCostCenterById(id)
  if (!center) notFound()

  const range = currentMonthRange()
  const [detail, costs, daily] = await Promise.all([
    getCostCenterDetail(id, range),
    getCostByCenter(range),
    getDailySpend(range, id),
  ])
  const cost = costs.find((c) => c.id === id)
  const total = cost?.totalCost ?? 0
  const budget = center.monthlyBudgetUsd ? Number(center.monthlyBudgetUsd) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{center.name}</h1>
          {center.description && <p className="text-sm text-muted-foreground">{center.description}</p>}
        </div>
        {budget !== null && total > budget && <Badge variant="destructive">Over budget</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total this month</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold tabular-nums">{formatUsd(total)}</span>
            {budget !== null && (
              <p className="text-xs text-muted-foreground">Budget: {formatUsd(budget)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">v0 usage</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold tabular-nums">{formatUsd(cost?.v0Cost ?? 0)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vercel infrastructure</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold tabular-nums">{formatUsd(cost?.vercelCost ?? 0)}</span>
          </CardContent>
        </Card>
      </div>

      {daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily spend</CardTitle>
          </CardHeader>
          <CardContent>
            <DailySpendChart data={daily} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Technical projects ({detail.projects.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects mapped to this cost center.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Mapping</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.externalProjectName ?? p.externalProjectId}</TableCell>
                      <TableCell className="text-muted-foreground">{p.provider}</TableCell>
                      <TableCell>
                        <Badge variant={p.mappingConfidence === "manual" ? "default" : "secondary"}>
                          {p.mappingConfidence}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vercel service breakdown (this month)</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.serviceBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Vercel charges this month.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.serviceBreakdown.map((s) => (
                    <TableRow key={s.serviceName}>
                      <TableCell>{s.serviceName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(s.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">v0 chats ({detail.chats.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.chats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chats attributed to this cost center.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chat</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.chats.slice(0, 50).map((chat) => (
                  <TableRow key={chat.id}>
                    <TableCell className="max-w-md">
                      {chat.webUrl ? (
                        <a
                          href={chat.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {chat.title ?? chat.chatId}
                        </a>
                      ) : (
                        <span className="font-medium">{chat.title ?? chat.chatId}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(chat.updatedAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(chat.totalCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit cost center</CardTitle>
        </CardHeader>
        <CardContent>
          <CostCenterForm
            costCenter={{
              id: center.id,
              name: center.name,
              description: center.description,
              monthlyBudgetUsd: center.monthlyBudgetUsd,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
