"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createCostCenter, updateCostCenter } from "@/app/actions/cost-centers"

type Props = {
  costCenter?: {
    id: string
    name: string
    description: string | null
    monthlyBudgetUsd: string | null
  }
}

export function CostCenterForm({ costCenter }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(costCenter)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setError(null)
    startTransition(async () => {
      const result = costCenter
        ? await updateCostCenter(costCenter.id, formData)
        : await createCostCenter(formData)
      if (!result.ok) {
        setError(result.error ?? "Something went wrong")
        return
      }
      if (!isEdit) form.reset()
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cc-name">Name</Label>
          <Input id="cc-name" name="name" required defaultValue={costCenter?.name ?? ""} placeholder="Interne Tools" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cc-budget">Monthly budget (USD, optional)</Label>
          <Input
            id="cc-budget"
            name="monthlyBudgetUsd"
            type="number"
            min="0"
            step="0.01"
            defaultValue={costCenter?.monthlyBudgetUsd ?? ""}
            placeholder="500"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cc-description">Description (optional)</Label>
        <Textarea
          id="cc-description"
          name="description"
          rows={2}
          defaultValue={costCenter?.description ?? ""}
          placeholder="What belongs to this cost center?"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create cost center"}
        </Button>
      </div>
    </form>
  )
}
