import { auth } from "@/server/auth"
import { listPendingFollowUps } from "@/server/services/followup.service"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await listPendingFollowUps(session.user.id)
  return NextResponse.json(items)
}
