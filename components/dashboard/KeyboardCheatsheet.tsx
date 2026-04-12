"use client"
import { Kbd } from "@/components/ui/kbd"

interface Props {
  open: boolean
  onClose: () => void
}

const SECTIONS: { heading: string; items: { keys: string[]; label: string }[] }[] = [
  {
    heading: "General",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["?"], label: "Show this cheatsheet" },
      { keys: ["Esc"], label: "Close palette / sidebar" },
      { keys: ["T"], label: "Table view" },
      { keys: ["G"], label: "Kanban view" },
    ],
  },
  {
    heading: "Navigation",
    items: [
      { keys: ["J"], label: "Next application" },
      { keys: ["K"], label: "Previous application" },
      { keys: ["Enter"], label: "Open focused application" },
    ],
  },
  {
    heading: "Selected application",
    items: [
      { keys: ["1"], label: "Set status → Applied" },
      { keys: ["2"], label: "Set status → Interview" },
      { keys: ["3"], label: "Set status → Offer" },
      { keys: ["4"], label: "Set status → Rejected" },
      { keys: ["5"], label: "Set status → Ghosted" },
      { keys: ["D"], label: "Delete" },
    ],
  },
]

export default function KeyboardCheatsheet({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Esc
          </button>
        </div>
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {section.heading}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between text-sm text-foreground"
                  >
                    <span>{item.label}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
