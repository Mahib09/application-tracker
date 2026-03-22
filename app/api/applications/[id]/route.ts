import { auth } from "@/auth"
import { updateApplication } from "@/server/services/application.service"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { id: applicationId } = await params
    const patch = await req.json()
    const application = await updateApplication(session.user.id, applicationId, patch)
    return NextResponse.json(application, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
