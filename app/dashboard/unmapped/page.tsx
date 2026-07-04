import { Suspense } from "react"
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
import { getAllCostCenters, getUnmappedData } from "@/lib/queries"
import { getChatMappingSuggestions } from "@/lib/mapping-suggestions"
import { formatUsd, formatDate, formatDateTime } from "@/lib/format"
import { AssignCostCenterSelect } from "@/components/assign-cost-center-select"
import { ApplySuggestionButton, ApplyAllSuggestionsButton } from "@/components/suggestion-actions"

export const dynamic = "force-dynamic"

export default function UnmappedPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Unmapped Spend</h1>
        <p className="text-sm text-muted-foreground">
          Costs that could not be attributed to a cost center. Assign projects and chats to resolve them.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <UnmappedContent />
      </Suspense>
    </div>
  )
}

async function UnmappedContent() {
  const [data, costCenters] = await Promise.all([getUnmappedData(), getAllCostCenters()])
  const ccOptions = costCenters.map((cc) => ({ id: cc.id, name: cc.name }))

  const suggestions = await getChatMappingSuggestions(
    data.unmappedChats.map((c) => ({
      id: c.id,
      chatId: c.chatId,
      title: c.title,
      vercelProjectId: c.vercelProjectId,
    })),
  )

  const highConfidenceEntries = data.unmappedChats
    .map((c) => {
      const s = suggestions.get(c.id)
      return s && s.confidence === "high" ? { chatRowId: c.id, costCenterId: s.costCenterId } : null
    })
    .filter((e): e is { chatRowId: string; costCenterId: string } => e !== null)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unmapped v0 usage (all time)</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold tabular-nums text-destructive">
              {formatUsd(data.unmappedV0Total)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unmapped Vercel charges (all time)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold tabular-nums text-destructive">
              {formatUsd(data.unmappedVercelTotal)}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Unmapped technical projects ({data.unmappedProjects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.unmappedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">All projects are mapped.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Assign to cost center</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.unmappedProjects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.externalProjectName ?? p.externalProjectId}</TableCell>
                    <TableCell className="text-muted-foreground">{p.provider}</TableCell>
                    <TableCell>
                      <AssignCostCenterSelect
                        targetType="project"
                        targetId={p.id}
                        currentCostCenterId={null}
                        costCenters={ccOptions}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Unmapped v0 chats ({data.unmappedChats.length})</CardTitle>
          <ApplyAllSuggestionsButton entries={highConfidenceEntries} />
        </CardHeader>
        <CardContent>
          {data.unmappedChats.length === 0 ? (
            <p className="text-sm text-muted-foreground">All chats are mapped.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chat</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                  <TableHead>Suggested cost center</TableHead>
                  <TableHead>Assign to cost center</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.unmappedChats.map((chat) => {
                  const suggestion = suggestions.get(chat.id)
                  return (
                    <TableRow key={chat.id}>
                      <TableCell className="max-w-xs">
                        {chat.webUrl ? (
                          <a
                            href={chat.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {chat.title ?? chat.chatId}
                          </a>
                        ) : (
                          <span className="truncate font-medium">{chat.title ?? chat.chatId}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(chat.updatedAt)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(chat.totalCost)}</TableCell>
                      <TableCell>
                        {suggestion ? (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1.5 text-sm font-medium">
                                {suggestion.costCenterName}
                                <Badge
                                  variant={suggestion.confidence === "high" ? "default" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {suggestion.confidence}
                                </Badge>
                              </span>
                              <span className="text-xs text-muted-foreground">{suggestion.reason}</span>
                            </div>
                            <ApplySuggestionButton chatRowId={chat.id} costCenterId={suggestion.costCenterId} />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <AssignCostCenterSelect
                          targetType="chat"
                          targetId={chat.id}
                          currentCostCenterId={null}
                          costCenters={ccOptions}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Unmapped Vercel charges ({data.unmappedCharges.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Charges without a project (team-level fees) or whose project is unmapped. Map the project above, or
            these remain unattributed.
          </p>
        </CardHeader>
        <CardContent>
          {data.unmappedCharges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unmapped charges.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.unmappedCharges.map((ch) => (
                  <TableRow key={ch.id}>
                    <TableCell className="font-medium">{ch.serviceName ?? "Unknown"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ch.vercelProjectName ?? ch.vercelProjectId ?? (
                        <Badge variant="secondary">Team-level</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(ch.periodStart)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(ch.effectiveCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
