import { useCallback, useEffect, useState } from "react"

import { ApiError, api } from "@/lib/api"
import type { DashboardSummary } from "@/types/api"

export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const refresh = useCallback(async (mode: "hard" | "soft" = "hard") => {
    // Keep existing summary mounted during SSE soft refresh to avoid layout jumps.
    if (mode === "hard") {
      setIsLoading(true)
    }
    try {
      const data = await api.getDashboardSummary()
      setSummary(data)
      setError(null)
      setLastUpdatedAt(new Date())
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Dashboard summary could not be loaded.",
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    void api
      .getDashboardSummary()
      .then((data) => {
        if (!active) return
        setSummary(data)
        setError(null)
        setLastUpdatedAt(new Date())
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Dashboard summary could not be loaded.",
        )
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { summary, error, isLoading, lastUpdatedAt, refresh }
}
