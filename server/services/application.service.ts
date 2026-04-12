import { prisma } from "../lib/prisma";
import {
  applicationStatus,
  applicationSource,
  changeTrigger,
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
  company?: string;
  roleTitle?: string;
  location?: string;
  jobUrl?: string;
  appliedAt?: Date;
  notes?: string;
  trigger?: changeTrigger;
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

  const { trigger, ...data } = patch;

  if (Object.keys(data).length === 0) {
    throw new Error("No changes");
  }

  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      userId: userId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!application) {
    throw new Error("application not found");
  }

  const statusChanged = data.status && data.status !== application.status;

  if (statusChanged) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id: application.id },
        data,
      });
      await tx.statusChange.create({
        data: {
          applicationId: application.id,
          fromStatus: application.status,
          toStatus: data.status!,
          trigger: trigger ?? changeTrigger.MANUAL,
        },
      });
      return updated;
    });
  }

  return prisma.application.update({
    where: { id: application.id },
    data,
  });
}

export async function deleteApplication(
  userId: string,
  applicationId: string,
) {
  if (!userId) {
    throw new Error("userId is required");
  }
  if (!applicationId) {
    throw new Error("applicationId is required");
  }

  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      userId: userId,
    },
    select: { id: true },
  });

  if (!application) {
    throw new Error("application not found");
  }

  await prisma.application.delete({
    where: { id: application.id },
  });

  return { deleted: true };
}

export async function getStatusHistory(applicationId: string) {
  return prisma.statusChange.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });
}
