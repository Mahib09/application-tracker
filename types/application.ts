import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"

export interface Application {
  id: string
  company: string
  roleTitle: string
  status: applicationStatus
  source: applicationSource
  appliedAt: Date | null
  location: string | null
  notes: string | null
  confidence: number | null
  jobUrl: string | null
  manuallyEdited: boolean
  sourceEmailId: string | null
  sourceEmailSubject: string | null
  sourceEmailSnippet: string | null
  sourceEmailReceivedAt: Date | null
  interviewDate: Date | null
  interviewUrl: string | null
  interviewer: string | null
  interviewProvider: string | null
  recruiterName: string | null
  recruiterEmail: string | null
  lastFollowUpAt: Date | null
  jobDescriptionSnapshot: string | null
  jobDescriptionFetchedAt: Date | null
}

export interface StatusChangeRecord {
  id: string
  applicationId: string
  fromStatus: applicationStatus
  toStatus: applicationStatus
  trigger: string
  eventDate: Date | null
  createdAt: Date
}
