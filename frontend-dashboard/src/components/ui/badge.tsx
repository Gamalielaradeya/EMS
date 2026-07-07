import { cva, type VariantProps } from "class-variance-authority"
import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em]",
  {
    variants: {
      variant: {
        normal: "border-success bg-success-soft text-success",
        warning: "border-warning bg-warning-soft text-warning",
        danger: "border-danger bg-danger-soft text-danger",
        trouble: "border-trouble bg-trouble-soft text-trouble",
        alarm: "border-transparent bg-danger text-destructive-foreground",
        preAlarm: "border-transparent bg-primary-hover text-destructive-foreground",
        troubleStrong: "border-transparent bg-[var(--color-trouble)] text-[var(--color-danger-ink)]",
        inactive: "border-border bg-neutral-soft text-muted-foreground",
        info: "border-border bg-accent text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "inactive",
    },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
