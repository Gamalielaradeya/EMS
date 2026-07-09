import { AlertTriangle, BrainCircuit, MapPinned, Wifi, type LucideIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { MonitoringBottomSheet } from "@/components/dashboard/MonitoringBottomSheet"
import { FloorplanMonitoringMap } from "@/components/layout-map/FloorplanMonitoringMap"
import { ErrorState } from "@/components/states/ErrorState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { useDashboardContext } from "@/hooks/useDashboardContext"
import { useLayoutWorkspace } from "@/hooks/useLayoutWorkspace"
import { useReadingHistory } from "@/hooks/useReadingHistory"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import { formatStatus } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { DashboardEvent, DashboardSummary, FinalStatus, ReadingHistoryFilters, SensorCode } from "@/types/api"

const dashboardHistoryFilters: ReadingHistoryFilters = { limit: 120 }

export function DashboardPage() {
  const { summary, error, isLoading, refresh, eventRevision } = useDashboardContext()
  const layoutWorkspace = useLayoutWorkspace(eventRevision)
  const history = useReadingHistory(dashboardHistoryFilters, eventRevision)
  const predictionThermalStatus = summary?.prediction_thermal_status
  const activeEvents = useActiveDashboardEvents(summary)
  const [focusedEventId, setFocusedEventId] = useState<number | null>(null)
  const resolvedFocusedEventId = activeEvents.some((event) => event.id === focusedEventId)
    ? focusedEventId
    : activeEvents[0]?.id ?? null
  const focusedEvent =
    activeEvents.find((event) => event.id === resolvedFocusedEventId) ?? null
  const focusedSensorCode = sensorCodeFromEvent(focusedEvent)
  const focusedEventTone = focusedEvent ? eventToneFromEvent(focusedEvent) : null

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      <section className="relative isolate h-[calc(100dvh-5rem)] min-h-0 overflow-hidden bg-black text-white">
        <FloorplanMonitoringMap
          activeLayout={layoutWorkspace.layout}
          className="absolute inset-0 z-0"
          focusedEventTone={focusedEventTone}
          focusedSensorCode={focusedSensorCode}
        />
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(2,6,23,0.72),transparent_34%,transparent_67%,rgba(2,6,23,0.42)),linear-gradient(180deg,rgba(2,6,23,0.46),transparent_30%,rgba(2,6,23,0.22))]" />

        <div className="absolute left-16 top-4 z-20 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-2 rounded-md border border-white/10 bg-black/35 px-3 py-2 text-sm font-bold shadow-floating backdrop-blur md:left-16 md:top-6">
          <span className="inline-flex items-center gap-2">
            <MapPinned aria-hidden="true" className="size-4 text-cyan-200" />
            EMS Thermal LSTM
          </span>
          <span className="text-slate-400">›</span>
          <span className="text-cyan-100">{layoutWorkspace.layout?.layout.name || "Server Testbed Layout"}</span>
        </div>

        {focusedEvent ? <FocusedEventCard event={focusedEvent} summary={summary} /> : null}

        <aside className="absolute right-4 top-20 z-20 hidden w-80 space-y-3 xl:block">
          <GlassMetric
            detail={summary?.gateway?.last_seen_at ? `Last seen ${formatDateTime(summary.gateway.last_seen_at)}` : "No heartbeat has arrived yet."}
            icon={Wifi}
            label="Gateway"
            status={summary?.gateway?.status || "offline"}
            value={summary?.gateway?.status ? formatStatus(summary.gateway.status) : "Unavailable"}
          />
          <GlassMetric
            detail={summary?.latest_prediction ? `Predicted S2 for ${formatDateTime(summary.latest_prediction.predicted_for)}.` : "Model inference has not produced a value."}
            icon={BrainCircuit}
            label="Prediction"
            status={predictionThermalStatus || "inactive"}
            value={predictionThermalStatus ? formatStatus(predictionThermalStatus) : "No prediction"}
          />
        </aside>

        {error ? (
          <div className="absolute left-6 right-6 top-6 z-40 mx-auto max-w-3xl text-slate-950">
            <ErrorState message={error} onRetry={() => void refresh()} />
          </div>
        ) : null}
        {layoutWorkspace.error ? (
          <div className="absolute bottom-80 left-6 z-40 max-w-xl rounded-md border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 shadow-floating">
            Layout API: {layoutWorkspace.error}
          </div>
        ) : null}
        {(isLoading && !summary) || (layoutWorkspace.isLoading && !layoutWorkspace.layout) ? (
          <div aria-label="Loading dashboard data" className="absolute inset-0 z-50 bg-black/35 backdrop-blur-sm" />
        ) : null}

        <MonitoringBottomSheet
          focusedEventId={resolvedFocusedEventId}
          historyError={history.error}
          historyIsLoading={history.isLoading}
          onFocusEvent={setFocusedEventId}
          readings={history.readings}
          summary={summary}
        />
      </section>
    </div>
  )
}

function FocusedEventCard({ event, summary }: { event: DashboardEvent; summary: DashboardSummary | null }) {
  const presentation = getFocusedEventPresentation(event)
  const sensorCode = sensorCodeFromEvent(event)
  const reading = sensorCode ? summary?.latest_readings[sensorCode] : undefined
  const activePreAlarm = event.event_type === "prediction_threshold" ? summary?.active_pre_alarm : null

  return (
    <div className={cn("absolute left-4 top-20 z-20 w-[min(22.5rem,calc(100%-2rem))] overflow-hidden rounded-lg border bg-slate-950/84 text-white shadow-floating backdrop-blur-md md:left-6 md:top-24", presentation.borderClassName)}>
      <div className={cn("flex items-start justify-between gap-4 border-b border-white/10 px-4 py-2.5", presentation.headerClassName)}>
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-white/80">{presentation.label}</p>
          <h1 className="font-display text-lg font-bold text-white">{presentation.title}</h1>
        </div>
        <AlertTriangle aria-hidden="true" className="mt-1 size-5 text-white/85" />
      </div>
      <div className="space-y-3 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />
          <span className="rounded-md border border-white/10 bg-white/8 px-2.5 py-1 text-xs font-bold text-slate-200">
            {sensorCode ? `${sensorCode} ${sensorCode === "S1" ? "Ambient" : "Hotspot"}` : "Gateway"}
          </span>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {event.event_type === "prediction_threshold" ? (
            <>
              <EventField label="Predicted for" value={formatDateTime(activePreAlarm?.predicted_for || event.detected_at)} />
              <EventField label="Predicted temp" value={formatMeasurement(activePreAlarm?.predicted_temperature, "°C")} />
              <EventField label="Sensor target" value={activePreAlarm?.target_sensor || sensorCode || "--"} />
              <EventField label="Model" value={activePreAlarm?.model_version || "Active model"} />
            </>
          ) : (
            <>
              <EventField label="Detected" value={formatDateTime(event.detected_at)} />
              <EventField label="Temperature" value={formatMeasurement(reading?.temperature, "°C")} />
              <EventField label="Humidity" value={formatMeasurement(reading?.humidity, "%")} />
              <EventField label="Condition" value={formatStatus(event.status as FinalStatus)} />
            </>
          )}
        </div>
        <p className="rounded-md border border-white/10 bg-black/24 px-3 py-2 text-sm leading-5 text-slate-200">
          {event.description || "No description supplied."}
        </p>
      </div>
    </div>
  )
}

function EventField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  )
}

function GlassMetric({ detail, icon: Icon, label, status, value }: { detail: string; icon: LucideIcon; label: string; status: Parameters<typeof StatusBadge>[0]["status"]; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/72 p-4 text-white shadow-floating backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">{label}</p>
          <p className="mt-1 font-display text-xl font-bold text-white">{value}</p>
        </div>
        <Icon aria-hidden="true" className="size-5 text-cyan-200" />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-300">{detail}</p>
      <div className="mt-3"><StatusBadge status={status} /></div>
    </div>
  )
}

function useActiveDashboardEvents(summary: DashboardSummary | null) {
  return useMemo(() => {
    const activePreAlarm = summary?.active_pre_alarm
    const preAlarmEvent: DashboardEvent | null = activePreAlarm
      ? {
          id: -activePreAlarm.id,
          sensor_code: activePreAlarm.target_sensor,
          event_type: "prediction_threshold",
          status: activePreAlarm.thermal_status,
          severity: activePreAlarm.thermal_status === "anomali" ? "critical" : "warning",
          description: `Predicted S2 temperature ${formatMeasurement(activePreAlarm.predicted_temperature, "°C")} for ${formatDateTime(activePreAlarm.predicted_for)}.`,
          detected_at: activePreAlarm.predicted_for,
        }
      : null
    return preAlarmEvent ? [preAlarmEvent, ...(summary?.active_events ?? [])] : summary?.active_events ?? []
  }, [summary])
}

function sensorCodeFromEvent(event: DashboardEvent | null): SensorCode | null {
  return event?.sensor_code === "S1" || event?.sensor_code === "S2" ? event.sensor_code : null
}

function eventToneFromEvent(event: DashboardEvent): "alarm" | "preAlarm" | "trouble" {
  if (event.event_type === "prediction_threshold") return "preAlarm"
  if (event.event_type === "sensor_trouble" || event.event_type === "gateway_trouble") return "trouble"
  return "alarm"
}

function getFocusedEventPresentation(event: DashboardEvent) {
  if (event.event_type === "prediction_threshold") {
    return {
      label: "Prediction threshold",
      title: "Pre-Alarm",
      borderClassName: "border-cyan-300/35",
      headerClassName: "bg-cyan-600",
    }
  }
  if (event.event_type === "sensor_trouble" || event.event_type === "gateway_trouble") {
    return {
      label: "Technical issue",
      title: "Trouble",
      borderClassName: "border-orange-300/40",
      headerClassName: "bg-orange-600",
    }
  }
  return {
    label: "Actual threshold",
    title: "Alarm",
    borderClassName: "border-rose-300/40",
    headerClassName: "bg-rose-700",
  }
}
