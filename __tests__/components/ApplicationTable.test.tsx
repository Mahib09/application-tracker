import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import ApplicationTable from "@/components/ApplicationTable"
import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"

const app = (overrides = {}) => ({
  id: "a1", userId: "u1", company: "Acme Corp", roleTitle: "Software Engineer",
  status: applicationStatus.APPLIED, source: applicationSource.GMAIL,
  appliedAt: new Date("2024-01-15"), jobUrl: null, location: "Remote",
  notes: null, gmailMessageId: "m1", createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
})

describe("ApplicationTable", () => {
  it("renders application rows", () => {
    render(<ApplicationTable applications={[app()]} onStatusChange={async () => {}} onNotesSave={async () => {}} />)
    expect(screen.getByText("Acme Corp")).toBeInTheDocument()
  })

  it("shows empty state", () => {
    render(<ApplicationTable applications={[]} onStatusChange={async () => {}} onNotesSave={async () => {}} />)
    expect(screen.getByText(/no applications yet/i)).toBeInTheDocument()
  })

  it("filters by status", () => {
    const apps = [
      app({ id: "1", company: "Acme", status: applicationStatus.APPLIED }),
      app({ id: "2", company: "Beta Corp", status: applicationStatus.INTERVIEW }),
    ]
    render(<ApplicationTable applications={apps} onStatusChange={async () => {}} onNotesSave={async () => {}} />)
    fireEvent.change(screen.getByRole("combobox", { name: /filter/i }), {
      target: { value: applicationStatus.INTERVIEW },
    })
    expect(screen.getByText("Beta Corp")).toBeInTheDocument()
    expect(screen.queryByText("Acme")).not.toBeInTheDocument()
  })
})
