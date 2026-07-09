import { Activity, Check, Pencil, X } from "lucide-react"
import { useEffect, useState, type KeyboardEvent } from "react"

import { EmptyState } from "@/components/states/EmptyState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { controlClassName } from "@/lib/forms"
import { formatDateTime } from "@/lib/format"
import type { Sensor, SensorCode } from "@/types/api"

interface SensorMetadataProps {
  canEdit: boolean
  isSaving: boolean
  placements: Record<SensorCode, string>
  sensors: Sensor[]
  onRename: (sensorCode: SensorCode, name: string) => Promise<void>
}

export function SensorMetadata({
  canEdit,
  isSaving,
  placements,
  sensors,
  onRename,
}: SensorMetadataProps) {
  const [editingCode, setEditingCode] = useState<SensorCode | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sensor metadata</CardTitle>
        <CardDescription>
          Backend registry for the fixed ambient and hotspot acquisition points.
          {canEdit
            ? " Click a sensor name to rename it."
            : " Set the admin token in Settings to rename sensors."}
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
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-bold">{sensor.sensor_code}</p>
                      <div className="mt-1">
                        <SensorNameField
                          canEdit={canEdit}
                          isEditing={editingCode === sensor.sensor_code}
                          isSaving={isSaving && editingCode === sensor.sensor_code}
                          name={sensor.name}
                          onCancel={() => setEditingCode(null)}
                          onStart={() => setEditingCode(sensor.sensor_code)}
                          onSave={async (name) => {
                            await onRename(sensor.sensor_code, name)
                            setEditingCode(null)
                          }}
                        />
                      </div>
                    </div>
                    <StatusBadge
                      label={sensor.sensor_health_status === "normal" ? "Online" : undefined}
                      status={sensor.sensor_health_status}
                    />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <MetadataItem label="Role" value={sensor.sensor_role} />
                    <MetadataItem label="Slave ID" value={String(sensor.modbus_slave_id ?? "—")} />
                    <MetadataItem label="Layout" value={placements[sensor.sensor_code]} />
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
                    <th className="pb-3 font-bold">Layout</th>
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
                        <div className="mt-1">
                          <SensorNameField
                            canEdit={canEdit}
                            isEditing={editingCode === sensor.sensor_code}
                            isSaving={isSaving && editingCode === sensor.sensor_code}
                            name={sensor.name}
                            onCancel={() => setEditingCode(null)}
                            onStart={() => setEditingCode(sensor.sensor_code)}
                            onSave={async (name) => {
                              await onRename(sensor.sensor_code, name)
                              setEditingCode(null)
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4 capitalize">{sensor.sensor_role}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {placements[sensor.sensor_code]}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{sensor.modbus_slave_id ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge
                          label={sensor.sensor_health_status === "normal" ? "Online" : undefined}
                          status={sensor.sensor_health_status}
                        />
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDateTime(sensor.last_seen_at)}
                      </td>
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

function SensorNameField({
  canEdit,
  isEditing,
  isSaving,
  name,
  onCancel,
  onSave,
  onStart,
}: {
  canEdit: boolean
  isEditing: boolean
  isSaving: boolean
  name: string
  onCancel: () => void
  onSave: (name: string) => Promise<void>
  onStart: () => void
}) {
  const [draft, setDraft] = useState(name)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isEditing) {
      setDraft(name)
      setError(null)
    }
  }, [isEditing, name])

  async function commit() {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError("Name required")
      return
    }
    if (trimmed === name) {
      onCancel()
      return
    }
    setError(null)
    try {
      await onSave(trimmed)
    } catch {
      setError("Save failed")
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      void commit()
    }
    if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="space-y-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            aria-label="Sensor display name"
            autoFocus
            className={`${controlClassName} h-8 min-w-0 flex-1 px-2 text-sm`}
            disabled={isSaving}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            value={draft}
          />
          <Button
            aria-label="Save name"
            className="size-8 shrink-0"
            disabled={isSaving}
            onClick={() => void commit()}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Check aria-hidden="true" className="size-3.5 text-success" />
          </Button>
          <Button
            aria-label="Cancel rename"
            className="size-8 shrink-0"
            disabled={isSaving}
            onClick={onCancel}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
        {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
      </div>
    )
  }

  if (!canEdit) {
    return <p className="text-muted-foreground">{name}</p>
  }

  return (
    <button
      className="group inline-flex max-w-full items-center gap-1.5 rounded-sm text-left text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onClick={onStart}
      type="button"
    >
      <span className="truncate font-medium">{name}</span>
      <Pencil
        aria-hidden="true"
        className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70"
      />
    </button>
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
