"use client"

import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

type ToastVariant = "default" | "success" | "error"

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, "id">) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Falls back to no-ops when used outside ToastProvider (e.g. tests)
const noop: ToastContextValue = { toast: () => {}, dismiss: () => {} }

export function useToast() {
  return useContext(ToastContext) ?? noop
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<Toast, "id">) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...opts, id }])
    const duration = opts.duration ?? 4000
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const variantStyles: Record<ToastVariant, string> = {
    default: "bg-white text-slate-900 border-slate-200",
    success: "bg-white text-emerald-700 border-emerald-200",
    error: "bg-white text-red-700 border-red-200",
  }

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {mounted && createPortal(
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg text-sm animate-in slide-in-from-bottom-2 fade-in-0 duration-200",
                variantStyles[t.variant],
              )}
            >
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                  className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
