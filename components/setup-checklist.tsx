import { CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type EnvItem = { name: string; set: boolean }

export function SetupChecklist({
  envStatus,
  migrationsApplied,
  firstSyncCompleted,
}: {
  envStatus: EnvItem[]
  migrationsApplied: boolean
  firstSyncCompleted: boolean
}) {
  const items: { label: string; done: boolean }[] = [
    ...envStatus.map((e) => ({ label: `${e.name} configured`, done: e.set })),
    { label: "Database migrations applied", done: migrationsApplied },
    { label: "First sync completed", done: firstSyncCompleted },
  ]

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base">Setup checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              )}
              <span className={item.done ? "text-muted-foreground" : "text-foreground"}>
                {item.label}
              </span>
              <span className="sr-only">{item.done ? "complete" : "incomplete"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Configure any missing environment variables in your project settings, then run your first
          sync. No fake data is ever shown — all numbers come from real imported usage.
        </p>
      </CardContent>
    </Card>
  )
}
