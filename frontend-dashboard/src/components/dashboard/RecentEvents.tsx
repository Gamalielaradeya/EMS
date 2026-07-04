import { ScrollText } from "lucide-react"

import { EmptyState } from "@/components/states/EmptyState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/format"
import type { DashboardEvent } from "@/types/api"

interface RecentEventsProps {
  events: DashboardEvent[]
}

export function RecentEvents({ events }: RecentEventsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent thermal events</CardTitle>
        <CardDescription>Latest backend event records, ordered by detection time.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            description="No anomaly or trouble event has been recorded. This area will update when backend events exist."
            icon={ScrollText}
            title="No recent events"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
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
                    <td className="py-3 pr-4">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">{event.description || "No description supplied."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
