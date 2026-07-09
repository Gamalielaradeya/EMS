import {
  Bell,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Gauge,
  Info,
  KeyRound,
  LockKeyhole,
  LogOut,
  RotateCcw,
  Save,
  Send,
  Settings,
  Thermometer,
  Workflow,
} from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"

import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdminToken } from "@/hooks/useAdminToken"
import { type SettingsDraft, useSettingsWorkspace } from "@/hooks/useSettingsWorkspace"
import { controlClassName } from "@/lib/forms"
import type { Setting } from "@/types/api"

const EMPTY_DRAFT: SettingsDraft = {
  normalMax: "",
  anomalyMin: "",
  timeoutMinutes: "",
  telegramEnabled: false,
  cooldown: "",
  botToken: "",
  chatId: "",
}

/** Draft fields that carry a persisted value we can compare for dirtiness. */
const NON_SECRET_KEYS: (keyof SettingsDraft)[] = [
  "normalMax",
  "anomalyMin",
  "timeoutMinutes",
  "telegramEnabled",
  "cooldown",
]

export function SettingsPage() {
  const workspace = useSettingsWorkspace()
  const { hasToken, saveToken, removeToken } = useAdminToken()
  const byKey = useMemo(
    () => new Map(workspace.settings.map((setting) => [setting.key, setting])),
    [workspace.settings],
  )

  // Baseline mirrors what the backend currently holds; draft is the working copy.
  const baseline = useMemo<SettingsDraft>(
    () => ({
      normalMax: value(byKey, "threshold_normal_max"),
      anomalyMin: value(byKey, "threshold_anomaly_min"),
      timeoutMinutes: value(byKey, "sensor_timeout_minutes"),
      telegramEnabled: value(byKey, "telegram_enabled") === "true",
      cooldown: value(byKey, "telegram_cooldown_minutes"),
      botToken: "",
      chatId: "",
    }),
    [byKey],
  )

  const [draft, setDraft] = useState<SettingsDraft>(EMPTY_DRAFT)

  // Reseed the draft whenever a fresh settings snapshot arrives (load or post-save refresh).
  useEffect(() => {
    setDraft(baseline)
  }, [baseline])

  const set = <K extends keyof SettingsDraft>(key: K, val: SettingsDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }))

  const isDirty =
    NON_SECRET_KEYS.some((key) => draft[key] !== baseline[key]) ||
    draft.botToken.trim().length > 0 ||
    draft.chatId.trim().length > 0

  function revert() {
    setDraft(baseline)
  }

  async function handleSave() {
    await workspace.saveAll(draft)
    // Success refreshes settings → baseline changes → effect reseeds draft (clears secrets).
  }

  async function saveThresholds() {
    await workspace.saveThresholds(draft.normalMax, draft.anomalyMin, draft.timeoutMinutes)
  }

  async function saveTelegram() {
    await workspace.saveTelegram(draft.telegramEnabled, draft.cooldown, draft.botToken, draft.chatId)
  }

  return (
    <div className="space-y-6 pb-24">
      {workspace.error ? (
        <ErrorState message={workspace.error} onRetry={() => void workspace.refresh()} title="Settings unavailable" />
      ) : null}
      {workspace.message ? (
        <div className="rounded-md border border-border bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          {workspace.message}
        </div>
      ) : null}

      {!hasToken ? (
        <div className="flex gap-3 rounded-md border bg-warning-soft px-4 py-3 text-sm text-warning">
          <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>Admin token required to save configuration. Enter it in the Admin Access card below.</p>
        </div>
      ) : null}

      {workspace.isLoading && workspace.settings.length === 0 ? (
        <LoadingState />
      ) : (
        <div className="grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.74fr)]">
          {/* ── Editable column ─────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionLabel
              title="Editable Settings"
              description="Update configuration values used by the application."
            />

            <AdminAccessCard hasToken={hasToken} onSave={saveToken} onClear={removeToken} />

            <SettingsCard
              icon={Thermometer}
              title="Thermal Thresholds"
              description="Backend owns status classification. Normal maximum must stay below anomaly minimum."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Normal Maximum (°C)">
                  <UnitInput
                    unit="°C"
                    max="80"
                    min="0"
                    onChange={(v) => set("normalMax", v)}
                    step="0.1"
                    value={draft.normalMax}
                  />
                </Field>
                <Field label="Anomaly Minimum (°C)">
                  <UnitInput
                    unit="°C"
                    max="80"
                    min="0"
                    onChange={(v) => set("anomalyMin", v)}
                    step="0.1"
                    value={draft.anomalyMin}
                  />
                </Field>
                <Field label="Trouble Timeout (min)">
                  <UnitInput
                    unit="min"
                    min="1"
                    onChange={(v) => set("timeoutMinutes", v)}
                    step="1"
                    value={draft.timeoutMinutes}
                  />
                </Field>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Info aria-hidden="true" className="size-3.5 shrink-0" />
                These thresholds control how temperatures are classified and when trouble is triggered.
              </p>
              <div className="mt-4">
                <Button disabled={!hasToken || workspace.isSaving} onClick={() => void saveThresholds()} type="button">
                  <Save aria-hidden="true" className="size-4" />
                  Save thresholds
                </Button>
              </div>
            </SettingsCard>

            <SettingsCard
              icon={Bell}
              title="Telegram Notifications"
              description="Sensitive fields are never returned in full. Leave token or chat ID blank to preserve stored secret values."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex min-h-11 items-center gap-3 rounded-md border bg-card px-3 text-sm font-semibold">
                  <input
                    checked={draft.telegramEnabled}
                    onChange={(e) => set("telegramEnabled", e.target.checked)}
                    type="checkbox"
                  />
                  Enable Telegram notifications
                </label>
                <Field label="Cooldown (minutes)">
                  <UnitInput
                    unit="min"
                    min="0"
                    onChange={(v) => set("cooldown", v)}
                    step="1"
                    value={draft.cooldown}
                  />
                </Field>
                <SecretField
                  configured={configured(byKey, "telegram_bot_token")}
                  label="Bot Token"
                  onChange={(v) => set("botToken", v)}
                  value={draft.botToken}
                />
                <SecretField
                  configured={configured(byKey, "telegram_chat_id")}
                  label="Chat ID"
                  onChange={(v) => set("chatId", v)}
                  value={draft.chatId}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={!hasToken || workspace.isSaving} onClick={() => void saveTelegram()} type="button">
                  <Save aria-hidden="true" className="size-4" />
                  Save Telegram settings
                </Button>
                <Button
                  disabled={!hasToken || workspace.isSaving}
                  onClick={() => void workspace.testNotification()}
                  type="button"
                  variant="secondary"
                >
                  <Send aria-hidden="true" className="size-4" />
                  Test Telegram
                </Button>
              </div>
            </SettingsCard>
          </div>

          {/* ── Read-only column ────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionLabel
              title="System Information (Read-only)"
              description="Current runtime and model configuration."
            />
            <InfoCard
              icon={Workflow}
              title="Gateway & Application"
              settings={pick(byKey, [
                "active_gateway_code",
                "gateway_heartbeat_interval_seconds",
                "backend_offline_check_interval_seconds",
              ])}
            />
            <InfoCard
              icon={Gauge}
              title="ML Pipeline Parameters"
              settings={pick(byKey, [
                "raw_sampling_interval_seconds",
                "ml_resample_interval_seconds",
                "lstm_window_size",
                "prediction_horizon_minutes",
                "prediction_stale_ttl_minutes",
                "actual_temperature_match_tolerance_seconds",
              ])}
            />
          </div>
        </div>
      )}

      {/* ── Sticky save bar ───────────────────────────────────────────────── */}
      {isDirty ? (
        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-card/95 px-4 py-3 shadow-floating backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button onClick={revert} size="sm" variant="ghost">
              <RotateCcw aria-hidden="true" className="size-4" />
              Reset
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">You have unsaved changes</span>
              <Button onClick={revert} variant="secondary">
                Cancel
              </Button>
              <Button disabled={!hasToken || workspace.isSaving} onClick={() => void handleSave()}>
                {workspace.isSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Admin Access (collapsible, session-scoped) ───────────────────────────────

function AdminAccessCard({
  hasToken,
  onSave,
  onClear,
}: {
  hasToken: boolean
  onSave: (token: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(true)
  const [inputValue, setInputValue] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      setError("Token cannot be empty.")
      return
    }
    setError(null)
    onSave(trimmed)
    setInputValue("")
    setShowToken(false)
  }

  return (
    <Card>
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-5 text-left"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <IconChip icon={KeyRound} />
        <div className="min-w-0 flex-1">
          <CardTitle>Admin Access</CardTitle>
          <CardDescription>
            Enter the <strong>ADMIN_TOKEN</strong> from backend-go/.env. Stored in session only — cleared when tab closes.
          </CardDescription>
        </div>
        {open ? (
          <ChevronUp aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open ? (
        <CardContent className="border-t pt-5">
          {hasToken ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-2.5 rounded-full bg-green-500" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Token active for this session</span>
                <Badge variant="normal">Session</Badge>
              </div>
              <Button onClick={onClear} size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                <LogOut aria-hidden="true" className="size-4" />
                Clear token
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-1.5">
                <div className="relative">
                  <input
                    aria-label="Admin token"
                    autoComplete="off"
                    className={`${controlClassName} w-full pr-10`}
                    onChange={(e) => {
                      setInputValue(e.target.value)
                      setError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave()
                    }}
                    placeholder="Paste admin token…"
                    type={showToken ? "text" : "password"}
                    value={inputValue}
                  />
                  <button
                    aria-label={showToken ? "Hide token" : "Show token"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowToken((v) => !v)}
                    type="button"
                  >
                    {showToken ? (
                      <EyeOff aria-hidden="true" className="size-4" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4" />
                    )}
                  </button>
                </div>
                {error ? <p className="text-xs text-destructive">{error}</p> : null}
              </div>
              <Button disabled={!inputValue.trim()} onClick={handleSave} type="button">
                Save token
              </Button>
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  )
}

// ── Presentational helpers ───────────────────────────────────────────────────

function SectionLabel({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-display text-sm font-bold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function IconChip({ icon: Icon }: { icon: typeof Settings }) {
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
      <Icon aria-hidden="true" className="size-4" />
    </div>
  )
}

function SettingsCard({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode
  description: string
  icon: typeof Settings
  title: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <IconChip icon={icon} />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function InfoCard({
  icon: Icon,
  settings,
  title,
}: {
  icon: typeof Settings
  settings: Setting[]
  title: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Icon aria-hidden="true" className="size-5 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>Read-only locked parameters from backend settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          {settings.map((setting) => (
            <div
              className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
              key={setting.key}
            >
              <dt className="text-sm text-muted-foreground">{settingLabel(setting)}</dt>
              <dd className="text-sm font-semibold tabular-nums text-foreground">{settingValue(setting)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

function UnitInput({
  max,
  min,
  onChange,
  step,
  unit,
  value: fieldValue,
}: {
  max?: string
  min?: string
  onChange: (value: string) => void
  step?: string
  unit: string
  value: string
}) {
  return (
    <div className="flex items-stretch">
      <input
        className={`${controlClassName} w-full rounded-r-none border-r-0`}
        max={max}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        type="number"
        value={fieldValue}
      />
      <span className="inline-flex min-w-11 items-center justify-center rounded-r-md border border-l bg-muted px-3 text-xs font-semibold text-muted-foreground">
        {unit}
      </span>
    </div>
  )
}

function SecretField({
  configured: isConfigured,
  label,
  onChange,
  value: fieldValue,
}: {
  configured: boolean
  label: string
  onChange: (value: string) => void
  value: string
}) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label}>
      <div className="grid gap-2">
        <div className="relative">
          <input
            autoComplete="off"
            className={`${controlClassName} w-full pr-10`}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isConfigured ? "Leave blank to keep stored value" : "Not configured"}
            type={show ? "text" : "password"}
            value={fieldValue}
          />
          <button
            aria-label={show ? "Hide value" : "Show value"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShow((v) => !v)}
            type="button"
          >
            {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          </button>
        </div>
        <Badge variant={isConfigured ? "normal" : "inactive"}>
          {isConfigured ? "Configured" : "Not configured"}
        </Badge>
      </div>
    </Field>
  )
}

// ── Data helpers ─────────────────────────────────────────────────────────────

function value(settings: Map<string, Setting>, key: string) {
  return settings.get(key)?.value || ""
}

function configured(settings: Map<string, Setting>, key: string) {
  return value(settings, key) === "********"
}

function pick(settings: Map<string, Setting>, keys: string[]) {
  return keys.flatMap((key) => (settings.get(key) ? [settings.get(key)!] : []))
}

/** Human-readable label for a setting key, with unit suffix where known. */
const SETTING_LABELS: Record<string, string> = {
  active_gateway_code: "Active gateway code",
  gateway_heartbeat_interval_seconds: "Gateway heartbeat interval",
  backend_offline_check_interval_seconds: "Offline checker interval",
  raw_sampling_interval_seconds: "Raw sampling interval",
  ml_resample_interval_seconds: "ML resample interval",
  lstm_window_size: "LSTM window size",
  prediction_horizon_minutes: "Prediction horizon",
  prediction_stale_ttl_minutes: "Prediction stale TTL",
  actual_temperature_match_tolerance_seconds: "Actual temperature match tolerance",
  threshold_normal_max: "Normal threshold (max)",
  threshold_anomaly_min: "Anomaly threshold (min)",
  sensor_timeout_minutes: "Sensor timeout",
  telegram_enabled: "Telegram enabled",
  telegram_cooldown_minutes: "Telegram cooldown",
  telegram_bot_token: "Telegram bot token",
  telegram_chat_id: "Telegram chat ID",
}

/** Unit suffix per key — appended to the value for clarity. */
const SETTING_UNITS: Record<string, string> = {
  gateway_heartbeat_interval_seconds: " s",
  backend_offline_check_interval_seconds: " s",
  raw_sampling_interval_seconds: " s",
  ml_resample_interval_seconds: " s",
  actual_temperature_match_tolerance_seconds: " s",
  lstm_window_size: " points",
  prediction_horizon_minutes: " min",
  prediction_stale_ttl_minutes: " min",
  sensor_timeout_minutes: " min",
  telegram_cooldown_minutes: " min",
}

function settingLabel(setting: Setting): string {
  return SETTING_LABELS[setting.key] || setting.description || setting.key
}

function settingValue(setting: Setting): string {
  const unit = SETTING_UNITS[setting.key] || ""
  return `${setting.value}${unit}`
}
