import { useCallback, useEffect, useState } from "react"

import { ApiError, api } from "@/lib/api"
import type { NotificationLog, Setting } from "@/types/api"

/** Editable settings collected from the page form, saved as one unit. */
export interface SettingsDraft {
  normalMax: string
  anomalyMin: string
  timeoutMinutes: string
  telegramEnabled: boolean
  cooldown: string
  /** Blank = keep stored secret. */
  botToken: string
  /** Blank = keep stored secret. */
  chatId: string
}

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

  const saveAll = useCallback(async (draft: SettingsDraft) => {
    const current = new Map(settings.map((setting) => [setting.key, setting.value]))
    const changed = (key: string, value: string) => current.get(key) !== value
    const currentAnomaly = Number(current.get("threshold_anomaly_min"))

    await run(async () => {
      // Write thresholds in an order that never trips the backend's
      // normal_max < anomaly_min invariant during the intermediate state.
      if (changed("threshold_normal_max", draft.normalMax) || changed("threshold_anomaly_min", draft.anomalyMin)) {
        if (Number(draft.normalMax) >= currentAnomaly) {
          await api.updateSetting("threshold_anomaly_min", draft.anomalyMin)
          await api.updateSetting("threshold_normal_max", draft.normalMax)
        } else {
          await api.updateSetting("threshold_normal_max", draft.normalMax)
          await api.updateSetting("threshold_anomaly_min", draft.anomalyMin)
        }
      }
      if (changed("sensor_timeout_minutes", draft.timeoutMinutes)) {
        await api.updateSetting("sensor_timeout_minutes", draft.timeoutMinutes)
      }
      if (changed("telegram_enabled", String(draft.telegramEnabled))) {
        await api.updateSetting("telegram_enabled", String(draft.telegramEnabled))
      }
      if (changed("telegram_cooldown_minutes", draft.cooldown)) {
        await api.updateSetting("telegram_cooldown_minutes", draft.cooldown)
      }
      // Secrets: only push when the user typed a replacement. Blank keeps the stored value.
      if (draft.botToken.trim()) await api.updateSetting("telegram_bot_token", draft.botToken.trim())
      if (draft.chatId.trim()) await api.updateSetting("telegram_chat_id", draft.chatId.trim())
    }, "Settings saved. Blank sensitive fields kept their stored values.")
  }, [run, settings])

  const testNotification = useCallback(async () => {
    let notification: NotificationLog | null = null
    await run(async () => {
      notification = await api.testNotification()
    }, "Telegram test processed.")
    return notification
  }, [run])

  return { settings, error, message, isLoading, isSaving, refresh, saveThresholds, saveTelegram, saveAll, testNotification }
}
