import { config } from "dotenv"
config({ path: ".env.development.local" })
config({ path: ".env.local" })
config()

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { eq } from "drizzle-orm"
import { businessCostCenters, technicalProjects } from "../lib/db/schema"

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
if (!connectionString) throw new Error("DATABASE_URL (or POSTGRES_URL) is not set")

const client = postgres(connectionString, { prepare: false, max: 1 })
const db = drizzle(client)

const COST_CENTERS = [
  { name: "Golden Lama / Coffee Bike", slug: "golden-lama-coffee-bike" },
  { name: "Golden Digital Studio", slug: "golden-digital-studio" },
  { name: "MonoCool / Zymbo AC", slug: "monocool-zymbo-ac" },
  { name: "LMVK Group", slug: "lmvk-group" },
  { name: "Czech B2B / E-shop", slug: "czech-b2b-eshop" },
  { name: "Unassigned / Draft", slug: "unassigned-draft" },
]

const PROJECT_MAPPING: Record<string, string> = {
  "v0-coffee-bike-website": "golden-lama-coffee-bike",
  "rork-coffeebike-app-546": "golden-lama-coffee-bike",
  "golden-lama-admin": "golden-lama-coffee-bike",
  "golden-digital-studio-website": "golden-digital-studio",
  "v0-zymbo-ac-website": "monocool-zymbo-ac",
  "lmvk-group-website": "lmvk-group",
  "czech-b2b-website-development": "czech-b2b-eshop",
  "b2b-e-shop": "czech-b2b-eshop",
  Draft: "unassigned-draft",
}

async function main() {
  console.log("Seeding business cost centers...")
  for (const cc of COST_CENTERS) {
    await db
      .insert(businessCostCenters)
      .values(cc)
      .onConflictDoNothing({ target: businessCostCenters.slug })
  }

  const centers = await db.select().from(businessCostCenters)
  const bySlug = new Map(centers.map((c) => [c.slug, c.id]))

  console.log("Seeding technical project mappings...")
  for (const [projectName, ccSlug] of Object.entries(PROJECT_MAPPING)) {
    const bccId = bySlug.get(ccSlug)
    if (!bccId) continue
    const existing = await db
      .select({ id: technicalProjects.id })
      .from(technicalProjects)
      .where(eq(technicalProjects.externalProjectName, projectName))
      .limit(1)
    if (existing.length === 0) {
      await db.insert(technicalProjects).values({
        provider: "manual",
        externalProjectName: projectName,
        externalProjectSlug: projectName,
        businessCostCenterId: bccId,
        mappingConfidence: "seed",
      })
    }
  }

  console.log("Seed complete. No fake usage/cost data was created.")
  await client.end()
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
