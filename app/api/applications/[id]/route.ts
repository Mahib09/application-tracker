import { updateApplication } from "@/server/services/application.service";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const applicationId = params.id;
    const body = await req.json();
    const { userId, ...patch } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const application = await updateApplication(userId, applicationId, patch);
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown ERROR",
      },
      { status: 500 },
    );
  }
}
