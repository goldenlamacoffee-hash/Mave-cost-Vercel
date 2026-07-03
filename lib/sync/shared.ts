import "server-only"
import { createHash } from "crypto"
import { eq, or, and, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessCostCenters, syncRuns, technicalProjects } from "@/lib/db/schema"

export function stableHash(input: unknown): string {
  const json = JSON.stringify(input, Object.keys(input as Record<string, unknown>).sort())
  return createHash("sha256").update(json).digest("hex")
}

export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

export type SyncResult = {
  rowsImported: number
  rowsUpdated: number
}

export async function startSyncRun(source: "vercel" | "v0_usage" | "v0_chats" | "all") {
  const [run] = await db
    .insert(syncRuns)
    .values({ source, status: "running" })
    .returning({ id: syncRuns.id })
  return run.id
}

export async function finishSyncRun(
  runId: string,
  status: "success" | "failed",
  result: Partial<SyncResult>,
  errorMessage?: string,
) {
  await db
    .update(syncRuns)
    .set({
      status,
      finishedAt: new Date(),
      rowsImported: String(result.rowsImported ?? 0),
      rowsUpdated: String(result.rowsUpdated ?? 0),
      // Never store secrets in error messages; strip anything that looks like a token
      errorMessage: errorMessage ? sanitizeError(errorMessage) : null,
    })
    .where(eq(syncRuns.id, runId))
}

export function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/(token|key|secret|password)=[^&\s]+/gi, "$1=[redacted]")
    .slice(0, 2000)
}

/** Find a technical project by external ID or by name/slug. */
export async function findTechnicalProject(opts: {
  externalProjectId?: string | null
  nameOrSlug?: string | null
}) {
  const { externalProjectId, nameOrSlug } = opts

  if (externalProjectId) {
    const byId = await db
      .select()
      .from(technicalProjects)
      .where(eq(technicalProjects.externalProjectId, externalProjectId))
      .limit(1)
    if (byId[0]) return byId[0]
  }

  if (nameOrSlug) {
    const byName = await db
      .select()
      .from(technicalProjects)
      .where(
        or(
          eq(technicalProjects.externalProjectName, nameOrSlug),
          eq(technicalProjects.externalProjectSlug, nameOrSlug),
        ),
      )
      .limit(1)
    if (byName[0]) return byName[0]
  }

  return null
}

/** Get the "Unassigned / Draft" cost center id (if seeded). */
export async function getUnassignedCostCenterId(): Promise<string | null> {
  const rows = await db
    .select({ id: businessCostCenters.id })
    .from(businessCostCenters)
    .where(eq(businessCostCenters.slug, "unassigned-draft"))
    .limit(1)
  return rows[0]?.id ?? null
}

/**
 * Ensure a technical project row exists for a provider project.
 * Returns the technical project id. Newly discovered projects are
 * marked unmapped unless a name/slug seed match exists.
 */
export async function upsertTechnicalProject(opts: {
  provider: "vercel" | "v0"
  externalProjectId: string
  externalProjectName?: string | null
  externalProjectSlug?: string | null
}): Promise<{ id: string; created: boolean }> {
  const existing = await db
    .select()
    .from(technicalProjects)
    .where(
      and(
        eq(technicalProjects.externalProjectId, opts.externalProjectId),
        isNotNull(technicalProjects.externalProjectId),
      ),
    )
    .limit(1)

  if (existing[0]) {
    // Keep name fresh
    if (opts.externalProjectName && existing[0].externalProjectName !== opts.externalProjectName) {
      await db
        .update(technicalProjects)
        .set({ externalProjectName: opts.externalProjectName, updatedAt: new Date() })
        .where(eq(technicalProjects.id, existing[0].id))
    }
    return { id: existing[0].id, created: false }
  }

  // Try to adopt a seeded manual row that matches by name/slug (no external id yet)
  if (opts.externalProjectName || opts.externalProjectSlug) {
    const seedMatch = await findTechnicalProject({
      nameOrSlug: opts.externalProjectName ?? opts.externalProjectSlug,
    })
    if (seedMatch && !seedMatch.externalProjectId) {
      await db
        .update(technicalProjects)
        .set({
          provider: opts.provider,
          externalProjectId: opts.externalProjectId,
          externalProjectSlug: opts.externalProjectSlug ?? seedMatch.externalProjectSlug,
          mappingConfidence:
            seedMatch.mappingConfidence === "seed" ? "seed" : seedMatch.mappingConfidence,
          updatedAt: new Date(),
        })
        .where(eq(technicalProjects.id, seedMatch.id))
      return { id: seedMatch.id, created: false }
    }
  }

  const [inserted] = await db
    .insert(technicalProjects)
    .values({
      provider: opts.provider,
      externalProjectId: opts.externalProjectId,
      externalProjectName: opts.externalProjectName ?? opts.externalProjectId,
      externalProjectSlug: opts.externalProjectSlug,
      mappingConfidence: "unmapped",
    })
    .returning({ id: technicalProjects.id })

  return { id: inserted.id, created: true }
}
