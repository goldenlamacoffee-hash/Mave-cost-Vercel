"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Download } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALL = "__all__"

type Props = {
  costCenters: Array<{ id: string; name: string }>
  activeTab: "v0" | "vercel"
}

export function LedgerFilters({ costCenters, activeTab }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  const exportHref = `/api/export?type=${activeTab}&${searchParams.toString()}`

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lf-from" className="text-xs">
          From
        </Label>
        <Input
          id="lf-from"
          type="date"
          className="w-40"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value || null)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lf-to" className="text-xs">
          To
        </Label>
        <Input
          id="lf-to"
          type="date"
          className="w-40"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value || null)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Cost center</Label>
        <Select
          value={searchParams.get("cc") ?? ALL}
          onValueChange={(v) => setParam("cc", v === ALL ? null : v)}
        >
          <SelectTrigger className="w-48" aria-label="Filter by cost center">
            <SelectValue>
              {(value: string) =>
                value === ALL
                  ? "All cost centers"
                  : value === "unmapped"
                    ? "Unmapped only"
                    : (costCenters.find((cc) => cc.id === value)?.name ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All cost centers</SelectItem>
            <SelectItem value="unmapped">Unmapped only</SelectItem>
            {costCenters.map((cc) => (
              <SelectItem key={cc.id} value={cc.id}>
                {cc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lf-q" className="text-xs">
          Search
        </Label>
        <Input
          id="lf-q"
          className="w-56"
          placeholder={activeTab === "v0" ? "Chat ID, model, user…" : "Service, project…"}
          defaultValue={searchParams.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              setParam("q", (e.target as HTMLInputElement).value || null)
            }
          }}
          onBlur={(e) => setParam("q", e.target.value || null)}
        />
      </div>
      <a href={exportHref} download className={cn(buttonVariants({ variant: "outline" }), "ml-auto")}>
        <Download className="size-4" />
        Export CSV
      </a>
    </div>
  )
}
