"use server"

import { redirect } from "next/navigation"
import { createSession, destroySession, verifyCredentials } from "@/lib/auth"

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    return { error: "ADMIN_EMAIL and ADMIN_PASSWORD environment variables are not configured." }
  }

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  if (!verifyCredentials(email, password)) {
    return { error: "Invalid email or password." }
  }

  await createSession(email.trim().toLowerCase())
  redirect("/dashboard")
}

export async function logoutAction(): Promise<void> {
  await destroySession()
  redirect("/login")
}
