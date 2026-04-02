import { auth } from "@/server/auth"
import { fullResync } from "@/server/services/sync.service"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const result = await fullResync(session.user.id)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
