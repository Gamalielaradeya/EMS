import { Droplets, MapPin, Thermometer } from "lucide-react"

import { StatusBadge } from "@/components/status/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import type { Sensor, SensorReading } from "@/types/api"

interface SensorWorkspaceCardProps {
  reading?: SensorReading
  sensor?: Sensor
  sensorCode: "S1" | "S2"
  sensorRole: "Ambient" | "Hotspot"
}

export function SensorWorkspaceCard({
  reading,
  sensor,
  sensorCode,
  sensorRole,
}: SensorWorkspaceCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-0">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {sensorCode}
          </p>
          <CardTitle className="mt-1">{sensorRole} sensor</CardTitle>
        </div>
        <StatusBadge status={sensor?.sensor_health_status || "inactive"} />
      </CardHeader>
      <CardContent className="pt-5">
        <div className="grid grid-cols-2 gap-3">
          <Measurement
            icon={Thermometer}
            label="Temperature"
            value={formatMeasurement(reading?.temperature, "°C")}
          />
          <Measurement
            icon={Droplets}
            label="Humidity"
            value={formatMeasurement(reading?.humidity, "%")}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
          <Badge variant="info">{reading?.quality_status || "no reading"}</Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin aria-hidden="true" className="size-3.5" />
            {sensor?.location || "Location not set"}
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {reading
            ? `Latest sample ${formatDateTime(reading.recorded_at)}`
            : "Sensor reading has not arrived yet."}
        </p>
      </CardContent>
    </Card>
  )
}

interface MeasurementProps {
  icon: typeof Thermometer
  label: string
  value: string
}

function Measurement({ icon: Icon, label, value }: MeasurementProps) {
  return (
    <div className="rounded-md bg-muted p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-3 font-display text-xl font-bold tracking-tight">{value}</p>
    </div>
  )
}
