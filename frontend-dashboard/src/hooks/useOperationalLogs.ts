import { useCallback, useEffect, useRef, useState } from "react"

import { ApiError, api } from "@/lib/api"
import type { AnomalyEvent, NotificationLog, OperationalLogFilters, SystemLog } from "@/types/api"

export type OperationalTab = "anomalies" | "notifications" | "system"

type LoadMode = "hard" | "soft"

/**
 * Hard load: tab/filter change — show loading when empty and replace rows.
 * Soft load: SSE refresh — keep current rows visible so scroll position stays put.
 */
export function useOperationalLogs(tab: OperationalTab, filters: OperationalLogFilters, eventRevision: number) {
  const [items, setItems] = useState<Array<AnomalyEvent | NotificationLog | SystemLog>>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const requestIdRef = useRef(0)
  const loadRef = useRef<(mode: LoadMode) => Promise<void>>(async () => undefined)

  const load = useCallback(
    async (mode: LoadMode) => {
      const requestId = ++requestIdRef.current
      if (mode === "hard") {
        setIsLoading(true)
        setItems([])
        setTotal(0)
      }

      try {
        const result =
          tab === "anomalies"
            ? await api.getAnomalyEvents(filters)
            : tab === "notifications"
              ? await api.getNotificationLogs(filters)
              : await api.getSystemLogs(filters)

        if (requestId !== requestIdRef.current) return

        setItems(result.items)
        setTotal(result.meta.total)
        setError(null)
      } catch (requestError) {
        if (requestId !== requestIdRef.current) return
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Operational records could not be loaded.",
        )
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [filters, tab],
  )

  loadRef.current = load

  // Tab / filter changes: hard reload (content intentionally changes).
  useEffect(() => {
    void load("hard")
  }, [load])

  // SSE updates only — soft reload keeps rows mounted so scroll stays put.
  useEffect(() => {
    if (eventRevision === 0) return
    void loadRef.current("soft")
  }, [eventRevision])

  const refresh = useCallback(async () => {
    await load("hard")
  }, [load])

  return { items, total, error, isLoading, refresh }
}
