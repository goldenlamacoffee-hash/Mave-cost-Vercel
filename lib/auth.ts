import "server-only"
import { cookies } from "next/headers"
import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { eq, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { adminSessions } from "@/lib/db/schema"

const SESSION_COOKIE = "mcc_session"
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function safeCompare(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function verifyCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) return false
  return safeCompare(email.trim().toLowerCase(), adminEmail.trim().toLowerCase()) && safeCompare(password, adminPassword)
}

export async function createSession(email: string): Promise<void> {
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await db.insert(adminSessions).values({
    sessionTokenHash: hashToken(token),
    email,
    expiresAt,
  })

  // Opportunistically clean up expired sessions
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()))

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function getSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const rows = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.sessionTokenHash, hashToken(token)))
    .limit(1)

  const session = rows[0]
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.delete(adminSessions).where(eq(adminSessions.id, session.id))
    return null
  }
  return { email: session.email }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await db.delete(adminSessions).where(eq(adminSessions.sessionTokenHash, hashToken(token)))
  }
  cookieStore.delete(SESSION_COOKIE)
}

/** Throws if not authenticated. Use in route handlers. */
export async function requireAdmin(): Promise<{ email: string }> {
  const session = await getSession()
  if (!session) throw new Error("UNAUTHORIZED")
  return session
}

export { SESSION_COOKIE }
