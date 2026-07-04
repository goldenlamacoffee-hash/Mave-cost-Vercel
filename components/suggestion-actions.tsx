"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { applyChatSuggestions } from "@/app/actions/mappings"

export function ApplySuggestionButton({
  chatRowId,
  costCenterId,
}: {
  chatRowId: string
  costCenterId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleApply() {
    startTransition(async () => {
      const result = await applyChatSuggestions([{ chatRowId, costCenterId }])
      if (result.ok) router.refresh()
    })
  }

  return (
    <Button size="sm" variant="outline" onClick={handleApply} disabled={isPending}>
      <Check className="size-3.5" />
      {isPending ? "Applying…" : "Apply"}
    </Button>
  )
}

export function ApplyAllSuggestionsButton({
  entries,
}: {
  entries: Array<{ chatRowId: string; costCenterId: string }>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  function handleApplyAll() {
    startTransition(async () => {
      const res = await applyChatSuggestions(entries)
      if (res.ok) {
        setResult(`Applied ${res.applied} mapping${res.applied === 1 ? "" : "s"}`)
        router.refresh()
      } else {
        setResult(res.error ?? "Failed")
      }
    })
  }

  if (entries.length === 0) return null

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
      <Button size="sm" onClick={handleApplyAll} disabled={isPending}>
        <Sparkles className="size-3.5" />
        {isPending
          ? "Applying…"
          : `Apply all high-confidence suggestions (${entries.length})`}
      </Button>
    </div>
  )
}
