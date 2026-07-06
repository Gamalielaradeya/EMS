import { BrainCircuit, MapPinned, RefreshCw, ShieldCheck, Thermometer, Wifi, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { MonitoringBottomSheet } from "@/components/dashboard/MonitoringBottomSheet"
import { FloorplanMonitoringMap } from "@/components/layout-map/FloorplanMonitoringMap"
import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { useDashboardContext } from "@/hooks/useDashboardContext"
import { useLayoutWorkspace } from "@/hooks/useLayoutWorkspace"
import { useReadingHistory } from "@/hooks/useReadingHistory"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import { formatStatus } from "@/lib/status"
import type { DashboardReading, ReadingHistoryFilters } from "@/types/api"

const dashboardHistoryFilters: ReadingHistoryFilters = { limit: 120 }

export function DashboardPage() {
  const { summary, error, isLoading, refresh, eventRevision } = useDashboardContext()
  const layoutWorkspace = useLayoutWorkspace(eventRevision)
  const history = useReadingHistory(dashboardHistoryFilters, eventRevision)
  const s1 = summary?.latest_readings.S1
  const s2 = summary?.latest_readings.S2
  const currentThermalStatus = summary?.overall_current_thermal_status || "normal"
  const currentThermalSource = summary?.overall_current_thermal_source_sensor
  const predictionThermalStatus = summary?.prediction_thermal_status

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      <section className="relative isolate h-[calc(100dvh-5rem)] min-h-0 overflow-hidden bg-black text-white">
        <FloorplanMonitoringMap activeLayout={layoutWorkspace.layout} className="absolute inset-0 z-0" fitKey={eventRevision} />
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(2,6,23,0.72),transparent_34%,transparent_67%,rgba(2,6,23,0.42)),linear-gradient(180deg,rgba(2,6,23,0.46),transparent_30%,rgba(2,6,23,0.22))]" />

        <div className="absolute left-16 top-4 z-20 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-2 rounded-md border border-white/10 bg-black/35 px-3 py-2 text-sm font-bold shadow-floating backdrop-blur md:left-16 md:top-6">
          <span className="inline-flex items-center gap-2">
            <MapPinned aria-hidden="true" className="size-4 text-cyan-200" />
            EMS Thermal LSTM
          </span>
          <span className="text-slate-400">›</span>
          <span className="text-cyan-100">{layoutWorkspace.layout?.layout.name || "Server Testbed Layout"}</span>
        </div>

        <div className="absolute right-4 top-4 z-20 flex flex-wrap justify-end gap-2 md:right-6 md:top-6">
          <Button className="border border-white/10 bg-white/90 text-slate-950 hover:bg-white" onClick={() => void refresh()} size="sm" variant="secondary">
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        </div>

        <div className="absolute left-4 top-20 z-20 w-[min(26rem,calc(100%-2rem))] space-y-3 md:left-6 md:top-24">
          <GlassCard>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Current thermal condition</p>
                <h1 className="mt-2 font-display text-2xl font-bold text-white">Actual S1/S2 reading classification</h1>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {currentThermalSource ? `Worst latest actual reading source: ${currentThermalSource}.` : "Waiting for the latest actual reading source."}
                </p>
              </div>
              <ShieldCheck aria-hidden="true" className="mt-1 size-6 text-cyan-200" />
            </div>
            <div className="mt-4">
              <StatusBadge label={`${formatStatus(currentThermalStatus)}${currentThermalSource ? ` · ${currentThermalSource}` : ""}`} status={currentThermalStatus} />
            </div>
          </GlassCard>

          <div className="grid gap-3 sm:grid-cols-2">
            <SensorMiniCard reading={s1} role="Ambient" sensorCode="S1" />
            <SensorMiniCard reading={s2} role="Hotspot" sensorCode="S2" />
          </div>
        </div>

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
          <div className="absolute inset-0 z-50 grid place-items-center bg-black/35 backdrop-blur-sm">
            <div className="w-[min(28rem,calc(100%-2rem))] rounded-lg border border-white/10 bg-white text-slate-950 shadow-floating">
              <LoadingState />
            </div>
          </div>
        ) : null}

        <MonitoringBottomSheet
          historyError={history.error}
          historyIsLoading={history.isLoading}
          readings={history.readings}
          summary={summary}
        />
      </section>
    </div>
  )
}

function GlassCard({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-slate-950/72 p-4 shadow-floating backdrop-blur-md">{children}</div>
}

function SensorMiniCard({ reading, role, sensorCode }: { reading?: DashboardReading; role: string; sensorCode: "S1" | "S2" }) {
  const status = reading?.sensor_health_status === "trouble" ? "trouble" : reading?.current_thermal_status || "inactive"
  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">{sensorCode}</p>
          <p className="mt-1 font-display text-lg font-bold">{role}</p>
        </div>
        <Thermometer aria-hidden="true" className="size-5 text-cyan-200" />
      </div>
      <p className="mt-3 font-display text-xl font-bold">{formatMeasurement(reading?.temperature, "°C")}</p>
      <p className="text-sm text-slate-300">Humidity {formatMeasurement(reading?.humidity, "%")}</p>
      <div className="mt-3"><StatusBadge status={status} /></div>
    </GlassCard>
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
