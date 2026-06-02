import { useCallback, useEffect, useState } from "react"

import { ApiError, api } from "@/lib/api"
import type { NotificationLog, Setting } from "@/types/api"

export function useSettingsWorkspace() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      setSettings(await api.getSettings())
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Settings could not be loaded.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void refresh())
  }, [refresh])

  const run = useCallback(async (action: () => Promise<unknown>, successMessage: string) => {
    setIsSaving(true)
    setMessage(null)
    try {
      await action()
      setSettings(await api.getSettings())
      setError(null)
      setMessage(successMessage)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Protected settings action failed.")
    } finally {
      setIsSaving(false)
    }
  }, [])

  const saveThresholds = useCallback(async (normalMax: string, anomalyMin: string, timeoutMinutes: string) => {
    const currentAnomaly = Number(settings.find((setting) => setting.key === "threshold_anomaly_min")?.value)
    await run(async () => {
      if (Number(normalMax) >= currentAnomaly) {
        await api.updateSetting("threshold_anomaly_min", anomalyMin)
        await api.updateSetting("threshold_normal_max", normalMax)
      } else {
        await api.updateSetting("threshold_normal_max", normalMax)
        await api.updateSetting("threshold_anomaly_min", anomalyMin)
      }
      await api.updateSetting("sensor_timeout_minutes", timeoutMinutes)
    }, "Thermal thresholds saved.")
  }, [run, settings])

  const saveTelegram = useCallback(async (enabled: boolean, cooldown: string, botToken: string, chatID: string) => {
    await run(async () => {
      await api.updateSetting("telegram_enabled", String(enabled))
      await api.updateSetting("telegram_cooldown_minutes", cooldown)
      if (botToken.trim()) await api.updateSetting("telegram_bot_token", botToken.trim())
      if (chatID.trim()) await api.updateSetting("telegram_chat_id", chatID.trim())
    }, "Telegram settings saved. Blank sensitive fields kept their stored values.")
  }, [run])

  const testNotification = useCallback(async () => {
    let notification: NotificationLog | null = null
    await run(async () => {
      notification = await api.testNotification()
    }, "Telegram test processed.")
    return notification
  }, [run])

  return { settings, error, message, isLoading, isSaving, refresh, saveThresholds, saveTelegram, testNotification }
}
