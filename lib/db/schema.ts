import {
  pgTable,
  text,
  timestamp,
  boolean,
  numeric,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core"

export const businessCostCenters = pgTable("business_cost_centers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  monthlyBudgetUsd: numeric("monthly_budget_usd", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const technicalProjects = pgTable(
  "technical_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider", { enum: ["vercel", "v0", "manual"] }).notNull(),
    externalProjectId: text("external_project_id"),
    externalProjectName: text("external_project_name").notNull(),
    externalProjectSlug: text("external_project_slug"),
    businessCostCenterId: uuid("business_cost_center_id").references(
      () => businessCostCenters.id,
      { onDelete: "set null" },
    ),
    mappingConfidence: text("mapping_confidence", {
      enum: ["seed", "automatic", "manual", "unmapped"],
    })
      .notNull()
      .default("unmapped"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("technical_projects_external_id_idx").on(t.externalProjectId),
    index("technical_projects_bcc_idx").on(t.businessCostCenterId),
  ],
)

export const v0Chats = pgTable(
  "v0_chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: text("chat_id").notNull().unique(),
    title: text("title"),
    webUrl: text("web_url"),
    vercelProjectId: text("vercel_project_id"),
    technicalProjectId: uuid("technical_project_id").references(() => technicalProjects.id, {
      onDelete: "set null",
    }),
    manualBusinessCostCenterId: uuid("manual_business_cost_center_id").references(
      () => businessCostCenters.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    rawJson: jsonb("raw_json"),
  },
  (t) => [
    index("v0_chats_vercel_project_idx").on(t.vercelProjectId),
    index("v0_chats_technical_project_idx").on(t.technicalProjectId),
  ],
)

export const v0UsageEvents = pgTable(
  "v0_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceEventId: text("source_event_id").unique(),
    sourceHash: text("source_hash").notNull().unique(),
    type: text("type"),
    totalCost: numeric("total_cost", { precision: 14, scale: 6 }).notNull(),
    promptCost: numeric("prompt_cost", { precision: 14, scale: 6 }),
    completionCost: numeric("completion_cost", { precision: 14, scale: 6 }),
    chatId: text("chat_id"),
    messageId: text("message_id"),
    userId: text("user_id"),
    userEmail: text("user_email"),
    model: text("model"),
    eventCreatedAt: timestamp("event_created_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rawJson: jsonb("raw_json"),
  },
  (t) => [
    index("v0_usage_events_chat_idx").on(t.chatId),
    index("v0_usage_events_event_created_idx").on(t.eventCreatedAt),
  ],
)

export const vercelBillingCharges = pgTable(
  "vercel_billing_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceHash: text("source_hash").notNull().unique(),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    serviceName: text("service_name"),
    serviceCategory: text("service_category"),
    billedCost: numeric("billed_cost", { precision: 14, scale: 6 }),
    effectiveCost: numeric("effective_cost", { precision: 14, scale: 6 }),
    billingCurrency: text("billing_currency"),
    consumedQuantity: numeric("consumed_quantity", { precision: 20, scale: 6 }),
    consumedUnit: text("consumed_unit"),
    regionName: text("region_name"),
    vercelProjectId: text("vercel_project_id"),
    vercelProjectName: text("vercel_project_name"),
    technicalProjectId: uuid("technical_project_id").references(() => technicalProjects.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rawJson: jsonb("raw_json"),
  },
  (t) => [
    index("vercel_billing_charges_period_idx").on(t.periodStart),
    index("vercel_billing_charges_project_idx").on(t.vercelProjectId),
    index("vercel_billing_charges_tp_idx").on(t.technicalProjectId),
  ],
)

export const manualMappings = pgTable("manual_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  mappingType: text("mapping_type", { enum: ["technical_project", "v0_chat"] }).notNull(),
  sourceId: text("source_id").notNull(),
  businessCostCenterId: uuid("business_cost_center_id")
    .notNull()
    .references(() => businessCostCenters.id, { onDelete: "cascade" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source", { enum: ["vercel", "v0_usage", "v0_chats", "all"] }).notNull(),
  status: text("status", { enum: ["running", "success", "failed"] }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  rowsImported: numeric("rows_imported", { precision: 12, scale: 0 }).default("0"),
  rowsUpdated: numeric("rows_updated", { precision: 12, scale: 0 }).default("0"),
  errorMessage: text("error_message"),
})

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionTokenHash: text("session_token_hash").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
