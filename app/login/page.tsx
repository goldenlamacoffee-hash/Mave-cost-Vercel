import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { LoginForm } from "@/components/login-form"

export const metadata = {
  title: "Login | Mave Cost Control",
}

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect("/dashboard")

  const envReady = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Internal FinOps
          </div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">Mave Cost Control</h1>
        </div>
        {!envReady && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            ADMIN_EMAIL and ADMIN_PASSWORD environment variables are not set. Configure them before
            logging in.
          </div>
        )}
        <LoginForm />
      </div>
    </main>
  )
}
