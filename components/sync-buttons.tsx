"use client"

import { useState, useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { triggerSync } from "@/app/actions/sync"

export function SyncButtons() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  function run(days?: number) {
    setMessage(null)
    startTransition(async () => {
      const result = await triggerSync("all", days ? { days } : undefined)
      if (result.ok) {
        const total = result.outcomes?.reduce((sum, o) => sum + (o.result?.rowsImported ?? 0), 0)
        setMessage({ text: `Sync complete. ${total ?? 0} new rows imported.`, error: false })
      } else {
        const failed = result.outcomes?.filter((o) => !o.ok).map((o) => `${o.source}: ${o.error}`)
        setMessage({
          text: failed?.length ? failed.join(" | ") : (result.error ?? "Sync failed"),
          error: true,
        })
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => run()} disabled={pending} size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Syncing..." : "Sync now"}
        </Button>
        <Button onClick={() => run(30)} disabled={pending} variant="outline" size="sm">
          Backfill last 30 days
        </Button>
        <Button onClick={() => run(90)} disabled={pending} variant="outline" size="sm">
          Backfill last 90 days
        </Button>
      </div>
      {message && (
        <p
          role="status"
          className={`text-xs ${message.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
