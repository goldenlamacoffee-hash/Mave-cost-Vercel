"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Building2,
  FolderGit2,
  MessageSquare,
  AlertTriangle,
  Table2,
  RefreshCw,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { logoutAction } from "@/app/actions/auth"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/cost-centers", label: "Cost Centers", icon: Building2 },
  { href: "/dashboard/projects", label: "Projects", icon: FolderGit2 },
  { href: "/dashboard/chats", label: "v0 Chats", icon: MessageSquare },
  { href: "/dashboard/unmapped", label: "Unmapped", icon: AlertTriangle },
  { href: "/dashboard/ledger", label: "Ledger", icon: Table2 },
  { href: "/dashboard/sync", label: "Sync", icon: RefreshCw },
]

export function DashboardNav({ email }: { email: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Dashboard">
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-border p-4 md:hidden">
        <div className="font-mono text-sm font-semibold tracking-tight text-foreground">
          Mave Cost Control
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {open && (
        <div className="border-b border-border p-4 md:hidden">
          {nav}
          <form action={logoutAction} className="mt-4">
            <Button variant="outline" size="sm" type="submit" className="w-full bg-transparent">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r border-border bg-card p-4 md:flex">
        <div className="mb-6 px-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Internal FinOps
          </div>
          <div className="text-sm font-semibold tracking-tight text-foreground">
            Mave Cost Control
          </div>
        </div>
        {nav}
        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          <div className="truncate px-3 text-xs text-muted-foreground" title={email}>
            {email}
          </div>
          <form action={logoutAction}>
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
    </>
  )
}
