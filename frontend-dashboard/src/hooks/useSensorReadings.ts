import { useCallback, useEffect, useState } from "react"

import { ApiError, api } from "@/lib/api"
import type {
  ActiveLayout,
  ReadingHistoryFilters,
  ReadingHistoryMeta,
  Sensor,
  SensorReading,
  SensorUpdateInput,
} from "@/types/api"

const emptyMeta: ReadingHistoryMeta = { total: 0, limit: 0, offset: 0 }

export function useSensorReadings(filters: ReadingHistoryFilters, eventRevision = 0) {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [latestReadings, setLatestReadings] = useState<
    Partial<Record<"S1" | "S2", SensorReading>>
  >({})
  const [history, setHistory] = useState<SensorReading[]>([])
  const [activeLayout, setActiveLayout] = useState<ActiveLayout | null>(null)
  const [meta, setMeta] = useState<ReadingHistoryMeta>(emptyMeta)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [nextSensors, nextLatestReadings, nextHistory, nextLayout] =
        await fetchSensorReadings(filters)
      setSensors(nextSensors)
      setLatestReadings(nextLatestReadings)
      setHistory(nextHistory.readings)
      setMeta(nextHistory.meta)
      setActiveLayout(nextLayout)
      setError(null)
    } catch (requestError) {
      setError(sensorReadingsError(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  const updateSensor = useCallback(async (sensorCode: string, input: SensorUpdateInput) => {
    setIsSaving(true)
    setMessage(null)
    try {
      const updated = await api.updateSensor(sensorCode, input)
      setSensors((current) =>
        current.map((sensor) => (sensor.sensor_code === updated.sensor_code ? updated : sensor)),
      )
      setError(null)
      setMessage(`${updated.sensor_code} metadata saved.`)
      return updated
    } catch (requestError) {
      const nextError =
        requestError instanceof ApiError ? requestError.message : "Sensor update failed."
      setError(nextError)
      throw requestError
    } finally {
      setIsSaving(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    void fetchSensorReadings(filters)
      .then(([nextSensors, nextLatestReadings, nextHistory, nextLayout]) => {
        if (!active) return
        setSensors(nextSensors)
        setLatestReadings(nextLatestReadings)
        setHistory(nextHistory.readings)
        setMeta(nextHistory.meta)
        setActiveLayout(nextLayout)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (active) setError(sensorReadingsError(requestError))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [eventRevision, filters])

  return {
    sensors,
    latestReadings,
    history,
    activeLayout,
    meta,
    error,
    message,
    isLoading,
    isSaving,
    refresh,
    updateSensor,
  }
}

async function fetchSensorReadings(filters: ReadingHistoryFilters) {
  return Promise.all([
    api.getSensors(),
    api.getLatestReadings(),
    api.getReadingHistory(filters),
    api.getLayout(),
  ])
}

function sensorReadingsError(requestError: unknown) {
  return requestError instanceof ApiError
    ? requestError.message
    : "Sensor readings could not be loaded."
}
