import {
  createApplication,
  listApplications,
} from "@/server/services/application.service";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "userId is Required" },
        { status: 400 },
      );
    }

    const application = await listApplications(userId);
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown ERROR" },
      { status: 400 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, ...input } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const application = await createApplication(userId, input);
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown Error",
      },
      { status: 400 },
    );
  }
}
