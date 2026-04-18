import { auth } from "@/server/auth"
import { draftFollowUp } from "@/server/services/followup.service"
import { NextResponse } from "next/server"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const result = await draftFollowUp(session.user.id, id)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: message === "application not found" ? 404 : 500 })
  }
}
