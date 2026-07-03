import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env.development.local" })
config({ path: ".env.local" })
config()

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL!,
  },
})
