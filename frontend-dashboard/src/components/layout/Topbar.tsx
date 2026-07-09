import { Clock3, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
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
  sseStatus,
  onRefresh,
}: TopbarProps) {
  const apiStatus = isLoading ? "checking" : hasApiError ? "disconnected" : "connected"
  const displaySseStatus = sseStatus === "connecting" ? "checking" : sseStatus
  const gatewayStatus = summary?.gateway?.status || "inactive"
  const modelStatus = summary?.active_model ? "ready" : "not-ready"

  // Live ticking clock — updates every second
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeString = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now)

  return (
    <header className="border-b bg-card px-4 py-2.5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-foreground">Environment Monitoring System</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Thermal acquisition and prediction readiness</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badges */}
          <div className="flex items-center gap-1.5">
            <StatusBadge label="API" status={apiStatus} className="self-auto" />
            <StatusBadge label="SSE" status={displaySseStatus} className="self-auto" />
            <StatusBadge label={`GW: ${gatewayStatus}`} status={gatewayStatus} className="self-auto" />
            <StatusBadge label={`Model: ${modelStatus}`} status={modelStatus} className="self-auto" />
          </div>

          {/* Live clock + refresh */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
              <Clock3 aria-hidden="true" className="size-3.5" />
              {timeString}
            </span>
            <Button aria-label="Refresh dashboard summary" onClick={onRefresh} size="icon" variant="ghost" className="size-8">
              <RefreshCw aria-hidden="true" className={isLoading ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
