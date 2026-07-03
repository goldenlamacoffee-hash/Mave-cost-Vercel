import "server-only"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error("DATABASE_URL (or POSTGRES_URL) is not set")
}

declare global {
  // eslint-disable-next-line no-var
  var __mccSql: ReturnType<typeof postgres> | undefined
}

// Supabase pooler (transaction mode) requires prepare: false
const client = globalThis.__mccSql ?? postgres(connectionString, { prepare: false, max: 5 })
if (process.env.NODE_ENV !== "production") globalThis.__mccSql = client

export const db = drizzle(client, { schema })
export { schema }
