import { Clock3, RefreshCw } from "lucide-react"

import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { formatShortTime } from "@/lib/format"
import type { SSEConnectionStatus } from "@/lib/sse"
import type { DashboardSummary } from "@/types/api"

interface TopbarProps {
  summary: DashboardSummary | null
  hasApiError: boolean
  isLoading: boolean
  lastUpdatedAt: Date | null
  sseStatus: SSEConnectionStatus
  onRefresh: () => void
}

export function Topbar({
  summary,
  hasApiError,
  isLoading,
  lastUpdatedAt,
  sseStatus,
  onRefresh,
}: TopbarProps) {
  const apiStatus = isLoading ? "checking" : hasApiError ? "disconnected" : "connected"
  const displaySseStatus = sseStatus === "connecting" ? "checking" : sseStatus
  const gatewayStatus = summary?.gateway?.status || "inactive"
  const modelStatus = summary?.active_model ? "ready" : "not-ready"

  return (
    <header className="border-b bg-card px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-foreground">Environment Monitoring System</p>
          <p className="mt-1 text-xs text-muted-foreground">Thermal acquisition and prediction readiness</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge label="API" status={apiStatus} />
          <StatusBadge label="SSE" status={displaySseStatus} />
          <StatusBadge label={`Gateway: ${gatewayStatus}`} status={gatewayStatus} />
          <StatusBadge label={`Model: ${modelStatus}`} status={modelStatus} />
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {lastUpdatedAt ? formatShortTime(lastUpdatedAt.toISOString()) : "Awaiting update"}
          </span>
          <Button aria-label="Refresh dashboard summary" onClick={onRefresh} size="icon" variant="ghost">
            <RefreshCw aria-hidden="true" className={isLoading ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </div>
    </header>
  )
}
