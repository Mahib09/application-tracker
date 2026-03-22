import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const latestUser = await prisma.user.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, createdAt: true },
    });

    return NextResponse.json({
      ok: true,
      userCount,
      latestUser,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
