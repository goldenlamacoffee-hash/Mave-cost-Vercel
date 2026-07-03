import "server-only"
import { db } from "@/lib/db"
import { vercelBillingCharges } from "@/lib/db/schema"
import { stableHash, upsertTechnicalProject, type SyncResult } from "./shared"

const VERCEL_API = "https://api.vercel.com"

type FocusRecord = Record<string, unknown>

function str(record: FocusRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.length > 0) return value
    if (typeof value === "number") return String(value)
  }
  return null
}

function num(record: FocusRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value === "string" && value !== "" && !Number.isNaN(Number(value))) return value
  }
  return null
}

function date(record: FocusRecord, ...keys: string[]): Date | null {
  const value = str(record, ...keys)
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Extract the Vercel project id/name from a FOCUS record.
 * Vercel encodes project info in resource/tag fields.
 */
function extractProject(record: FocusRecord): { id: string | null; name: string | null } {
  let id = str(record, "x_ProjectId", "ProjectId", "projectId")
  let name = str(record, "x_ProjectName", "ProjectName", "projectName")

  const resourceId = str(record, "ResourceId", "resourceId")
  const resourceName = str(record, "ResourceName", "resourceName")

  if (!id && resourceId && resourceId.startsWith("prj_")) id = resourceId
  if (!name && resourceName) name = resourceName

  const tags = record["Tags"] ?? record["tags"]
  if (tags && typeof tags === "object") {
    const t = tags as Record<string, unknown>
    if (!id && typeof t["projectId"] === "string") id = t["projectId"] as string
    if (!name && typeof t["projectName"] === "string") name = t["projectName"] as string
    if (!name && typeof t["project"] === "string") name = t["project"] as string
  }

  return { id, name }
}

/**
 * Sync Vercel billing charges (FOCUS format) for a date range.
 * Idempotent via sourceHash.
 */
export async function syncVercelBilling(opts: { from: Date; to: Date }): Promise<SyncResult> {
  const token = process.env.VERCEL_API_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID
  if (!token) throw new Error("VERCEL_API_TOKEN is not set")
  if (!teamId) throw new Error("VERCEL_TEAM_ID is not set")

  const url = new URL(`${VERCEL_API}/v1/billing/charges`)
  url.searchParams.set("teamId", teamId)
  url.searchParams.set("from", String(opts.from.getTime()))
  url.searchParams.set("to", String(opts.to.getTime()))

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `Vercel billing API returned ${response.status}: ${body.slice(0, 300) || response.statusText}`,
    )
  }

  // Response is newline-delimited JSON (JSONL)
  const text = await response.text()
  const lines = text.split("\n").filter((line) => line.trim().length > 0)

  let imported = 0
  let updated = 0

  for (const line of lines) {
    let record: FocusRecord
    try {
      record = JSON.parse(line) as FocusRecord
    } catch {
      continue
    }

    const sourceHash = stableHash(record)
    const project = extractProject(record)

    let technicalProjectId: string | null = null
    if (project.id || project.name) {
      const tp = await upsertTechnicalProject({
        provider: "vercel",
        externalProjectId: project.id ?? `vercel-name:${project.name}`,
        externalProjectName: project.name ?? project.id ?? "unknown",
      })
      technicalProjectId = tp.id
    }

    const result = await db
      .insert(vercelBillingCharges)
      .values({
        sourceHash,
        periodStart: date(record, "ChargePeriodStart", "BillingPeriodStart", "chargePeriodStart"),
        periodEnd: date(record, "ChargePeriodEnd", "BillingPeriodEnd", "chargePeriodEnd"),
        serviceName: str(record, "ServiceName", "serviceName"),
        serviceCategory: str(record, "ServiceCategory", "serviceCategory"),
        billedCost: num(record, "BilledCost", "billedCost"),
        effectiveCost: num(record, "EffectiveCost", "effectiveCost"),
        billingCurrency: str(record, "BillingCurrency", "billingCurrency"),
        consumedQuantity: num(record, "ConsumedQuantity", "consumedQuantity"),
        consumedUnit: str(record, "ConsumedUnit", "consumedUnit"),
        regionName: str(record, "RegionName", "regionName", "RegionId"),
        vercelProjectId: project.id,
        vercelProjectName: project.name,
        technicalProjectId,
        rawJson: record,
      })
      .onConflictDoNothing({ target: vercelBillingCharges.sourceHash })
      .returning({ id: vercelBillingCharges.id })

    if (result.length > 0) imported++
    else updated++
  }

  return { rowsImported: imported, rowsUpdated: updated }
}
