import { prisma } from "@/server/lib/prisma"

async function fetchApplications(userId: string) {
  return prisma.application.findMany({
    where: { userId },
    include: { statusChanges: true },
    orderBy: { createdAt: "desc" },
  })
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = Array.isArray(value) ? value.join("|") : String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function exportCsv(userId: string): Promise<string> {
  const apps = await fetchApplications(userId)
  const header = [
    "id", "company", "roleTitle", "status", "appliedAt", "location",
    "jobUrl", "confidence", "tags", "manuallyEdited", "source",
    "recruiterName", "recruiterEmail",
  ]
  const rows = apps.map((a) => [
    a.id, a.company, a.roleTitle, a.status,
    a.appliedAt?.toISOString() ?? "",
    a.location ?? "", a.jobUrl ?? "",
    a.confidence ?? "", a.tags.join("|"), a.manuallyEdited,
    a.source, a.recruiterName ?? "", a.recruiterEmail ?? "",
  ])
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n")
}

export async function exportJson(userId: string): Promise<string> {
  const apps = await fetchApplications(userId)
  return JSON.stringify(apps, null, 2)
}
