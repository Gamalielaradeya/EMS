import { Bell, Gauge, LockKeyhole, RefreshCw, Send, Settings, Thermometer, Workflow } from "lucide-react"
import { type FormEvent, type ReactNode } from "react"

import { PageHeader } from "@/components/layout/PageHeader"
import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSettingsWorkspace } from "@/hooks/useSettingsWorkspace"
import { HAS_ADMIN_TOKEN } from "@/lib/api"
import { controlClassName } from "@/lib/forms"
import type { Setting } from "@/types/api"

export function SettingsPage() {
  const workspace = useSettingsWorkspace()
  const byKey = new Map(workspace.settings.map((setting) => [setting.key, setting]))

  async function saveThresholds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await workspace.saveThresholds(String(data.get("normal_max")), String(data.get("anomaly_min")), String(data.get("timeout_minutes")))
  }

  async function saveTelegram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await workspace.saveTelegram(data.has("enabled"), String(data.get("cooldown")), String(data.get("bot_token")), String(data.get("chat_id")))
    event.currentTarget.reset()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<Button onClick={() => void workspace.refresh()} size="sm" variant="secondary"><RefreshCw aria-hidden="true" className="size-4" />Refresh</Button>}
        description="Tune bounded thermal and Telegram behavior while keeping gateway, application, and ML parameters visible and explainable."
        title="Settings"
      />
      {workspace.error ? <ErrorState message={workspace.error} onRetry={() => void workspace.refresh()} title="Settings API unavailable" /> : null}
      {workspace.message ? <div className="rounded-md border border-border bg-success-soft px-4 py-3 text-sm font-semibold text-success">{workspace.message}</div> : null}
      {!HAS_ADMIN_TOKEN ? <div className="flex gap-3 rounded-md border bg-warning-soft px-4 py-3 text-sm text-warning"><LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p>Protected saves are disabled. Set <code className="font-mono">VITE_ADMIN_TOKEN</code> in local frontend environment.</p></div> : null}

      {workspace.isLoading && workspace.settings.length === 0 ? <LoadingState /> : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
          <div className="space-y-6">
            <SettingsForm icon={Thermometer} title="Thermal thresholds" description="Backend owns status classification. Normal maximum must stay below anomaly minimum.">
              <form className="grid gap-4 sm:grid-cols-3" onSubmit={saveThresholds}>
                <Field label="Normal maximum (°C)"><input className={controlClassName} defaultValue={value(byKey, "threshold_normal_max")} name="normal_max" required type="number" min="0" max="80" step="0.1" /></Field>
                <Field label="Anomaly minimum (°C)"><input className={controlClassName} defaultValue={value(byKey, "threshold_anomaly_min")} name="anomaly_min" required type="number" min="0" max="80" step="0.1" /></Field>
                <Field label="Trouble timeout (min)"><input className={controlClassName} defaultValue={value(byKey, "sensor_timeout_minutes")} name="timeout_minutes" required type="number" min="1" step="1" /></Field>
                <Button className="sm:col-span-3 sm:justify-self-start" disabled={!HAS_ADMIN_TOKEN || workspace.isSaving} type="submit">Save thresholds</Button>
              </form>
            </SettingsForm>

            <SettingsForm icon={Bell} title="Telegram notifications" description="Sensitive fields are never returned in full. Leave token or chat ID blank to preserve stored secret values.">
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveTelegram}>
                <label className="flex min-h-11 items-center gap-3 rounded-md border bg-card px-3 text-sm font-semibold">
                  <input defaultChecked={value(byKey, "telegram_enabled") === "true"} name="enabled" type="checkbox" />
                  Enable Telegram notifications
                </label>
                <Field label="Cooldown (minutes)"><input className={controlClassName} defaultValue={value(byKey, "telegram_cooldown_minutes")} min="0" name="cooldown" required step="1" type="number" /></Field>
                <SecretField configured={configured(byKey, "telegram_bot_token")} label="Bot token"><input autoComplete="off" className={controlClassName} name="bot_token" placeholder="Leave blank to keep stored token" type="password" /></SecretField>
                <SecretField configured={configured(byKey, "telegram_chat_id")} label="Chat ID"><input autoComplete="off" className={controlClassName} name="chat_id" placeholder="Leave blank to keep stored chat ID" type="password" /></SecretField>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button disabled={!HAS_ADMIN_TOKEN || workspace.isSaving} type="submit">Save Telegram settings</Button>
                  <Button disabled={!HAS_ADMIN_TOKEN || workspace.isSaving} onClick={() => void workspace.testNotification()} type="button" variant="secondary"><Send aria-hidden="true" className="size-4" />Test Telegram</Button>
                </div>
              </form>
            </SettingsForm>
          </div>

          <div className="space-y-6">
            <InfoCard icon={Workflow} title="Gateway and application" settings={pick(byKey, ["active_gateway_code", "gateway_heartbeat_interval_seconds", "backend_offline_check_interval_seconds"])} />
            <InfoCard icon={Gauge} title="ML pipeline parameters" settings={pick(byKey, ["raw_sampling_interval_seconds", "ml_resample_interval_seconds", "lstm_window_size", "prediction_horizon_minutes", "prediction_stale_ttl_minutes", "actual_temperature_match_tolerance_seconds"])} />
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsForm({ children, description, icon: Icon, title }: { children: ReactNode; description: string; icon: typeof Settings; title: string }) {
  return <Card><CardHeader><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-md bg-accent text-accent-foreground"><Icon aria-hidden="true" className="size-4" /></div><div><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div></div></CardHeader><CardContent>{children}</CardContent></Card>
}

function InfoCard({ icon: Icon, settings, title }: { icon: typeof Settings; settings: Setting[]; title: string }) {
  return <Card><CardHeader><div className="flex items-center gap-3"><Icon aria-hidden="true" className="size-5 text-primary" /><CardTitle>{title}</CardTitle></div><CardDescription>Read-only locked parameters from backend settings.</CardDescription></CardHeader><CardContent><dl className="space-y-3">{settings.map((setting) => <div className="border-b pb-3 last:border-0 last:pb-0" key={setting.key}><dt className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{setting.key}</dt><dd className="mt-1 text-sm font-semibold">{setting.value}</dd></div>)}</dl></CardContent></Card>
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}{children}</label>
}

function SecretField({ children, configured: isConfigured, label }: { children: ReactNode; configured: boolean; label: string }) {
  return <Field label={label}><div className="grid gap-2">{children}<Badge variant={isConfigured ? "normal" : "inactive"}>{isConfigured ? "Stored and masked" : "Not configured"}</Badge></div></Field>
}

function value(settings: Map<string, Setting>, key: string) {
  return settings.get(key)?.value || ""
}

function configured(settings: Map<string, Setting>, key: string) {
  return value(settings, key) === "********"
}

function pick(settings: Map<string, Setting>, keys: string[]) {
  return keys.flatMap((key) => settings.get(key) ? [settings.get(key)!] : [])
}
