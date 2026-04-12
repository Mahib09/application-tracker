"use client"
import { useEffect } from "react"
import { Command } from "cmdk"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { type Application } from "@/types/application"
import { STATUS_DISPLAY_ORDER, STATUS_CONFIG, STATUS_COLORS } from "@/lib/constants"
import { useCommandPalette } from "@/components/dashboard/CommandPaletteProvider"
import { useTheme } from "next-themes"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { LayoutList, LayoutGrid, Sun, Moon, Search } from "lucide-react"


interface Props {
  applications: Application[]
  selectedId: string | null
  onSelectApp: (id: string) => void
  onStatusChange: (id: string, prev: applicationStatus, next: applicationStatus) => Promise<void>
}

export default function CommandPalette({
  applications,
  selectedId,
  onSelectApp,
  onStatusChange,
}: Props) {
  const { isOpen, close } = useCommandPalette()
  const { setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedApp = applications.find((a) => a.id === selectedId) ?? null

  const setView = (view: "table" | "kanban") => {
    const params = new URLSearchParams(searchParams.toString())
    if (view === "kanban") params.set("view", "kanban")
    else params.delete("view")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  useEffect(() => {
    if (!isOpen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [isOpen, close])

  if (!isOpen) return null

  const runAndClose = (fn: () => void | Promise<void>) => {
    Promise.resolve(fn()).finally(close)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command palette" className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Search applications or run a command..."
              className="flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results.
            </Command.Empty>

            <Command.Group
              heading="Applications"
              className="text-[11px] font-medium text-muted-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5"
            >
              {applications.slice(0, 20).map((app) => (
                <Command.Item
                  key={app.id}
                  value={`${app.company} ${app.roleTitle}`}
                  onSelect={() => runAndClose(() => onSelectApp(app.id))}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground data-[selected=true]:bg-muted"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[app.status] }}
                  />
                  <span className="truncate font-medium">{app.company}</span>
                  <span className="truncate text-xs text-muted-foreground">{app.roleTitle}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Navigation"
              className="text-[11px] font-medium text-muted-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5"
            >
              <Command.Item
                onSelect={() => runAndClose(() => setView("table"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[selected=true]:bg-muted"
              >
                <LayoutList className="size-4" /> Table view
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => setView("kanban"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[selected=true]:bg-muted"
              >
                <LayoutGrid className="size-4" /> Kanban view
              </Command.Item>
            </Command.Group>

            <Command.Group
              heading="Actions"
              className="text-[11px] font-medium text-muted-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5"
            >
              <Command.Item
                onSelect={() => runAndClose(() => setTheme("light"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[selected=true]:bg-muted"
              >
                <Sun className="size-4" /> Light theme
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => setTheme("dark"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[selected=true]:bg-muted"
              >
                <Moon className="size-4" /> Dark theme
              </Command.Item>
            </Command.Group>

            {selectedApp && (
              <Command.Group
                heading={`Change status — ${selectedApp.company}`}
                className="text-[11px] font-medium text-muted-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5"
              >
                {STATUS_DISPLAY_ORDER.map((s) => (
                  <Command.Item
                    key={s}
                    value={`status-${s}`}
                    onSelect={() =>
                      runAndClose(() => onStatusChange(selectedApp.id, selectedApp.status, s))
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[selected=true]:bg-muted"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[s] }}
                    />
                    {STATUS_CONFIG[s].label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
