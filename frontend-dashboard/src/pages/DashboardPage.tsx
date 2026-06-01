import {
  Activity,
  BrainCircuit,
  Database,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from "lucide-react"

import { ReadingsChart } from "@/components/charts/ReadingsChart"
import { RecentEvents } from "@/components/dashboard/RecentEvents"
import { SensorReadingCard } from "@/components/dashboard/SensorReadingCard"
import { SummaryMetric } from "@/components/dashboard/SummaryMetric"
import { PageHeader } from "@/components/layout/PageHeader"
import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useDashboardContext } from "@/hooks/useDashboardContext"
import { useReadingHistory } from "@/hooks/useReadingHistory"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import { resolveSystemStatus } from "@/lib/status"
import type { ReadingHistoryFilters, SensorHealthStatus } from "@/types/api"

const dashboardHistoryFilters: ReadingHistoryFilters = { limit: 120 }

export function DashboardPage() {
  const { summary, error, isLoading, refresh, eventRevision } = useDashboardContext()
  const history = useReadingHistory(dashboardHistoryFilters, eventRevision)
  const s1 = summary?.latest_readings.S1
  const s2 = summary?.latest_readings.S2
  const systemStatus = resolveSystemStatus(
    summary?.gateway?.status,
    [s1?.sensor_health_status, s2?.sensor_health_status].filter(
      (status): status is SensorHealthStatus => Boolean(status),
    ),
    summary?.latest_prediction?.final_status,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button onClick={() => void refresh()} size="sm" variant="secondary">
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        }
        description="Live readiness view for S1 ambient acquisition, S2 hotspot monitoring, and LSTM prediction availability."
        title="Thermal monitoring overview"
      />

      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}

      <Card className="overflow-hidden bg-sidebar text-sidebar-foreground">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-11 place-items-center rounded-md bg-sidebar-active">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-sidebar-muted">
                System condition
              </p>
              <p className="mt-1 font-display text-xl font-bold">Priority status assembly</p>
            </div>
          </div>
          <StatusBadge label={`System: ${systemStatus}`} status={systemStatus} />
        </CardContent>
      </Card>

      {isLoading && !summary ? (
        <LoadingState />
      ) : (
        <>
          <section aria-label="Latest sensor readings" className="grid gap-4 xl:grid-cols-2">
            <SensorReadingCard reading={s1} sensorCode="S1" sensorRole="Ambient" />
            <SensorReadingCard reading={s2} sensorCode="S2" sensorRole="Hotspot" />
          </section>

          <section aria-label="Dashboard summary metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric
              detail={summary?.gateway?.last_seen_at ? `Last seen ${formatDateTime(summary.gateway.last_seen_at)}` : "No heartbeat has arrived yet."}
              icon={Wifi}
              label="Gateway status"
              value={summary?.gateway?.status || "Unavailable"}
            />
            <SummaryMetric
              detail={summary?.latest_prediction ? `For ${formatDateTime(summary.latest_prediction.predicted_for)}` : "Model inference has not produced a value."}
              icon={BrainCircuit}
              label="Predicted S2"
              tone="accent"
              value={formatMeasurement(summary?.latest_prediction?.predicted_temperature, "°C")}
            />
            <SummaryMetric
              detail={summary?.active_model ? `Active version ${summary.active_model.version}` : "Train and activate a model in a later milestone."}
              icon={Gauge}
              label="Model readiness"
              value={summary?.active_model ? "Ready" : "Not ready"}
            />
            <SummaryMetric
              detail="Accepted sensor records since start of local day."
              icon={Database}
              label="Readings today"
              value={String(summary?.today_summary.total_readings ?? 0)}
            />
          </section>

          <section aria-label="Sensor history charts" className="grid gap-4 xl:grid-cols-2">
            <ReadingsChart
              description="Latest bounded S1 ambient and S2 hotspot readings."
              error={history.error}
              isLoading={history.isLoading}
              measurement="temperature"
              readings={history.readings}
              title="Temperature history"
            />
            <ReadingsChart
              description="Latest bounded S1 ambient and S2 hotspot readings."
              error={history.error}
              isLoading={history.isLoading}
              measurement="humidity"
              readings={history.readings}
              title="Humidity history"
            />
          </section>

          <section aria-label="Model metric placeholders" className="grid gap-4 sm:grid-cols-3">
            <SummaryMetric
              detail="Root mean square error from active model evaluation."
              icon={Activity}
              label="RMSE"
              value={summary?.latest_metrics ? summary.latest_metrics.rmse.toFixed(2) : "--"}
            />
            <SummaryMetric
              detail="Mean absolute error from active model evaluation."
              icon={Activity}
              label="MAE"
              value={summary?.latest_metrics ? summary.latest_metrics.mae.toFixed(2) : "--"}
            />
            <SummaryMetric
              detail="Mean absolute percentage error from active model evaluation."
              icon={Activity}
              label="MAPE"
              value={summary?.latest_metrics ? `${summary.latest_metrics.mape.toFixed(2)}%` : "--"}
            />
          </section>

          <RecentEvents events={summary?.recent_events ?? []} />
        </>
      )}
    </div>
  )
}
