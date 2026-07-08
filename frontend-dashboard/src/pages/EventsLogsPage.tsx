import { Bell, RotateCcw, ScrollText, Search, ShieldAlert, Terminal } from "lucide-react"
import { useMemo, useState, type FormEvent, type ReactNode } from "react"

import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardContext } from "@/hooks/useDashboardContext"
import { type OperationalTab, useOperationalLogs } from "@/hooks/useOperationalLogs"
import { getEventCategory } from "@/lib/events"
import { formatDateTime } from "@/lib/format"
import { controlClassName } from "@/lib/forms"
import { cn } from "@/lib/utils"
import type { AnomalyEvent, NotificationLog, OperationalLogFilters, SystemLog, SystemLogLevel, SystemLogSource } from "@/types/api"

interface FilterValues {
  status: string
  source: SystemLogSource | ""
  level: SystemLogLevel | ""
  from: string
  to: string
  limit: number
}

const defaultValues: FilterValues = { status: "", source: "", level: "", from: "", to: "", limit: 100 }
const tabs: Array<{ id: OperationalTab; label: string; icon: typeof ShieldAlert }> = [
  { id: "anomalies", label: "Status Events", icon: ShieldAlert },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "system", label: "System Logs", icon: Terminal },
]

export function EventsLogsPage() {
  const { eventRevision } = useDashboardContext()
  const [tab, setTab] = useState<OperationalTab>("anomalies")
  const [values, setValues] = useState(defaultValues)
  const [filters, setFilters] = useState<OperationalLogFilters>({ limit: 100 })
  const stableFilters = useMemo(() => filters, [filters])
  const workspace = useOperationalLogs(tab, stableFilters, eventRevision)

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(toApiFilters(values))
  }

  function reset() {
    setValues(defaultValues)
    setFilters({ limit: 100 })
  }

  return (
    <div className="space-y-6">
      {workspace.error ? <ErrorState message={workspace.error} onRetry={() => void workspace.refresh()} title="Operational logs unavailable" /> : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted">
          <CardTitle>Operational evidence</CardTitle>
          <CardDescription>Bounded backend records for thesis-demo inspection. Current result: {workspace.total} rows.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div aria-label="Operational log categories" className="grid border-b sm:grid-cols-3" role="tablist">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                aria-selected={tab === id}
                className={cn(
                  "flex min-h-12 items-center gap-2 border-b px-4 py-3 text-left text-sm font-bold transition-colors last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:border-b-0 sm:border-r sm:last:border-r-0",
                  tab === id
                    ? "bg-sidebar text-sidebar-foreground hover:bg-sidebar hover:text-sidebar-foreground"
                    : "hover:bg-muted",
                )}
                key={id}
                onClick={() => setTab(id)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <form className="grid gap-4 border-b p-5 md:grid-cols-2 xl:grid-cols-5" onSubmit={apply}>
            {tab === "system" ? (
              <>
                <FilterField label="Source">
                  <select className={controlClassName} onChange={(event) => setValues((current) => ({ ...current, source: event.target.value as SystemLogSource | "" }))} value={values.source}>
                    <option value="">All sources</option>
                    <option value="backend">Backend</option>
                    <option value="gateway">Gateway</option>
                    <option value="ml-worker">ML worker</option>
                    <option value="telegram">Telegram</option>
                    <option value="database">Database</option>
                  </select>
                </FilterField>
                <FilterField label="Level">
                  <select className={controlClassName} onChange={(event) => setValues((current) => ({ ...current, level: event.target.value as SystemLogLevel | "" }))} value={values.level}>
                    <option value="">All levels</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                    <option value="critical">Critical</option>
                  </select>
                </FilterField>
              </>
            ) : (
              <FilterField label="Status">
                <select className={controlClassName} onChange={(event) => setValues((current) => ({ ...current, status: event.target.value }))} value={values.status}>
                  <option value="">All statuses</option>
                  {tab === "anomalies" ? (
                    <>
                      <option value="waspada">Waspada</option>
                      <option value="anomali">Anomali</option>
                      <option value="trouble">Trouble</option>
                    </>
                  ) : (
                    <>
                      <option value="sent">Sent</option>
                      <option value="failed">Failed</option>
                      <option value="skipped">Skipped</option>
                    </>
                  )}
                </select>
              </FilterField>
            )}
            <FilterField label="From">
              <input className={controlClassName} onChange={(event) => setValues((current) => ({ ...current, from: event.target.value }))} type="datetime-local" value={values.from} />
            </FilterField>
            <FilterField label="To">
              <input className={controlClassName} onChange={(event) => setValues((current) => ({ ...current, to: event.target.value }))} type="datetime-local" value={values.to} />
            </FilterField>
            <FilterField label="Limit">
              <select className={controlClassName} onChange={(event) => setValues((current) => ({ ...current, limit: Number(event.target.value) }))} value={values.limit}>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={250}>250 rows</option>
              </select>
            </FilterField>
            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-5">
              <Button className="h-11" size="sm" type="submit"><Search aria-hidden="true" className="size-4" />Apply filters</Button>
              <Button className="h-11" onClick={reset} size="sm" type="button" variant="secondary"><RotateCcw aria-hidden="true" className="size-4" />Reset</Button>
            </div>
          </form>

          <div className="p-5">
            {workspace.isLoading && workspace.items.length === 0 ? <LoadingState /> : <OperationalTable items={workspace.items} tab={tab} />}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OperationalTable({ items, tab }: { items: Array<AnomalyEvent | NotificationLog | SystemLog>; tab: OperationalTab }) {
  if (items.length === 0) {
    return <EmptyState description="No backend record matches the current bounded query." icon={ScrollText} title="No operational records" />
  }
  if (tab === "anomalies") return <AnomalyTable items={items as AnomalyEvent[]} />
  if (tab === "notifications") return <NotificationTable items={items as NotificationLog[]} />
  return <SystemLogTable items={items as SystemLog[]} />
}

function AnomalyTable({ items }: { items: AnomalyEvent[] }) {
  return <RecordTable columnClasses={["w-[15%]", "w-[8%]", "w-[13%]", "w-[13%]", "w-[13%]", "w-[38%]"]} headings={["Detected", "Sensor", "Event", "Condition", "Temperature", "Description"]} rows={items.map((item) => {
    const category = getEventCategory(item.event_type, item.status)
    return [formatDateTime(item.detected_at), item.sensor_code || (item.event_type === "gateway_trouble" ? "Gateway" : "--"), <EventBadge category={category} key="event" />, <StatusBadge key="status" status={item.status} />, eventTemperature(item), item.description || "--"]
  })} />
}

function EventBadge({ category }: { category: ReturnType<typeof getEventCategory> }) {
  const variant = category === "Alarm" ? "alarm" : category === "Pre-Alarm" ? "preAlarm" : category === "Trouble" ? "troubleStrong" : category === "Recovery" ? "normal" : "inactive"
  return <Badge variant={variant}>{category}</Badge>
}

function eventTemperature(item: AnomalyEvent) {
  const temperature = item.event_type === "actual_threshold" ? item.actual_temperature : item.predicted_temperature
  if (typeof temperature !== "number") return "--"
  return `${temperature.toFixed(1)}°C`
}

function NotificationTable({ items }: { items: NotificationLog[] }) {
  return <RecordTable columnClasses={["w-[16%]", "w-[10%]", "w-[12%]", "w-[18%]", "w-[44%]"]} headings={["Created", "Channel", "Status", "Recipient", "Decision"]} rows={items.map((item) => [formatDateTime(item.created_at), item.channel, <RecordBadge key="status" label={item.status} tone={item.status} />, item.recipient || "--", item.error_message || item.message])} />
}

function SystemLogTable({ items }: { items: SystemLog[] }) {
  return <RecordTable headings={["Created", "Source", "Level", "Message", "Context"]} rows={items.map((item) => [formatDateTime(item.created_at), item.source, <RecordBadge key="level" label={item.level} tone={item.level} />, item.message, item.context ? JSON.stringify(item.context) : "--"])} tableClassName="min-w-[760px] table-fixed text-left text-sm" />
}

function RecordTable({
  columnClasses,
  headings,
  rows,
  tableClassName = "w-full min-w-[900px] table-fixed text-left text-sm",
}: {
  columnClasses?: string[]
  headings: string[]
  rows: ReactNode[][]
  tableClassName?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className={tableClassName}>
        <thead>
          <tr className="border-b text-xs uppercase tracking-[0.1em] text-muted-foreground">
            {headings.map((heading, index) => (
              <th className={cn("px-3 py-3", columnClasses?.[index])} key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr className="border-b align-top last:border-0" key={rowIndex}>
              {cells.map((cell, index) => (
                <td className={cn("break-words px-3 py-3 leading-5", columnClasses?.[index])} key={index}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecordBadge({ label, tone }: { label: string; tone: string }) {
  const variant = tone === "sent" || tone === "info" ? "normal" : tone === "waspada" || tone === "warning" || tone === "skipped" ? "warning" : tone === "anomali" || tone === "critical" ? "danger" : "trouble"
  return <Badge variant={variant}>{label}</Badge>
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}{children}</label>
}

function toApiFilters(values: FilterValues): OperationalLogFilters {
  return { status: values.status || undefined, source: values.source || undefined, level: values.level || undefined, from: toIso(values.from), to: toIso(values.to), limit: values.limit }
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined
}
