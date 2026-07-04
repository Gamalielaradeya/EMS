import { Circle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatStatus, getStatusVariant, type DisplayStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: DisplayStatus
  label?: string
  showDot?: boolean
  className?: string
}

export function StatusBadge({ status, label, showDot = true, className }: StatusBadgeProps) {
  return (
    <Badge className={cn("self-start", className)} variant={getStatusVariant(status)}>
      {showDot ? <Circle aria-hidden="true" className="size-2 fill-current" /> : null}
      <span>{label || formatStatus(status)}</span>
    </Badge>
  )
}
