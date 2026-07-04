import { RadioTower, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"

import { ReadingsChart } from "@/components/charts/ReadingsChart"
import { PageHeader } from "@/components/layout/PageHeader"
import { ReadingsFilters } from "@/components/readings/ReadingsFilters"
import { ReadingsTable } from "@/components/readings/ReadingsTable"
import { SensorMetadata } from "@/components/readings/SensorMetadata"
import { SensorWorkspaceCard } from "@/components/readings/SensorWorkspaceCard"
import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useDashboardContext } from "@/hooks/useDashboardContext"
import { useSensorReadings } from "@/hooks/useSensorReadings"
import { formatDateTime } from "@/lib/format"
import type { ReadingHistoryFilters } from "@/types/api"

export function SensorsReadingsPage() {
  const [filters, setFilters] = useState<ReadingHistoryFilters>({ limit: 100 })
  const stableFilters = useMemo(() => filters, [filters])
  const { eventRevision, sseStatus, summary } = useDashboardContext()
  const { sensors, latestReadings, history, meta, error, isLoading, refresh } =
    useSensorReadings(stableFilters, eventRevision)
  const s1 = sensors.find((sensor) => sensor.sensor_code === "S1")
  const s2 = sensors.find((sensor) => sensor.sensor_code === "S2")
  const displaySseStatus = sseStatus === "connecting" ? "checking" : sseStatus

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button onClick={() => void refresh()} size="sm" variant="secondary">
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        }
        description="Inspect live S1 ambient and S2 hotspot measurements, backend sensor health, and bounded historical acquisition data."
        title="Sensors & Readings"
      />

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => void refresh()}
          title="Sensor API unavailable"
        />
      ) : null}

      <Card className="overflow-hidden bg-sidebar text-sidebar-foreground">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sidebar-active">
              <RadioTower aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-sidebar-muted">
                Acquisition link
              </p>
              <p className="mt-1 font-display text-base font-bold">
                Gateway {summary?.gateway?.gateway_code || "not registered"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={`SSE: ${displaySseStatus}`} status={displaySseStatus} />
            <StatusBadge
              label={`Gateway: ${summary?.gateway?.status || "inactive"}`}
              status={summary?.gateway?.status || "inactive"}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && sensors.length === 0 ? (
        <LoadingState />
      ) : (
        <>
          <section aria-label="Latest sensor readings" className="grid gap-4 xl:grid-cols-2">
            <SensorWorkspaceCard
              reading={latestReadings.S1}
              sensor={s1}
              sensorCode="S1"
              sensorRole="Ambient"
            />
            <SensorWorkspaceCard
              reading={latestReadings.S2}
              sensor={s2}
              sensorCode="S2"
              sensorRole="Hotspot"
            />
          </section>

          <ReadingsFilters filters={filters} onApply={setFilters} />

          <section aria-label="Sensor history charts" className="grid gap-4 xl:grid-cols-2">
            <ReadingsChart
              description="Filtered S1 and S2 temperature history from the backend."
              error={error}
              isLoading={isLoading}
              measurement="temperature"
              readings={history}
              title="Temperature history"
            />
            <ReadingsChart
              description="Filtered S1 and S2 humidity history from the backend."
              error={error}
              isLoading={isLoading}
              measurement="humidity"
              readings={history}
              title="Humidity history"
            />
          </section>

          <SensorMetadata sensors={sensors} />
          <ReadingsTable meta={meta} readings={history} />

          <p className="text-xs leading-5 text-muted-foreground">
            Last acquisition refresh: {formatDateTime(summary?.gateway?.last_seen_at)}
          </p>
        </>
      )}
    </div>
  )
}
