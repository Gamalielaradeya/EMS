import { Activity, BarChart3, ChevronDown, ChevronUp, ListChecks } from "lucide-react"
import { useMemo, useRef, useState, type PointerEvent } from "react"

import { ReadingsChart } from "@/components/charts/ReadingsChart"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
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
const DEFAULT_HEIGHT = 282
const MAX_HEIGHT = 540

export function MonitoringBottomSheet({ historyError, historyIsLoading, readings, summary }: MonitoringBottomSheetProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [tab, setTab] = useState<BottomSheetTab>("events")
  const dragStartRef = useRef<{ y: number; height: number } | null>(null)
  const collapsed = height <= MIN_HEIGHT + 12

  const eventCounts = useMemo(() => {
    const events = summary?.recent_events ?? []
    return {
      alarm: events.filter((event) => event.status === "anomali" || event.status === "waspada").length,
      trouble: events.filter((event) => event.status === "trouble").length,
    }
  }, [summary?.recent_events])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = { y: event.clientY, height }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return
    const delta = dragStartRef.current.y - event.clientY
    setHeight(clamp(dragStartRef.current.height + delta, MIN_HEIGHT, MAX_HEIGHT))
  }

  const stopDrag = () => {
    dragStartRef.current = null
  }

  const toggle = () => setHeight((current) => (current <= MIN_HEIGHT + 12 ? DEFAULT_HEIGHT : MIN_HEIGHT))

  return (
    <section
      aria-label="Draggable monitoring status panel"
      className="absolute inset-x-0 bottom-0 z-30 overflow-hidden rounded-t-md border-t border-white/15 bg-white shadow-[0_-16px_38px_rgba(0,0,0,0.34)] transition-[height] duration-200"
      style={{ height }}
    >
      <div className="relative flex h-[54px] items-center justify-between gap-4 border-b bg-white px-5">
        <div
          aria-label="Drag monitoring panel"
          className="absolute left-1/2 top-2 h-2 w-28 -translate-x-1/2 cursor-row-resize rounded-full bg-slate-500"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          role="separator"
        />
        <div className="flex items-center gap-4 pt-3">
          <span className="rounded-md bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-700">Alarm: {eventCounts.alarm}</span>
          <span className="rounded-md bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800">Trouble: {eventCounts.trouble}</span>
          <span className="hidden font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground sm:inline">EMS status panel</span>
        </div>
        <Button onClick={toggle} size="sm" type="button" variant="ghost">
          Toggle Panel
          {collapsed ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
        </Button>
      </div>

      <div className="grid h-[calc(100%-54px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b bg-muted/40 px-5 py-3">
          <SheetTab active={tab === "events"} icon={ListChecks} label="Events" onClick={() => setTab("events")} />
          <SheetTab active={tab === "trends"} icon={BarChart3} label="Trends" onClick={() => setTab("trends")} />
          <SheetTab active={tab === "model"} icon={Activity} label="LSTM Metrics" onClick={() => setTab("model")} />
        </div>
        <div className="overflow-y-auto px-5 py-4">
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
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricBox label="RMSE" value={metrics ? metrics.rmse.toFixed(2) : "--"} />
      <MetricBox label="MAE" value={metrics ? metrics.mae.toFixed(2) : "--"} />
      <MetricBox label="MAPE" value={metrics ? `${metrics.mape.toFixed(2)}%` : "--"} />
      <div className="rounded-md border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground md:col-span-3">
        Active model: <span className="font-semibold text-foreground">{summary?.active_model?.version || "Not ready"}</span>. Metrics are from the active LSTM evaluation and stay read-only on this monitoring view.
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
