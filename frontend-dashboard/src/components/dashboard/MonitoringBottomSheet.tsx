import { Activity, BarChart3, BrainCircuit, CalendarClock, ChevronDown, ChevronUp, ListChecks } from "lucide-react"
import { useMemo, useRef, useState, type PointerEvent } from "react"

import { ReadingsChart } from "@/components/charts/ReadingsChart"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import { formatStatus } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { DashboardSummary, SensorReading } from "@/types/api"

interface MonitoringBottomSheetProps {
  historyError?: string | null
  historyIsLoading?: boolean
  readings: SensorReading[]
  summary: DashboardSummary | null
}

type BottomSheetTab = "events" | "trends" | "model"

const MIN_HEIGHT = 54
const DEFAULT_HEIGHT = 252
const MAX_HEIGHT = 430

export function MonitoringBottomSheet({ historyError, historyIsLoading, readings, summary }: MonitoringBottomSheetProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [tab, setTab] = useState<BottomSheetTab>("events")
  const dragStartRef = useRef<{ y: number; height: number } | null>(null)
  const collapsed = height <= MIN_HEIGHT + 12

  const statusSummary = useMemo(() => summarizeStatus(summary), [summary])

  const clampPanelHeight = (value: number) => clamp(value, MIN_HEIGHT, getSheetMaxHeight())

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = { y: event.clientY, height }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return
    const delta = dragStartRef.current.y - event.clientY
    setHeight(clampPanelHeight(dragStartRef.current.height + delta))
  }

  const stopDrag = () => {
    dragStartRef.current = null
  }

  const toggle = () => setHeight((current) => (current <= MIN_HEIGHT + 12 ? clampPanelHeight(DEFAULT_HEIGHT) : MIN_HEIGHT))

  return (
    <section
      aria-label="Draggable monitoring status panel"
      className="absolute inset-x-0 bottom-0 z-30 max-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-t-md border-t border-white/15 bg-white text-slate-950 shadow-[0_-16px_38px_rgba(0,0,0,0.34)] transition-[height] duration-200"
      style={{ height: clampPanelHeight(height) }}
    >
      <div className="relative flex h-[54px] items-center justify-between gap-3 border-b bg-white px-4 sm:px-5">
        <div
          aria-label="Drag monitoring panel"
          className="absolute left-1/2 top-2 h-2 w-28 -translate-x-1/2 cursor-row-resize rounded-full bg-slate-500"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          role="separator"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2 pt-3 sm:gap-3">
          <StatusSummaryPill label="Alarm" tone={statusSummary.alarmTone} value={statusSummary.alarm} />
          <StatusSummaryPill label="Pre-Alarm" tone={statusSummary.preAlarmTone} value={statusSummary.preAlarm} />
          <StatusSummaryPill label="Trouble" tone={statusSummary.troubleTone} value={statusSummary.trouble} />
          <span className="ml-auto hidden shrink-0 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 md:inline-flex">
            Readings today: {summary?.today_summary.total_readings ?? 0}
          </span>
          <span className="hidden shrink-0 font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground lg:inline">EMS status panel</span>
        </div>
        <Button className="shrink-0" onClick={toggle} size="sm" type="button" variant="ghost">
          Toggle Panel
          {collapsed ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
        </Button>
      </div>

      <div className="grid h-[calc(100%-54px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b bg-muted/40 px-4 py-3 sm:px-5">
          <SheetTab active={tab === "events"} icon={ListChecks} label="Events" onClick={() => setTab("events")} />
          <SheetTab active={tab === "trends"} icon={BarChart3} label="Trends" onClick={() => setTab("trends")} />
          <SheetTab active={tab === "model"} icon={Activity} label="LSTM Metrics" onClick={() => setTab("model")} />
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          {tab === "events" ? <EventsTable summary={summary} /> : null}
          {tab === "trends" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <ReadingsChart
                description="Latest bounded S1 ambient and S2 hotspot readings."
                error={historyError}
                isLoading={historyIsLoading}
                measurement="temperature"
                readings={readings}
                title="Temperature history"
              />
              <ReadingsChart
                description="Latest bounded S1 ambient and S2 hotspot readings."
                error={historyError}
                isLoading={historyIsLoading}
                measurement="humidity"
                readings={readings}
                title="Humidity history"
              />
            </div>
          ) : null}
          {tab === "model" ? <ModelMetrics summary={summary} /> : null}
        </div>
      </div>
    </section>
  )
}

function summarizeStatus(summary: DashboardSummary | null) {
  const readings = Object.values(summary?.latest_readings ?? {}).filter((reading): reading is NonNullable<typeof reading> => Boolean(reading))

  const actualAlarms = readings
    .filter((reading) => reading.sensor_health_status === "normal" && reading.current_thermal_status !== "normal")
    .map((reading) => `${reading.sensor_code} ${formatStatus(reading.current_thermal_status)}`)

  const prediction = summary?.latest_prediction
  const preAlarm = prediction && !prediction.is_stale && prediction.thermal_status !== "normal"
    ? `${prediction.target_sensor} ${formatStatus(prediction.thermal_status)}`
    : "Clear"

  const troubleItems = [
    ...(summary?.gateway && ["offline", "trouble"].includes(summary.gateway.status) ? [`GW ${formatStatus(summary.gateway.status)}`] : []),
    ...readings
      .filter((reading) => reading.sensor_health_status === "trouble" || reading.sensor_health_status === "inactive")
      .map((reading) => `${reading.sensor_code} ${formatStatus(reading.sensor_health_status)}`),
  ]

  return {
    alarm: actualAlarms.length > 0 ? actualAlarms.join(" · ") : "Clear",
    alarmTone: actualAlarms.length > 0 ? "alarm" : "clear",
    preAlarm,
    preAlarmTone: preAlarm === "Clear" ? "clear" : "preAlarm",
    trouble: troubleItems.length > 0 ? troubleItems.join(" · ") : "Clear",
    troubleTone: troubleItems.length > 0 ? "trouble" : "clear",
  } as const
}

function StatusSummaryPill({ label, tone, value }: { label: string; tone: "alarm" | "preAlarm" | "trouble" | "clear"; value: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-bold sm:text-sm",
        tone === "alarm" && "bg-red-100 text-red-800",
        tone === "preAlarm" && "bg-sky-50 text-sky-700",
        tone === "trouble" && "bg-amber-100 text-amber-900",
        tone === "clear" && "bg-emerald-50 text-emerald-700",
      )}
      title={`${label}: ${value}`}
    >
      {label}: {value}
    </span>
  )
}

function SheetTab({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof ListChecks; label: string; onClick: () => void }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors",
        active ? "bg-sidebar text-sidebar-foreground" : "bg-white text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
}

function EventsTable({ summary }: { summary: DashboardSummary | null }) {
  const events = summary?.recent_events ?? []
  if (events.length === 0) {
    return <p className="rounded-md border border-dashed bg-muted p-5 text-sm font-semibold text-muted-foreground">No recent thermal event has been recorded.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="pb-3 font-bold">Detected</th>
            <th className="pb-3 font-bold">Sensor</th>
            <th className="pb-3 font-bold">Status</th>
            <th className="pb-3 font-bold">Description</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr className="border-b last:border-0" key={event.id}>
              <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(event.detected_at)}</td>
              <td className="py-3 pr-4 font-mono text-xs font-bold">{event.sensor_code || "System"}</td>
              <td className="py-3 pr-4"><StatusBadge status={event.status} /></td>
              <td className="py-3 text-muted-foreground">{event.description || "No description supplied."}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ModelMetrics({ summary }: { summary: DashboardSummary | null }) {
  const metrics = summary?.latest_metrics
  const prediction = summary?.latest_prediction
  const activeModel = summary?.active_model

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricBox label="RMSE" value={metrics ? metrics.rmse.toFixed(2) : "--"} />
        <MetricBox label="MAE" value={metrics ? metrics.mae.toFixed(2) : "--"} />
        <MetricBox label="MAPE" value={metrics ? `${metrics.mape.toFixed(2)}%` : "--"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoBox icon={BrainCircuit} label="Active model" value={activeModel?.version || prediction?.model_version || "Not ready"} />
        <InfoBox icon={CalendarClock} label="Trained at" value={activeModel?.trained_at ? formatDateTime(activeModel.trained_at) : "Not available"} />
      </div>

      <div className="rounded-md border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground xl:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-foreground">Latest prediction</span>
          <StatusBadge status={prediction?.final_status || prediction?.thermal_status || "inactive"} />
        </div>
        {prediction ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PredictionField label="Target" value={prediction.target_sensor} />
            <PredictionField label="Temperature" value={formatMeasurement(prediction.predicted_temperature, "°C")} />
            <PredictionField label="Predicted for" value={formatDateTime(prediction.predicted_for)} />
            <PredictionField label="Stale" value={prediction.is_stale ? "Yes" : "No"} />
          </div>
        ) : (
          <p className="mt-3">No latest prediction has been recorded yet. Metrics will appear here after the LSTM worker produces an active prediction and evaluation summary.</p>
        )}
      </div>
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-card">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  )
}

function InfoBox({ icon: Icon, label, value }: { icon: typeof BrainCircuit; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <Icon aria-hidden="true" className="size-4 text-cyan-700" />
      </div>
      <p className="mt-2 font-display text-base font-bold">{value}</p>
    </div>
  )
}

function PredictionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  )
}

function getSheetMaxHeight() {
  if (typeof window === "undefined") return MAX_HEIGHT
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, window.innerHeight - 96))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
