import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { DashboardNav } from "@/components/dashboard-nav"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <DashboardNav email={session.email} />
      <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
    </div>
  )
}
