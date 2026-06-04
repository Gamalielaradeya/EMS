import { Droplets, Thermometer } from "lucide-react"

import { StatusBadge } from "@/components/status/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import type { DashboardReading } from "@/types/api"

interface SensorReadingCardProps {
  sensorCode: "S1" | "S2"
  sensorRole: "Ambient" | "Hotspot"
  reading?: DashboardReading
}

export function SensorReadingCard({ sensorCode, sensorRole, reading }: SensorReadingCardProps) {
  const healthStatus = reading?.sensor_health_status || "inactive"
  const currentThermalStatus = reading?.current_thermal_status || "normal"

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-0">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {sensorCode}
          </p>
          <CardTitle className="mt-1">{sensorRole} sensor</CardTitle>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge label={`Sensor Health: ${healthStatus}`} status={healthStatus} />
          <StatusBadge label={`Current Thermal: ${currentThermalStatus}`} status={currentThermalStatus} />
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="grid grid-cols-2 gap-3">
          <Measurement icon={Thermometer} label="Temperature" value={formatMeasurement(reading?.temperature, "°C")} />
          <Measurement icon={Droplets} label="Humidity" value={formatMeasurement(reading?.humidity, "%")} />
        </div>
        <p className="mt-4 border-t pt-3 text-xs leading-5 text-muted-foreground">
          {reading ? `Last reading ${formatDateTime(reading.recorded_at)}` : "Sensor reading has not arrived yet."}
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
      <p className="mt-3 font-display text-xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  )
}
