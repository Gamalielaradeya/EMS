import { Activity } from "lucide-react"

import { EmptyState } from "@/components/states/EmptyState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/format"
import type { Sensor } from "@/types/api"

export function SensorMetadata({ sensors }: { sensors: Sensor[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sensor metadata</CardTitle>
        <CardDescription>
          Backend registry for the fixed ambient and hotspot acquisition points.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sensors.length === 0 ? (
          <EmptyState
            description="No sensor registry entries are available from the backend."
            icon={Activity}
            title="No sensors registered"
          />
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {sensors.map((sensor) => (
                <article className="rounded-md border bg-muted p-4" key={sensor.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-bold">{sensor.sensor_code}</p>
                      <p className="mt-1 font-display text-sm font-bold">{sensor.name}</p>
                    </div>
                    <StatusBadge status={sensor.sensor_health_status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <MetadataItem label="Role" value={sensor.sensor_role} />
                    <MetadataItem label="Slave ID" value={String(sensor.modbus_slave_id ?? "--")} />
                    <MetadataItem label="Location" value={sensor.location || "Not set"} />
                    <MetadataItem label="Last seen" value={formatDateTime(sensor.last_seen_at)} />
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="border-b text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-bold">Sensor</th>
                    <th className="pb-3 font-bold">Role</th>
                    <th className="pb-3 font-bold">Location</th>
                    <th className="pb-3 font-bold">Slave ID</th>
                    <th className="pb-3 font-bold">Health</th>
                    <th className="pb-3 font-bold">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {sensors.map((sensor) => (
                    <tr className="border-b last:border-0" key={sensor.id}>
                      <td className="py-3 pr-4">
                        <p className="font-mono text-xs font-bold">{sensor.sensor_code}</p>
                        <p className="mt-1 text-muted-foreground">{sensor.name}</p>
                      </td>
                      <td className="py-3 pr-4 capitalize">{sensor.sensor_role}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{sensor.location || "Not set"}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{sensor.modbus_slave_id ?? "--"}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={sensor.sensor_health_status} />
                      </td>
                      <td className="py-3 text-muted-foreground">{formatDateTime(sensor.last_seen_at)}</td>
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

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 capitalize text-foreground">{value}</dd>
    </div>
  )
}
