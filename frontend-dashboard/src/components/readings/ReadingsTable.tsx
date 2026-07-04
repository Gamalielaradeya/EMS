import { Database } from "lucide-react"

import { EmptyState } from "@/components/states/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import type { ReadingHistoryMeta, SensorReading } from "@/types/api"

interface ReadingsTableProps {
  meta: ReadingHistoryMeta
  readings: SensorReading[]
}

export function ReadingsTable({ meta, readings }: ReadingsTableProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Reading history</CardTitle>
          <CardDescription>
            Newest accepted sensor records. Query returns {readings.length} of {meta.total} matching rows.
          </CardDescription>
        </div>
        <Badge variant="info">{meta.limit || "--"} limit</Badge>
      </CardHeader>
      <CardContent>
        {readings.length === 0 ? (
          <EmptyState
            description="No readings match the selected filters. New hardware or send-test payloads will appear here."
            icon={Database}
            title="No reading history"
          />
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {readings.map((reading) => (
                <article className="rounded-md border bg-muted p-4" key={reading.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-bold">{reading.sensor_code}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(reading.recorded_at)}</p>
                    </div>
                    <Badge variant="info">{reading.quality_status}</Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <ReadingValue label="Temperature" value={formatMeasurement(reading.temperature, "°C")} />
                    <ReadingValue label="Humidity" value={formatMeasurement(reading.humidity, "%")} />
                    <ReadingValue label="Role" value={reading.sensor_role} />
                    <ReadingValue label="Source" value={reading.source} />
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-bold">Recorded</th>
                    <th className="pb-3 font-bold">Sensor</th>
                    <th className="pb-3 font-bold">Temperature</th>
                    <th className="pb-3 font-bold">Humidity</th>
                    <th className="pb-3 font-bold">Quality</th>
                    <th className="pb-3 font-bold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((reading) => (
                    <tr className="border-b last:border-0" key={reading.id}>
                      <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(reading.recorded_at)}</td>
                      <td className="py-3 pr-4">
                        <p className="font-mono text-xs font-bold">{reading.sensor_code}</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">{reading.sensor_role}</p>
                      </td>
                      <td className="py-3 pr-4 font-display font-bold">{formatMeasurement(reading.temperature, "°C")}</td>
                      <td className="py-3 pr-4 font-display font-bold">{formatMeasurement(reading.humidity, "%")}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="info">{reading.quality_status}</Badge>
                      </td>
                      <td className="py-3 capitalize text-muted-foreground">{reading.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ReadingValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 capitalize text-foreground">{value}</dd>
    </div>
  )
}
