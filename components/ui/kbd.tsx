import { cn } from "@/lib/utils"

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 leading-none",
        className,
      )}
    >
      {children}
    </kbd>
  )
}
