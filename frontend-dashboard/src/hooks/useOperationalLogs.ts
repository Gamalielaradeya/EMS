import { useCallback, useEffect, useState } from "react"

import { ApiError, api } from "@/lib/api"
import type { AnomalyEvent, NotificationLog, OperationalLogFilters, SystemLog } from "@/types/api"

export type OperationalTab = "anomalies" | "notifications" | "system"

export function useOperationalLogs(tab: OperationalTab, filters: OperationalLogFilters, eventRevision: number) {
  const [items, setItems] = useState<Array<AnomalyEvent | NotificationLog | SystemLog>>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setItems([])
    setTotal(0)
    try {
      const result = tab === "anomalies"
        ? await api.getAnomalyEvents(filters)
        : tab === "notifications"
          ? await api.getNotificationLogs(filters)
          : await api.getSystemLogs(filters)
      setItems(result.items)
      setTotal(result.meta.total)
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Operational records could not be loaded.")
    } finally {
      setIsLoading(false)
    }
  }, [filters, tab])

  useEffect(() => {
    queueMicrotask(() => void refresh())
  }, [eventRevision, refresh])

  return { items, total, error, isLoading, refresh }
}
