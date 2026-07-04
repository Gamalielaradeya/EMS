import { useCallback, useEffect, useState } from "react"

import { ApiError, api } from "@/lib/api"
import type {
  ReadingHistoryFilters,
  ReadingHistoryMeta,
  SensorReading,
} from "@/types/api"

const emptyMeta: ReadingHistoryMeta = { total: 0, limit: 0, offset: 0 }

export function useReadingHistory(filters: ReadingHistoryFilters, eventRevision = 0) {
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [meta, setMeta] = useState<ReadingHistoryMeta>(emptyMeta)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await api.getReadingHistory(filters)
      setReadings(result.readings)
      setMeta(result.meta)
      setError(null)
    } catch (requestError) {
      setError(readingsError(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    let active = true

    void api
      .getReadingHistory(filters)
      .then((result) => {
        if (!active) return
        setReadings(result.readings)
        setMeta(result.meta)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (active) setError(readingsError(requestError))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [eventRevision, filters])

  return { readings, meta, error, isLoading, refresh }
}

function readingsError(requestError: unknown) {
  return requestError instanceof ApiError
    ? requestError.message
    : "Sensor history could not be loaded."
}
