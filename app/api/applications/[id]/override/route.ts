import { auth } from "@/server/auth"
import { overrideClassification } from "@/server/services/application.service"
import { NextResponse } from "next/server"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id: applicationId } = await params
    const body = await req.json()
    const { status, company, roleTitle } = body

    const updated = await overrideClassification(session.user.id, applicationId, {
      status,
      company,
      roleTitle,
    })
    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const status = message === "application not found" ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
