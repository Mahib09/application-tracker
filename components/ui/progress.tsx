import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressVariants = cva("h-1.5 rounded-full transition-all", {
  variants: {
    variant: {
      default: "bg-slate-300",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
      danger: "bg-red-500",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function confidenceVariant(confidence: number): "success" | "warning" | "danger" {
  if (confidence >= 0.9) return "success"
  if (confidence >= 0.7) return "warning"
  return "danger"
}

function Progress({
  value,
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof progressVariants> & { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  const resolvedVariant = variant ?? confidenceVariant(clamped / 100)

  return (
    <div
      data-slot="progress"
      className={cn("h-1.5 w-full rounded-full bg-slate-100", className)}
      {...props}
    >
      <div
        className={cn(progressVariants({ variant: resolvedVariant }))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { Progress, progressVariants, confidenceVariant }
