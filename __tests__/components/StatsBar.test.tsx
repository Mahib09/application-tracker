import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import StatsBar from "@/components/StatsBar"
import { applicationStatus } from "@/app/generated/prisma/enums"

const app = (status: applicationStatus) => ({
  id: Math.random().toString(), status, company: "Acme", roleTitle: "SWE",
  source: "GMAIL" as any, userId: "u1", createdAt: new Date(), updatedAt: new Date(),
  appliedAt: null, jobUrl: null, location: null, notes: null, gmailMessageId: null,
})

describe("StatsBar", () => {
  it("shows total count", () => {
    render(<StatsBar applications={[app(applicationStatus.APPLIED), app(applicationStatus.INTERVIEW)]} />)
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("shows per-status count via data-testid", () => {
    render(<StatsBar applications={[app(applicationStatus.APPLIED), app(applicationStatus.APPLIED), app(applicationStatus.OFFER)]} />)
    expect(screen.getByTestId("stat-APPLIED")).toHaveTextContent("2")
    expect(screen.getByTestId("stat-OFFER")).toHaveTextContent("1")
  })

  it("renders with empty array without crashing", () => {
    render(<StatsBar applications={[]} />)
    expect(screen.getAllByText("0").length).toBeGreaterThan(0)
  })
})
