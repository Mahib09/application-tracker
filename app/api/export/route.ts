import { auth } from "@/server/auth"
import { exportCsv, exportJson } from "@/server/services/export.service"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format")

  if (format === "csv") {
    const csv = await exportCsv(session.user.id)
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="applications.csv"`,
      },
    })
  }

  if (format === "json") {
    const json = await exportJson(session.user.id)
    return new Response(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="applications.json"`,
      },
    })
  }

  return NextResponse.json({ error: "format must be csv or json" }, { status: 400 })
}
