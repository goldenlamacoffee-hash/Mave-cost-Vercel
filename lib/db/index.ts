import "server-only"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Prefer the Supabase integration's pooled URL (works on serverless);
// a manually-set DATABASE_URL may be a direct connection that Vercel cannot reach.
const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("POSTGRES_URL (or DATABASE_URL) is not set")
}

declare global {
  // eslint-disable-next-line no-var
  var __mccSql: ReturnType<typeof postgres> | undefined
}

// Supabase pooler (transaction mode) requires prepare: false.
// Timeouts prevent hung connections from blocking requests indefinitely.
const client =
  globalThis.__mccSql ??
  postgres(connectionString, {
    prepare: false,
    max: 5,
    connect_timeout: 15,
    idle_timeout: 30,
    max_lifetime: 60 * 10,
  })
if (process.env.NODE_ENV !== "production") globalThis.__mccSql = client

export const db = drizzle(client, { schema })
export { schema }
