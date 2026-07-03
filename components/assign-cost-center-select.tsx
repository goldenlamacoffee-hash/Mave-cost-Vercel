"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { assignChatToCostCenter, assignProjectToCostCenter } from "@/app/actions/mappings"

const NONE = "__none__"

type Props = {
  targetType: "project" | "chat"
  targetId: string
  currentCostCenterId: string | null
  costCenters: Array<{ id: string; name: string }>
}

export function AssignCostCenterSelect({ targetType, targetId, currentCostCenterId, costCenters }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(value: string | null) {
    const costCenterId = value === NONE || value === null ? null : value
    setError(null)
    startTransition(async () => {
      const result =
        targetType === "project"
          ? await assignProjectToCostCenter(targetId, costCenterId)
          : await assignChatToCostCenter(targetId, costCenterId)
      if (!result.ok) {
        setError(result.error ?? "Failed")
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={currentCostCenterId ?? NONE}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <SelectTrigger className="w-44" size="sm" aria-label="Assign cost center">
          <SelectValue>
            {(value: string) =>
              value === NONE ? "Unassigned" : (costCenters.find((cc) => cc.id === value)?.name ?? value)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Unassigned</SelectItem>
          {costCenters.map((cc) => (
            <SelectItem key={cc.id} value={cc.id}>
              {cc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
