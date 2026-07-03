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
import { getRecentSyncRuns } from "@/lib/queries"
import { formatDateTime } from "@/lib/format"
import { SyncControls } from "@/components/sync-controls"

export const dynamic = "force-dynamic"

export default function SyncPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sync</h1>
        <p className="text-sm text-muted-foreground">
          Import data from the Vercel billing API and the v0 Platform API. A daily cron also runs at 06:00 UTC.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run a sync</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncControls />
        </CardContent>
      </Card>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <SyncHistory />
      </Suspense>
    </div>
  )
}

async function SyncHistory() {
  const runs = await getRecentSyncRuns(30)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent sync runs</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sync runs yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Finished</TableHead>
                <TableHead className="text-right">Imported</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">{run.source}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        run.status === "success"
                          ? "default"
                          : run.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(run.startedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(run.finishedAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{run.rowsImported ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{run.rowsUpdated ?? 0}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-destructive">
                    {run.errorMessage ?? ""}
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
