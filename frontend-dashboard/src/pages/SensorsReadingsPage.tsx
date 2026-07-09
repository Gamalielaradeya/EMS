import { RadioTower } from "lucide-react"
import { useMemo, useState } from "react"

import { ReadingsChart } from "@/components/charts/ReadingsChart"
import { ReadingsFilters } from "@/components/readings/ReadingsFilters"
import { ReadingsTable } from "@/components/readings/ReadingsTable"
import { SensorMetadata } from "@/components/readings/SensorMetadata"
import { SensorWorkspaceCard } from "@/components/readings/SensorWorkspaceCard"
import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Card, CardContent } from "@/components/ui/card"
import { useAdminToken } from "@/hooks/useAdminToken"
import { useDashboardContext } from "@/hooks/useDashboardContext"
import { useSensorReadings } from "@/hooks/useSensorReadings"
import { formatDateTime } from "@/lib/format"
import type {
  ActiveLayout,
  DashboardReading,
  FinalStatus,
  ReadingHistoryFilters,
  SensorCode,
} from "@/types/api"

export function SensorsReadingsPage() {
  const [filters, setFilters] = useState<ReadingHistoryFilters>({ limit: 100 })
  const stableFilters = useMemo(() => filters, [filters])
  const { eventRevision, sseStatus, summary } = useDashboardContext()
  const { hasToken } = useAdminToken()
  const {
    sensors,
    latestReadings,
    history,
    activeLayout,
    meta,
    error,
    message,
    isLoading,
    isSaving,
    refresh,
    updateSensor,
  } = useSensorReadings(stableFilters, eventRevision)
  const sensorPlacements = {
    S1: resolveSensorPlacement(activeLayout, "S1"),
    S2: resolveSensorPlacement(activeLayout, "S2"),
  }
  const displaySseStatus = sseStatus === "connecting" ? "checking" : sseStatus

  return (
    <div className="space-y-6">
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => void refresh()}
          title="Sensor API unavailable"
        />
      ) : null}
      {message ? (
        <p className="rounded-md border border-normal/30 bg-normal-muted px-4 py-3 text-sm font-semibold text-normal">
          {message}
        </p>
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
              sensorCode="S1"
              sensorRole="Ambient"
              placement={sensorPlacements.S1}
              status={resolveSensorStatus(summary?.latest_readings.S1)}
            />
            <SensorWorkspaceCard
              reading={latestReadings.S2}
              sensorCode="S2"
              sensorRole="Hotspot"
              placement={sensorPlacements.S2}
              status={resolveSensorStatus(summary?.latest_readings.S2)}
            />
          </section>

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

          <SensorMetadata
            canEdit={hasToken}
            isSaving={isSaving}
            onRename={async (sensorCode, name) => {
              await updateSensor(sensorCode, { name })
            }}
            placements={sensorPlacements}
            sensors={sensors}
          />
          <ReadingsFilters filters={filters} onApply={setFilters} />
          <ReadingsTable meta={meta} readings={history} />

          <p className="text-xs leading-5 text-muted-foreground">
            Last acquisition refresh: {formatDateTime(summary?.gateway?.last_seen_at)}
          </p>
        </>
      )}
    </div>
  )
}

function resolveSensorPlacement(layout: ActiveLayout | null, sensorCode: SensorCode) {
  if (!layout) return "No active layout"
  const isPlaced = layout.devices.some((device) => device.sensor_code === sensorCode)
  return isPlaced ? layout.layout.name : "Not placed on active layout"
}

function resolveSensorStatus(reading?: DashboardReading): FinalStatus | "inactive" {
  if (!reading) return "inactive" as const
  if (reading.sensor_health_status !== "normal") return reading.sensor_health_status
  return reading.current_thermal_status
}
