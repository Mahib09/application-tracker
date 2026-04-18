import { auth } from "@/server/auth"
import { markFollowedUp } from "@/server/services/followup.service"
import { NextResponse } from "next/server"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    await markFollowedUp(session.user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: message === "application not found" ? 404 : 500 })
  }
}
