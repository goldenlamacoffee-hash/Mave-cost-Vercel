"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { manualMappings, technicalProjects, v0Chats } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/auth"

function revalidateDashboard() {
  revalidatePath("/dashboard", "layout")
}

export async function assignProjectToCostCenter(
  technicalProjectId: string,
  businessCostCenterId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin()

    await db
      .update(technicalProjects)
      .set({
        businessCostCenterId,
        mappingConfidence: businessCostCenterId ? "manual" : "unmapped",
        updatedAt: new Date(),
      })
      .where(eq(technicalProjects.id, technicalProjectId))

    if (businessCostCenterId) {
      await db.insert(manualMappings).values({
        mappingType: "technical_project",
        sourceId: technicalProjectId,
        businessCostCenterId,
      })
    }

    revalidateDashboard()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed" }
  }
}

export async function applyChatSuggestions(
  entries: Array<{ chatRowId: string; costCenterId: string }>,
): Promise<{ ok: boolean; applied?: number; error?: string }> {
  try {
    await requireAdmin()
    if (entries.length === 0) return { ok: true, applied: 0 }

    let applied = 0
    for (const entry of entries) {
      await db
        .update(v0Chats)
        .set({ manualBusinessCostCenterId: entry.costCenterId, updatedAt: new Date() })
        .where(eq(v0Chats.id, entry.chatRowId))

      await db.insert(manualMappings).values({
        mappingType: "v0_chat",
        sourceId: entry.chatRowId,
        businessCostCenterId: entry.costCenterId,
        notes: "Applied from automatic suggestion",
      })
      applied++
    }

    revalidateDashboard()
    return { ok: true, applied }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed" }
  }
}

export async function assignChatToCostCenter(
  chatRowId: string,
  businessCostCenterId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin()

    await db
      .update(v0Chats)
      .set({ manualBusinessCostCenterId: businessCostCenterId, updatedAt: new Date() })
      .where(eq(v0Chats.id, chatRowId))

    if (businessCostCenterId) {
      await db.insert(manualMappings).values({
        mappingType: "v0_chat",
        sourceId: chatRowId,
        businessCostCenterId,
      })
    }

    revalidateDashboard()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed" }
  }
}
