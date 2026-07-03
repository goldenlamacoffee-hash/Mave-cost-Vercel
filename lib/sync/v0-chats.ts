import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { v0Chats } from "@/lib/db/schema"
import { findTechnicalProject, upsertTechnicalProject, type SyncResult } from "./shared"

const V0_API = "https://api.v0.dev/v1"

type V0Chat = {
  id: string
  name?: string
  title?: string
  webUrl?: string
  projectId?: string
  vercelProjectId?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

type ChatsResponse = {
  object: string
  data: V0Chat[]
}

type V0Project = {
  id: string
  name?: string
  vercelProjectId?: string
  [key: string]: unknown
}

/**
 * Sync all v0 chats and map them to technical projects.
 * Mapping priority (automatic part): vercelProjectId match, then
 * v0 projectId match, then project name/slug match.
 */
export async function syncV0Chats(): Promise<SyncResult> {
  const apiKey = process.env.V0_API_KEY
  if (!apiKey) throw new Error("V0_API_KEY is not set")

  const headers = { Authorization: `Bearer ${apiKey}` }

  // Fetch v0 projects to register them as technical projects
  const projectsById = new Map<string, V0Project>()
  try {
    const projectsResponse = await fetch(`${V0_API}/projects`, { headers, cache: "no-store" })
    if (projectsResponse.ok) {
      const json = (await projectsResponse.json()) as { data?: V0Project[] }
      for (const project of json.data ?? []) {
        projectsById.set(project.id, project)
        await upsertTechnicalProject({
          provider: "v0",
          externalProjectId: project.id,
          externalProjectName: project.name ?? project.id,
        })
      }
    }
  } catch {
    // Projects are optional enrichment; chat sync continues without them.
  }

  let imported = 0
  let updated = 0
  let offset = 0
  const limit = 60
  const maxPages = 100

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${V0_API}/chats`)
    url.searchParams.set("limit", String(limit))
    url.searchParams.set("offset", String(offset))

    const response = await fetch(url.toString(), { headers, cache: "no-store" })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(
        `v0 chats API returned ${response.status}: ${body.slice(0, 300) || response.statusText}`,
      )
    }

    const json = (await response.json()) as ChatsResponse
    const chats = json.data ?? []
    if (chats.length === 0) break

    for (const chat of chats) {
      // Resolve technical project mapping
      let technicalProjectId: string | null = null

      if (chat.vercelProjectId) {
        const tp = await findTechnicalProject({ externalProjectId: chat.vercelProjectId })
        if (tp) technicalProjectId = tp.id
      }

      if (!technicalProjectId && chat.projectId) {
        const v0Project = projectsById.get(chat.projectId)
        const tp = await findTechnicalProject({
          externalProjectId: chat.projectId,
          nameOrSlug: v0Project?.name,
        })
        if (tp) technicalProjectId = tp.id
      }

      const existing = await db
        .select({ id: v0Chats.id, manualBcc: v0Chats.manualBusinessCostCenterId })
        .from(v0Chats)
        .where(eq(v0Chats.chatId, chat.id))
        .limit(1)

      const values = {
        title: chat.name ?? chat.title ?? null,
        webUrl: chat.webUrl ?? null,
        vercelProjectId: chat.vercelProjectId ?? null,
        technicalProjectId,
        updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : new Date(),
        rawJson: chat as Record<string, unknown>,
      }

      if (existing[0]) {
        // Never overwrite manual cost center assignment
        await db.update(v0Chats).set(values).where(eq(v0Chats.id, existing[0].id))
        updated++
      } else {
        await db.insert(v0Chats).values({
          chatId: chat.id,
          ...values,
          createdAt: chat.createdAt ? new Date(chat.createdAt) : new Date(),
        })
        imported++
      }
    }

    if (chats.length < limit) break
    offset += limit
  }

  return { rowsImported: imported, rowsUpdated: updated }
}
