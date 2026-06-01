import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("rounded-lg border bg-card text-card-foreground shadow-card", className)} {...props} />
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <header className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-base font-bold tracking-tight", className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />
}
