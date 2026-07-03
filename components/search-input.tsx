"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function SearchInput({ placeholder }: { placeholder?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get("q") ?? "")

  function submit() {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set("q", value)
    else params.delete("q")
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
        }}
        onBlur={submit}
        placeholder={placeholder ?? "Search…"}
        className="pl-9"
        aria-label="Search"
      />
    </div>
  )
}
