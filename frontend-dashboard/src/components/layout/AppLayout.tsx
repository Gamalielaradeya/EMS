import { useCallback, useState } from "react"
import { Outlet } from "react-router-dom"

import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { useDashboardSummary } from "@/hooks/useDashboardSummary"
import { useSSE } from "@/hooks/useSSE"

export function AppLayout() {
  const dashboard = useDashboardSummary()
  const { refresh } = dashboard
  const [eventRevision, setEventRevision] = useState(0)
  const handleSSEEvent = useCallback(() => {
    setEventRevision((revision) => revision + 1)
    // Soft refresh keeps mounted summary content so page scroll does not jump.
    void refresh("soft")
  }, [refresh])
  const sseStatus = useSSE(handleSSEEvent)

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          hasApiError={Boolean(dashboard.error)}
          isLoading={dashboard.isLoading}
          lastUpdatedAt={dashboard.lastUpdatedAt}
          onRefresh={() => void dashboard.refresh("hard")}
          sseStatus={sseStatus}
          summary={dashboard.summary}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet context={{ ...dashboard, eventRevision, sseStatus }} />
        </main>
      </div>
    </div>
  )
}
