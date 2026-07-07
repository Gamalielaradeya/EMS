import { useCallback, useEffect, useState } from "react"

import { ApiError, api } from "@/lib/api"
import { createDarkFloorplanFile } from "@/lib/imageProcessing"
import type { ActiveLayout, Sensor, SensorCode, SensorReading } from "@/types/api"

export function useLayoutWorkspace(eventRevision = 0) {
  const [layout, setLayout] = useState<ActiveLayout | null>(null)
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [latestReadings, setLatestReadings] = useState<Partial<Record<SensorCode, SensorReading>>>({})
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [layoutData, sensorData, readingData] = await Promise.all([
        api.getLayout(),
        api.getSensors(),
        api.getLatestReadings(),
      ])
      setLayout(layoutData)
      setSensors(sensorData)
      setLatestReadings(readingData)
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Layout workspace could not be loaded.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void refresh())
  }, [eventRevision, refresh])

  const run = useCallback(async (action: () => Promise<ActiveLayout | null>, successMessage: string) => {
    setIsSaving(true)
    setMessage(null)
    try {
      setLayout(await action())
      setError(null)
      setMessage(successMessage)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Protected layout action failed.")
    } finally {
      setIsSaving(false)
    }
  }, [])

  const upload = useCallback(async (image: File, name: string, invertToDark: boolean) => {
    await run(async () => {
      const floorplan = invertToDark ? await createDarkFloorplanFile(image) : image
      await api.uploadLayout(floorplan, name)
      return api.getLayout()
    }, invertToDark
      ? "Layout image uploaded with literal invert dark copy. Place S1 and S2 markers on the map."
      : "Layout image uploaded as-is. Place S1 and S2 markers on the map.")
  }, [run])

  const saveMarker = useCallback(async (sensorCode: SensorCode, positionX: number, positionY: number) => {
    await run(
      () => api.updateLayoutDevice(sensorCode, {
        label: `${sensorCode} ${sensorCode === "S1" ? "Ambient" : "Hotspot"}`,
        position_x: positionX,
        position_y: positionY,
      }),
      `${sensorCode} marker position saved.`,
    )
  }, [run])

  const removeMarker = useCallback(async (sensorCode: SensorCode) => {
    await run(() => api.deleteLayoutDevice(sensorCode), `${sensorCode} marker removed.`)
  }, [run])

  return { layout, sensors, latestReadings, error, message, isLoading, isSaving, refresh, upload, saveMarker, removeMarker }
}
