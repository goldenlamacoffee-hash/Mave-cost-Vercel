import type { NextRequest } from "next/server"
import { handleSyncRequest } from "../route-helpers"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  return handleSyncRequest(request, "vercel")
}
