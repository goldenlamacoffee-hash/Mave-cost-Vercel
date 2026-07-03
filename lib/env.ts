import "server-only"

export const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "VERCEL_API_TOKEN",
  "VERCEL_TEAM_ID",
  "V0_API_KEY",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "CRON_SECRET",
] as const

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number]

/**
 * DATABASE_URL falls back to the Supabase-provided POSTGRES_URL so the
 * dashboard works out of the box with the Supabase integration.
 */
export function isEnvSet(name: RequiredEnvVar): boolean {
  if (name === "DATABASE_URL") {
    return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)
  }
  return Boolean(process.env[name])
}

export function getEnvStatus(): { name: RequiredEnvVar; set: boolean }[] {
  return REQUIRED_ENV_VARS.map((name) => ({ name, set: isEnvSet(name) }))
}

export function getMissingEnvVars(): RequiredEnvVar[] {
  return REQUIRED_ENV_VARS.filter((name) => !isEnvSet(name))
}
