"use client"
import { useCallback, useRef } from "react"
import { toast } from "sonner"

interface Options {
  message: string
  timeoutMs?: number
  /** Called after the undo window elapses (commit the action). */
  onCommit: () => void | Promise<void>
  /** Called if the user hits Undo (revert optimistic state). */
  onUndo: () => void
}

/**
 * Delayed-execution undo: the destructive action is deferred until the toast
 * times out. Hitting Undo cancels it entirely. Callers should apply an
 * optimistic UI change (e.g. hide a row) synchronously before calling run().
 */
export function useUndoAction() {
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const run = useCallback((key: string, opts: Options) => {
    const timeout = opts.timeoutMs ?? 5000
    const existing = pending.current.get(key)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      pending.current.delete(key)
      Promise.resolve(opts.onCommit()).catch(() => toast.error("Action failed"))
    }, timeout)
    pending.current.set(key, timer)

    toast(opts.message, {
      duration: timeout,
      action: {
        label: "Undo",
        onClick: () => {
          const t = pending.current.get(key)
          if (t) {
            clearTimeout(t)
            pending.current.delete(key)
          }
          opts.onUndo()
        },
      },
    })
  }, [])

  return { run }
}
