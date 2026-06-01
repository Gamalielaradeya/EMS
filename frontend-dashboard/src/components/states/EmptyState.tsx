import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-36 flex-col justify-center rounded-md border border-dashed bg-muted p-5">
      <Icon aria-hidden="true" className="mb-3 size-5 text-muted-foreground" />
      <p className="font-display text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 max-w-[65ch] text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}
