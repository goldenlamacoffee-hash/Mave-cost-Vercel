import { Suspense } from "react"
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
import { getAllCostCenters, getChatsWithCost } from "@/lib/queries"
import { formatUsd, formatDateTime } from "@/lib/format"
import { AssignCostCenterSelect } from "@/components/assign-cost-center-select"
import { SearchInput } from "@/components/search-input"

export const dynamic = "force-dynamic"

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cc?: string }>
}) {
  const { q, cc } = await searchParams
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">v0 Chats</h1>
        <p className="text-sm text-muted-foreground">
          All synced v0 chats with lifetime cost. Manual chat assignment overrides the project mapping.
        </p>
      </div>
      <SearchInput placeholder="Search by title or chat ID…" />
      <Suspense key={`${q}-${cc}`} fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ChatsContent search={q} costCenterId={cc} />
      </Suspense>
    </div>
  )
}

async function ChatsContent({ search, costCenterId }: { search?: string; costCenterId?: string }) {
  const [chats, costCenters] = await Promise.all([
    getChatsWithCost({ search, costCenterId }),
    getAllCostCenters(),
  ])
  const ccOptions = costCenters.map((cc) => ({ id: cc.id, name: cc.name }))

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 text-sm text-muted-foreground">{chats.length} chats</div>
        {chats.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No chats found. Run a sync from the Sync page to import v0 chats.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chat</TableHead>
                <TableHead>Cost center</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Total cost</TableHead>
                <TableHead>Assign</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chats.map((chat) => (
                <TableRow key={chat.id}>
                  <TableCell className="max-w-xs">
                    <div className="flex flex-col">
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
                      <span className="truncate text-xs text-muted-foreground">{chat.chatId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {chat.costCenterName ? (
                      <Badge variant={chat.manualBusinessCostCenterId ? "default" : "secondary"}>
                        {chat.costCenterName}
                        {chat.manualBusinessCostCenterId ? " (manual)" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Unmapped</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(chat.updatedAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(chat.totalCost)}</TableCell>
                  <TableCell>
                    <AssignCostCenterSelect
                      targetType="chat"
                      targetId={chat.id}
                      currentCostCenterId={chat.manualBusinessCostCenterId}
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
  )
}
