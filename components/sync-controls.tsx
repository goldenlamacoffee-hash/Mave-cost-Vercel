"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { triggerSync } from "@/app/actions/sync"
import type { SyncSource } from "@/lib/sync"

export function SyncControls() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [source, setSource] = useState<SyncSource>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  function run(opts?: { days?: number; useRange?: boolean }) {
    setMessage(null)
    startTransition(async () => {
      const result = await triggerSync(source, {
        days: opts?.days,
        from: opts?.useRange && from ? from : undefined,
        to: opts?.useRange && to ? to : undefined,
      })
      const outcomes = result.outcomes ?? []
      const succeeded = outcomes.filter((o) => o.ok)
      const failed = outcomes.filter((o) => !o.ok)

      if (failed.length === 0 && outcomes.length > 0) {
        const imported = succeeded.reduce((s, o) => s + (o.result?.rowsImported ?? 0), 0)
        const updated = succeeded.reduce((s, o) => s + (o.result?.rowsUpdated ?? 0), 0)
        setMessage({ text: `Done. ${imported} imported, ${updated} updated.`, error: false })
      } else if (outcomes.length > 0) {
        // Partial results: report successes separately so they don't look broken
        const okPart =
          succeeded.length > 0
            ? `Succeeded: ${succeeded
                .map((o) => `${o.source} (${(o.result?.rowsImported ?? 0)} imported)`)
                .join(", ")}. `
            : ""
        const failPart = `Failed: ${failed.map((o) => `${o.source}: ${o.error}`).join(" | ")}`
        setMessage({ text: `${okPart}${failPart}`, error: true })
      } else {
        setMessage({ text: result.error ?? "Sync failed", error: true })
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Source</Label>
          <Select value={source} onValueChange={(v) => setSource(v as SyncSource)}>
            <SelectTrigger className="w-48" aria-label="Sync source">
              <SelectValue>
                {(value: string) =>
                  ({
                    all: "All sources",
                    vercel: "Vercel billing",
                    v0_usage: "v0 usage",
                    v0_chats: "v0 chats",
                  })[value] ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="vercel">Vercel billing</SelectItem>
              <SelectItem value="v0_usage">v0 usage</SelectItem>
              <SelectItem value="v0_chats">v0 chats</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => run()} disabled={pending}>
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Syncing…" : "Sync now"}
        </Button>
        <Button onClick={() => run({ days: 30 })} disabled={pending} variant="outline" className="bg-transparent">
          Backfill 30 days
        </Button>
        <Button onClick={() => run({ days: 90 })} disabled={pending} variant="outline" className="bg-transparent">
          Backfill 90 days
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-t border-border pt-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sync-from" className="text-xs">
            Custom range from
          </Label>
          <Input
            id="sync-from"
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sync-to" className="text-xs">
            To
          </Label>
          <Input id="sync-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button
          onClick={() => run({ useRange: true })}
          disabled={pending || !from}
          variant="outline"
          className="bg-transparent"
        >
          Sync custom range
        </Button>
      </div>

      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
