"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessCostCenters } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/auth"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export async function createCostCenter(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin()
    const name = String(formData.get("name") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim() || null
    const budgetRaw = String(formData.get("monthlyBudgetUsd") ?? "").trim()

    if (!name) return { ok: false, error: "Name is required" }
    const budget = budgetRaw ? Number(budgetRaw) : null
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      return { ok: false, error: "Budget must be a positive number" }
    }

    await db.insert(businessCostCenters).values({
      name,
      slug: slugify(name),
      description,
      monthlyBudgetUsd: budget !== null ? String(budget) : null,
    })

    revalidatePath("/dashboard", "layout")
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed"
    return { ok: false, error: message.includes("unique") ? "A cost center with this name already exists" : message }
  }
}

export async function updateCostCenter(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin()
    const name = String(formData.get("name") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim() || null
    const budgetRaw = String(formData.get("monthlyBudgetUsd") ?? "").trim()

    if (!name) return { ok: false, error: "Name is required" }
    const budget = budgetRaw ? Number(budgetRaw) : null
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      return { ok: false, error: "Budget must be a positive number" }
    }

    await db
      .update(businessCostCenters)
      .set({
        name,
        description,
        monthlyBudgetUsd: budget !== null ? String(budget) : null,
        updatedAt: new Date(),
      })
      .where(eq(businessCostCenters.id, id))

    revalidatePath("/dashboard", "layout")
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed" }
  }
}
