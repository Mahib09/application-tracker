import { auth } from "@/server/auth"
import { prisma } from "@/server/lib/prisma"
import { NextResponse } from "next/server"

export async function DELETE() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.user.delete({ where: { id: session.user.id } })
  return NextResponse.json({ ok: true })
}
