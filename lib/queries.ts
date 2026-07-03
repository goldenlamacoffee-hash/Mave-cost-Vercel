import "server-only"
import { sql, desc, eq, count } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  businessCostCenters,
  syncRuns,
  technicalProjects,
  v0Chats,
  v0UsageEvents,
  vercelBillingCharges,
} from "@/lib/db/schema"

export type DateRange = { from: Date; to: Date }

export function currentMonthRange(): DateRange {
  const now = new Date()
  return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: now }
}

/**
 * Mapping priority for v0 usage events:
 * 1. manual chat mapping (v0_chats.manual_business_cost_center_id)
 * 2. chat -> technical project -> cost center
 * For Vercel charges: charge -> technical project -> cost center.
 * Anything unresolved is unmapped.
 */
const v0EventCostCenterExpr = sql<string | null>`
  COALESCE(
    c.manual_business_cost_center_id,
    tp.business_cost_center_id
  )
`

export async function getOverviewTotals(range: DateRange) {
  const v0Rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(e.total_cost), 0) AS total,
      COALESCE(SUM(CASE WHEN ${v0EventCostCenterExpr} IS NULL THEN e.total_cost ELSE 0 END), 0) AS unmapped
    FROM v0_usage_events e
    LEFT JOIN v0_chats c ON c.chat_id = e.chat_id
    LEFT JOIN technical_projects tp ON tp.id = c.technical_project_id
    WHERE e.event_created_at >= ${range.from.toISOString()} AND e.event_created_at <= ${range.to.toISOString()}
  `)

  const vercelRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(ch.effective_cost), 0) AS total,
      COALESCE(SUM(CASE WHEN tp.business_cost_center_id IS NULL THEN ch.effective_cost ELSE 0 END), 0) AS unmapped
    FROM vercel_billing_charges ch
    LEFT JOIN technical_projects tp ON tp.id = ch.technical_project_id
    WHERE ch.period_start >= ${range.from.toISOString()} AND ch.period_start <= ${range.to.toISOString()}
  `)

  const v0 = v0Rows[0] as { total: string; unmapped: string }
  const vercel = vercelRows[0] as { total: string; unmapped: string }

  return {
    v0Total: Number(v0.total),
    v0Unmapped: Number(v0.unmapped),
    vercelTotal: Number(vercel.total),
    vercelUnmapped: Number(vercel.unmapped),
    total: Number(v0.total) + Number(vercel.total),
    unmappedTotal: Number(v0.unmapped) + Number(vercel.unmapped),
  }
}

export type CostCenterCost = {
  id: string | null
  name: string
  slug: string | null
  monthlyBudgetUsd: number | null
  v0Cost: number
  vercelCost: number
  totalCost: number
}

export async function getCostByCenter(range: DateRange): Promise<CostCenterCost[]> {
  const rows = await db.execute(sql`
    WITH v0_costs AS (
      SELECT ${v0EventCostCenterExpr} AS bcc_id, SUM(e.total_cost) AS cost
      FROM v0_usage_events e
      LEFT JOIN v0_chats c ON c.chat_id = e.chat_id
      LEFT JOIN technical_projects tp ON tp.id = c.technical_project_id
      WHERE e.event_created_at >= ${range.from.toISOString()} AND e.event_created_at <= ${range.to.toISOString()}
      GROUP BY 1
    ),
    vercel_costs AS (
      SELECT tp.business_cost_center_id AS bcc_id, SUM(ch.effective_cost) AS cost
      FROM vercel_billing_charges ch
      LEFT JOIN technical_projects tp ON tp.id = ch.technical_project_id
      WHERE ch.period_start >= ${range.from.toISOString()} AND ch.period_start <= ${range.to.toISOString()}
      GROUP BY 1
    ),
    combined AS (
      SELECT bcc_id, cost AS v0_cost, 0::numeric AS vercel_cost FROM v0_costs
      UNION ALL
      SELECT bcc_id, 0::numeric, cost FROM vercel_costs
    )
    SELECT
      bcc.id,
      COALESCE(bcc.name, 'Unmapped') AS name,
      bcc.slug,
      bcc.monthly_budget_usd,
      COALESCE(SUM(combined.v0_cost), 0) AS v0_cost,
      COALESCE(SUM(combined.vercel_cost), 0) AS vercel_cost
    FROM business_cost_centers bcc
    FULL OUTER JOIN combined ON combined.bcc_id = bcc.id
    WHERE bcc.id IS NOT NULL OR combined.bcc_id IS NULL
    GROUP BY bcc.id, bcc.name, bcc.slug, bcc.monthly_budget_usd
    ORDER BY COALESCE(SUM(combined.v0_cost), 0) + COALESCE(SUM(combined.vercel_cost), 0) DESC
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: (r.id as string) ?? null,
    name: r.name as string,
    slug: (r.slug as string) ?? null,
    monthlyBudgetUsd: r.monthly_budget_usd != null ? Number(r.monthly_budget_usd) : null,
    v0Cost: Number(r.v0_cost ?? 0),
    vercelCost: Number(r.vercel_cost ?? 0),
    totalCost: Number(r.v0_cost ?? 0) + Number(r.vercel_cost ?? 0),
  }))
}

export type DailySpend = { day: string; v0Cost: number; vercelCost: number }

export async function getDailySpend(range: DateRange, costCenterId?: string): Promise<DailySpend[]> {
  const ccFilterV0 = costCenterId
    ? sql`AND ${v0EventCostCenterExpr} = ${costCenterId}`
    : sql``
  const ccFilterVercel = costCenterId
    ? sql`AND tp.business_cost_center_id = ${costCenterId}`
    : sql``

  const rows = await db.execute(sql`
    WITH v0_daily AS (
      SELECT date_trunc('day', e.event_created_at)::date AS day, SUM(e.total_cost) AS cost
      FROM v0_usage_events e
      LEFT JOIN v0_chats c ON c.chat_id = e.chat_id
      LEFT JOIN technical_projects tp ON tp.id = c.technical_project_id
      WHERE e.event_created_at >= ${range.from.toISOString()} AND e.event_created_at <= ${range.to.toISOString()}
      ${ccFilterV0}
      GROUP BY 1
    ),
    vercel_daily AS (
      SELECT date_trunc('day', ch.period_start)::date AS day, SUM(ch.effective_cost) AS cost
      FROM vercel_billing_charges ch
      LEFT JOIN technical_projects tp ON tp.id = ch.technical_project_id
      WHERE ch.period_start >= ${range.from.toISOString()} AND ch.period_start <= ${range.to.toISOString()}
      ${ccFilterVercel}
      GROUP BY 1
    )
    SELECT
      COALESCE(v.day, vc.day) AS day,
      COALESCE(v.cost, 0) AS v0_cost,
      COALESCE(vc.cost, 0) AS vercel_cost
    FROM v0_daily v
    FULL OUTER JOIN vercel_daily vc ON v.day = vc.day
    ORDER BY 1
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    day: String(r.day),
    v0Cost: Number(r.v0_cost ?? 0),
    vercelCost: Number(r.vercel_cost ?? 0),
  }))
}

export async function getRecentSyncRuns(limit = 20) {
  return db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(limit)
}

export async function getSetupState() {
  const [syncCount] = await db.select({ n: count() }).from(syncRuns)
  const [successCount] = await db
    .select({ n: count() })
    .from(syncRuns)
    .where(eq(syncRuns.status, "success"))
  return {
    migrationsApplied: true, // if this query runs, migrations exist
    anySyncRun: Number(syncCount.n) > 0,
    firstSyncCompleted: Number(successCount.n) > 0,
  }
}

export async function getAllCostCenters() {
  return db.select().from(businessCostCenters).orderBy(businessCostCenters.name)
}

export async function getCostCenterById(id: string) {
  const rows = await db
    .select()
    .from(businessCostCenters)
    .where(eq(businessCostCenters.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getTechnicalProjectsWithCenters() {
  return db
    .select({
      project: technicalProjects,
      costCenterName: businessCostCenters.name,
    })
    .from(technicalProjects)
    .leftJoin(businessCostCenters, eq(technicalProjects.businessCostCenterId, businessCostCenters.id))
    .orderBy(
      sql`CASE WHEN ${technicalProjects.mappingConfidence} = 'unmapped' THEN 0 ELSE 1 END`,
      technicalProjects.externalProjectName,
    )
}

export async function getChatsWithCost(opts?: { search?: string; costCenterId?: string }) {
  const searchFilter = opts?.search
    ? sql`AND (c.title ILIKE ${"%" + opts.search + "%"} OR c.chat_id ILIKE ${"%" + opts.search + "%"})`
    : sql``

  const ccFilter = opts?.costCenterId
    ? opts.costCenterId === "unmapped"
      ? sql`AND COALESCE(c.manual_business_cost_center_id, tp.business_cost_center_id) IS NULL`
      : sql`AND COALESCE(c.manual_business_cost_center_id, tp.business_cost_center_id) = ${opts.costCenterId}`
    : sql``

  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.chat_id,
      c.title,
      c.web_url,
      c.vercel_project_id,
      c.manual_business_cost_center_id,
      c.technical_project_id,
      c.updated_at,
      tp.business_cost_center_id AS project_bcc_id,
      COALESCE(bcc_manual.name, bcc_project.name) AS cost_center_name,
      COALESCE((
        SELECT SUM(e.total_cost) FROM v0_usage_events e WHERE e.chat_id = c.chat_id
      ), 0) AS total_cost
    FROM v0_chats c
    LEFT JOIN technical_projects tp ON tp.id = c.technical_project_id
    LEFT JOIN business_cost_centers bcc_manual ON bcc_manual.id = c.manual_business_cost_center_id
    LEFT JOIN business_cost_centers bcc_project ON bcc_project.id = tp.business_cost_center_id
    WHERE TRUE ${searchFilter} ${ccFilter}
    ORDER BY total_cost DESC, c.updated_at DESC
    LIMIT 500
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    chatId: r.chat_id as string,
    title: (r.title as string) ?? null,
    webUrl: (r.web_url as string) ?? null,
    vercelProjectId: (r.vercel_project_id as string) ?? null,
    manualBusinessCostCenterId: (r.manual_business_cost_center_id as string) ?? null,
    technicalProjectId: (r.technical_project_id as string) ?? null,
    updatedAt: r.updated_at ? new Date(r.updated_at as string) : null,
    costCenterName: (r.cost_center_name as string) ?? null,
    totalCost: Number(r.total_cost ?? 0),
  }))
}

export async function getCostCenterDetail(id: string, range: DateRange) {
  const projects = await db
    .select()
    .from(technicalProjects)
    .where(eq(technicalProjects.businessCostCenterId, id))
    .orderBy(technicalProjects.externalProjectName)

  const chats = await getChatsWithCost({ costCenterId: id })

  const serviceRows = await db.execute(sql`
    SELECT ch.service_name, SUM(ch.effective_cost) AS cost
    FROM vercel_billing_charges ch
    LEFT JOIN technical_projects tp ON tp.id = ch.technical_project_id
    WHERE tp.business_cost_center_id = ${id}
      AND ch.period_start >= ${range.from.toISOString()} AND ch.period_start <= ${range.to.toISOString()}
    GROUP BY 1
    ORDER BY 2 DESC
  `)

  const usageRows = await db.execute(sql`
    SELECT e.id, e.type, e.total_cost, e.chat_id, e.model, e.user_email, e.event_created_at
    FROM v0_usage_events e
    LEFT JOIN v0_chats c ON c.chat_id = e.chat_id
    LEFT JOIN technical_projects tp ON tp.id = c.technical_project_id
    WHERE COALESCE(c.manual_business_cost_center_id, tp.business_cost_center_id) = ${id}
      AND e.event_created_at >= ${range.from.toISOString()} AND e.event_created_at <= ${range.to.toISOString()}
    ORDER BY e.event_created_at DESC
    LIMIT 200
  `)

  return {
    projects,
    chats,
    serviceBreakdown: (serviceRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      serviceName: (r.service_name as string) ?? "Unknown",
      cost: Number(r.cost ?? 0),
    })),
    usageEvents: (usageRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      type: (r.type as string) ?? null,
      totalCost: Number(r.total_cost ?? 0),
      chatId: (r.chat_id as string) ?? null,
      model: (r.model as string) ?? null,
      userEmail: (r.user_email as string) ?? null,
      eventCreatedAt: r.event_created_at ? new Date(r.event_created_at as string) : null,
    })),
  }
}

export async function getUnmappedData() {
  const totals = await getOverviewTotals({ from: new Date(0), to: new Date() })

  const unmappedChats = await getChatsWithCost({ costCenterId: "unmapped" })

  const unmappedProjects = await db
    .select()
    .from(technicalProjects)
    .where(sql`${technicalProjects.businessCostCenterId} IS NULL`)
    .orderBy(technicalProjects.externalProjectName)

  const unmappedCharges = await db.execute(sql`
    SELECT ch.id, ch.service_name, ch.effective_cost, ch.billing_currency,
           ch.vercel_project_id, ch.vercel_project_name, ch.period_start
    FROM vercel_billing_charges ch
    LEFT JOIN technical_projects tp ON tp.id = ch.technical_project_id
    WHERE tp.business_cost_center_id IS NULL
    ORDER BY ch.effective_cost DESC NULLS LAST
    LIMIT 200
  `)

  return {
    unmappedV0Total: totals.v0Unmapped,
    unmappedVercelTotal: totals.vercelUnmapped,
    unmappedChats,
    unmappedProjects,
    unmappedCharges: (unmappedCharges as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      serviceName: (r.service_name as string) ?? null,
      effectiveCost: Number(r.effective_cost ?? 0),
      billingCurrency: (r.billing_currency as string) ?? "USD",
      vercelProjectId: (r.vercel_project_id as string) ?? null,
      vercelProjectName: (r.vercel_project_name as string) ?? null,
      periodStart: r.period_start ? new Date(r.period_start as string) : null,
    })),
  }
}

export type LedgerFilters = {
  from?: Date
  to?: Date
  search?: string
  costCenterId?: string
  model?: string
  service?: string
  user?: string
}

export async function getV0UsageLedger(filters: LedgerFilters, limit = 500) {
  const conditions = [sql`TRUE`]
  if (filters.from) conditions.push(sql`e.event_created_at >= ${filters.from.toISOString()}`)
  if (filters.to) conditions.push(sql`e.event_created_at <= ${filters.to.toISOString()}`)
  if (filters.search)
    conditions.push(
      sql`(e.chat_id ILIKE ${"%" + filters.search + "%"} OR e.model ILIKE ${"%" + filters.search + "%"} OR e.user_email ILIKE ${"%" + filters.search + "%"})`,
    )
  if (filters.model) conditions.push(sql`e.model ILIKE ${"%" + filters.model + "%"}`)
  if (filters.user) conditions.push(sql`e.user_email ILIKE ${"%" + filters.user + "%"}`)
  if (filters.costCenterId) {
    if (filters.costCenterId === "unmapped") {
      conditions.push(sql`COALESCE(c.manual_business_cost_center_id, tp.business_cost_center_id) IS NULL`)
    } else {
      conditions.push(
        sql`COALESCE(c.manual_business_cost_center_id, tp.business_cost_center_id) = ${filters.costCenterId}`,
      )
    }
  }

  const rows = await db.execute(sql`
    SELECT e.*, COALESCE(bcc_m.name, bcc_p.name) AS cost_center_name
    FROM v0_usage_events e
    LEFT JOIN v0_chats c ON c.chat_id = e.chat_id
    LEFT JOIN technical_projects tp ON tp.id = c.technical_project_id
    LEFT JOIN business_cost_centers bcc_m ON bcc_m.id = c.manual_business_cost_center_id
    LEFT JOIN business_cost_centers bcc_p ON bcc_p.id = tp.business_cost_center_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY e.event_created_at DESC NULLS LAST
    LIMIT ${limit}
  `)

  return rows as unknown as Array<Record<string, unknown>>
}

export async function getVercelChargesLedger(filters: LedgerFilters, limit = 500) {
  const conditions = [sql`TRUE`]
  if (filters.from) conditions.push(sql`ch.period_start >= ${filters.from.toISOString()}`)
  if (filters.to) conditions.push(sql`ch.period_start <= ${filters.to.toISOString()}`)
  if (filters.search)
    conditions.push(
      sql`(ch.service_name ILIKE ${"%" + filters.search + "%"} OR ch.vercel_project_name ILIKE ${"%" + filters.search + "%"})`,
    )
  if (filters.service) conditions.push(sql`ch.service_name ILIKE ${"%" + filters.service + "%"}`)
  if (filters.costCenterId) {
    if (filters.costCenterId === "unmapped") {
      conditions.push(sql`tp.business_cost_center_id IS NULL`)
    } else {
      conditions.push(sql`tp.business_cost_center_id = ${filters.costCenterId}`)
    }
  }

  const rows = await db.execute(sql`
    SELECT ch.*, bcc.name AS cost_center_name
    FROM vercel_billing_charges ch
    LEFT JOIN technical_projects tp ON tp.id = ch.technical_project_id
    LEFT JOIN business_cost_centers bcc ON bcc.id = tp.business_cost_center_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY ch.period_start DESC NULLS LAST
    LIMIT ${limit}
  `)

  return rows as unknown as Array<Record<string, unknown>>
}
