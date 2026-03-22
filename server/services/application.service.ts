import { prisma } from "../lib/prisma";
import {
  applicationStatus,
  applicationSource,
} from "@/app/generated/prisma/enums";

type CreateApplicationInput = {
  company: string;
  roleTitle: string;
  status: applicationStatus;
  source: applicationSource;
  appliedAt?: Date;
  jobUrl?: string;
  location?: string;
  notes?: string;
};

type UpdateApplicationInput = {
  status?: applicationStatus;
  notes?: string;
};

export async function createApplication(
  userId: string,
  input: CreateApplicationInput,
) {
  if (!userId) {
    throw new Error("UserId is required");
  }
  if (!input.company || !input.roleTitle) {
    throw new Error("Company and Role Title required");
  }

  const application = await prisma.application.create({
    data: {
      userId: userId,
      company: input.company,
      roleTitle: input.roleTitle,
      status: input.status,
      source: input.source,
      appliedAt: input.appliedAt,
      jobUrl: input.jobUrl,
      location: input.location,
      notes: input.notes,
    },
  });
  return application;
}

export async function listApplications(userId: string) {
  if (!userId) {
    throw new Error("UserId is required");
  }

  const applications = await prisma.application.findMany({
    where: {
      userId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return applications;
}

export async function updateApplication(
  userId: string,
  applicationId: string,
  patch: UpdateApplicationInput,
) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!applicationId) {
    throw new Error("applicationId is required");
  }

  if (!patch.notes && !patch.status) {
    throw new Error("No changes");
  }

  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      userId: userId,
    },
    select: {
      id: true,
    },
  });

  if (application) {
    const update = await prisma.application.update({
      where: {
        id: application.id,
      },
      data: {
        ...patch,
      },
    });

    return update;
  } else {
    throw new Error("application not found");
  }
}
