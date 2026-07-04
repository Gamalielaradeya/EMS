import { useOutletContext } from "react-router-dom"

import { useDashboardSummary } from "@/hooks/useDashboardSummary"
import type { SSEConnectionStatus } from "@/lib/sse"

export interface DashboardOutletContext extends ReturnType<typeof useDashboardSummary> {
  eventRevision: number
  sseStatus: SSEConnectionStatus
}

export function useDashboardContext() {
  return useOutletContext<DashboardOutletContext>()
}
