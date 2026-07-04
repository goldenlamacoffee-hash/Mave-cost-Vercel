import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export type SuggestionConfidence = "high" | "medium"

export type ChatSuggestion = {
  costCenterId: string
  costCenterName: string
  confidence: SuggestionConfidence
  reason: string
}

type SeedRule = {
  /** Keywords matched against normalized title / project name / slug. */
  keywords: string[]
  /** Short ambiguous tokens matched only on word boundaries, at medium confidence. */
  weakKeywords?: string[]
  costCenterSlug: string
}

/**
 * Seeded title/slug rules. Keywords are matched case-insensitively with
 * diacritics folded (so "kování" also matches "kovani").
 */
const SEED_RULES: SeedRule[] = [
  {
    keywords: ["coffee bike", "coffee-bike", "coffeebike", "golden-lama-admin", "golden lama", "image upload for admin", "admin reports export"],
    costCenterSlug: "golden-lama-coffee-bike",
  },
  {
    keywords: ["zymbo", "monocool", "ac website"],
    costCenterSlug: "monocool-zymbo-ac",
  },
  {
    keywords: ["lmvk"],
    costCenterSlug: "lmvk-group",
  },
  {
    keywords: ["czech-b2b", "e-shop", "eshop", "b2b"],
    costCenterSlug: "czech-b2b-eshop",
  },
  {
    keywords: ["goldendigital", "golden digital"],
    costCenterSlug: "golden-digital-studio",
  },
  {
    keywords: ["nabytech", "kovani"],
    weakKeywords: ["nt"],
    costCenterSlug: "nabytech-nt-kovani",
  },
  {
    keywords: ["ashborn", "aries"],
    weakKeywords: ["label"],
    costCenterSlug: "ashborn-aries-label",
  },
  {
    keywords: ["cost control", "cost-control", "costs dash", "finops", "mave cost"],
    costCenterSlug: "internal-tools-mave-cost-control",
  },
]

/** Lowercase + fold diacritics (kování -> kovani). */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function matchesKeyword(normalizedText: string, keyword: string): boolean {
  return normalizedText.includes(normalize(keyword))
}

function matchesWeakKeyword(normalizedText: string, keyword: string): boolean {
  // Word-boundary match for short/ambiguous tokens like "nt".
  const escaped = normalize(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalizedText)
}

/** Match seeded rules against a piece of text. Returns slug + confidence. */
function matchSeedRules(text: string | null | undefined): { slug: string; confidence: SuggestionConfidence; keyword: string } | null {
  if (!text) return null
  const normalized = normalize(text)
  for (const rule of SEED_RULES) {
    for (const kw of rule.keywords) {
      if (matchesKeyword(normalized, kw)) {
        return { slug: rule.costCenterSlug, confidence: "high", keyword: kw }
      }
    }
    for (const kw of rule.weakKeywords ?? []) {
      if (matchesWeakKeyword(normalized, kw)) {
        return { slug: rule.costCenterSlug, confidence: "medium", keyword: kw }
      }
    }
  }
  return null
}

export type UnmappedChatForSuggestion = {
  id: string
  chatId: string
  title: string | null
  vercelProjectId: string | null
}

/**
 * Compute mapping suggestions for unmapped v0 chats.
 *
 * Priority:
 * 1. The chat's Vercel project (via vercelProjectId) is already mapped -> high.
 * 2. Another chat with the same vercelProjectId was manually mapped before -> high.
 * 3. Seeded keyword rules on chat title -> high (weak tokens -> medium).
 * 4. Seeded keyword rules on the linked technical project name/slug.
 */
export async function getChatMappingSuggestions(
  chats: UnmappedChatForSuggestion[],
): Promise<Map<string, ChatSuggestion>> {
  const suggestions = new Map<string, ChatSuggestion>()
  if (chats.length === 0) return suggestions

  // Cost centers by slug and id
  const ccRows = (await db.execute(
    sql`SELECT id, name, slug FROM business_cost_centers WHERE is_active = TRUE`,
  )) as unknown as Array<{ id: string; name: string; slug: string }>
  const ccBySlug = new Map(ccRows.map((c) => [c.slug, c]))
  const ccById = new Map(ccRows.map((c) => [c.id, c]))

  // Mapped technical projects keyed by external project id (for vercelProjectId lookups)
  const projRows = (await db.execute(sql`
    SELECT external_project_id, external_project_name, external_project_slug, business_cost_center_id
    FROM technical_projects
  `)) as unknown as Array<{
    external_project_id: string | null
    external_project_name: string | null
    external_project_slug: string | null
    business_cost_center_id: string | null
  }>
  const projByExternalId = new Map(
    projRows.filter((p) => p.external_project_id).map((p) => [p.external_project_id as string, p]),
  )

  // Previous manual chat mappings grouped by vercel project id (most recent wins)
  const prevRows = (await db.execute(sql`
    SELECT DISTINCT ON (c.vercel_project_id)
      c.vercel_project_id, c.manual_business_cost_center_id
    FROM v0_chats c
    WHERE c.vercel_project_id IS NOT NULL AND c.manual_business_cost_center_id IS NOT NULL
    ORDER BY c.vercel_project_id, c.updated_at DESC
  `)) as unknown as Array<{ vercel_project_id: string; manual_business_cost_center_id: string }>
  const prevByProjectId = new Map(prevRows.map((r) => [r.vercel_project_id, r.manual_business_cost_center_id]))

  for (const chat of chats) {
    // 1. Vercel project already mapped to a cost center
    if (chat.vercelProjectId) {
      const proj = projByExternalId.get(chat.vercelProjectId)
      if (proj?.business_cost_center_id) {
        const cc = ccById.get(proj.business_cost_center_id)
        if (cc) {
          suggestions.set(chat.id, {
            costCenterId: cc.id,
            costCenterName: cc.name,
            confidence: "high",
            reason: `Project "${proj.external_project_name ?? chat.vercelProjectId}" is mapped here`,
          })
          continue
        }
      }

      // 2. Previous manual mapping of another chat in the same project
      const prevCcId = prevByProjectId.get(chat.vercelProjectId)
      if (prevCcId) {
        const cc = ccById.get(prevCcId)
        if (cc) {
          suggestions.set(chat.id, {
            costCenterId: cc.id,
            costCenterName: cc.name,
            confidence: "high",
            reason: "Other chats in this project were mapped here",
          })
          continue
        }
      }
    }

    // 3. Seeded rules on chat title
    const titleMatch = matchSeedRules(chat.title)
    if (titleMatch) {
      const cc = ccBySlug.get(titleMatch.slug)
      if (cc) {
        suggestions.set(chat.id, {
          costCenterId: cc.id,
          costCenterName: cc.name,
          confidence: titleMatch.confidence,
          reason: `Title matches "${titleMatch.keyword}"`,
        })
        continue
      }
    }

    // 4. Seeded rules on linked technical project name / slug
    if (chat.vercelProjectId) {
      const proj = projByExternalId.get(chat.vercelProjectId)
      const projMatch =
        matchSeedRules(proj?.external_project_name) ?? matchSeedRules(proj?.external_project_slug)
      if (projMatch) {
        const cc = ccBySlug.get(projMatch.slug)
        if (cc) {
          suggestions.set(chat.id, {
            costCenterId: cc.id,
            costCenterName: cc.name,
            confidence: projMatch.confidence,
            reason: `Project name matches "${projMatch.keyword}"`,
          })
        }
      }
    }
  }

  return suggestions
}
