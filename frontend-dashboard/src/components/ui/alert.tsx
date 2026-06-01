import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn("rounded-md border border-border bg-danger-soft p-4 text-danger", className)}
      {...props}
    />
  )
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-sm font-bold", className)} {...props} />
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm leading-6", className)} {...props} />
}
