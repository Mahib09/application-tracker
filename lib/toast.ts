import { toast } from "sonner"

export { toast }

/**
 * Optimistic-delete style toast with an Undo action.
 * The caller has already executed the destructive action; onUndo should revert it.
 */
export function undoToast(message: string, onUndo: () => void | Promise<void>) {
  toast(message, {
    duration: 5000,
    action: {
      label: "Undo",
      onClick: () => {
        Promise.resolve(onUndo()).catch(() => toast.error("Undo failed"))
      },
    },
  })
}
