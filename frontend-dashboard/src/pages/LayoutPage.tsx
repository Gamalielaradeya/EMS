import { FileImage, ImageUp, MapPinned, MousePointer2, Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"

import { LayoutCanvas } from "@/components/layout-map/LayoutCanvas"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardContext } from "@/hooks/useDashboardContext"
import { useLayoutWorkspace } from "@/hooks/useLayoutWorkspace"
import { useAdminToken } from "@/hooks/useAdminToken"
import { controlClassName } from "@/lib/forms"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import type { SensorCode } from "@/types/api"

export function LayoutPage() {
  const { eventRevision } = useDashboardContext()
  const workspace = useLayoutWorkspace(eventRevision)
  const { hasToken } = useAdminToken()
  const [selectedSensor, setSelectedSensor] = useState<SensorCode>("S1")
  const [layoutName, setLayoutName] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [invertToDark, setInvertToDark] = useState(false)

  const submitUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!image) return
    void workspace.upload(image, layoutName, invertToDark)
  }

  return (
    <div className="space-y-6">
      {workspace.error ? <ErrorState message={workspace.error} onRetry={() => void workspace.refresh()} title="Layout API unavailable" /> : null}
      {workspace.message ? <p className="rounded-md border border-normal/30 bg-normal-muted px-4 py-3 text-sm text-normal">{workspace.message}</p> : null}
      {!hasToken ? <p className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">Set the admin token in Settings to upload images and save marker positions.</p> : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle>{workspace.layout ? "Replace active layout" : "Upload testbed layout"}</CardTitle>
          <CardDescription>PNG, JPG, JPEG, or WebP. Maximum file size: 5 MB. If the image is already dark, leave invert off.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form className="grid gap-4 xl:grid-cols-[minmax(14rem,1fr)_minmax(16rem,1.05fr)_minmax(14rem,0.9fr)_auto] xl:items-end" onSubmit={submitUpload}>
            <label className="grid gap-2 text-sm font-semibold">
              Layout name
              <input className={controlClassName} onChange={(event) => setLayoutName(event.target.value)} placeholder="Server Testbed Layout" value={layoutName} />
            </label>
            <div className="grid gap-2 text-sm font-semibold">
              <span>Image file</span>
              <label className="flex h-11 min-w-0 cursor-pointer overflow-hidden rounded-md border bg-card text-sm transition-[border-color] hover:border-input focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
                <span className="inline-flex h-full shrink-0 items-center gap-2 border-r bg-muted px-3 font-bold text-foreground">
                  <FileImage aria-hidden="true" className="size-4" />
                  Browse
                </span>
                <span className={`min-w-0 truncate px-3 py-3 font-semibold ${image ? "text-foreground" : "text-muted-foreground"}`}>
                  {image?.name || "No file selected"}
                </span>
                <input
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => setImage(event.target.files?.[0] || null)}
                  type="file"
                />
              </label>
            </div>
            <label className="flex min-h-11 items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm font-semibold transition-[border-color] hover:border-input">
              <input
                checked={invertToDark}
                className="size-4 accent-primary"
                onChange={(event) => setInvertToDark(event.target.checked)}
                type="checkbox"
              />
              <span className="leading-5">
                Invert to dark map
                <span className="block text-xs font-medium text-muted-foreground">Use only for white CAD images.</span>
              </span>
            </label>
            <Button className="h-11 xl:min-w-36" disabled={!hasToken || !image || workspace.isSaving} type="submit">
              <ImageUp aria-hidden="true" className="size-4" />
              {workspace.isSaving ? "Saving..." : "Upload image"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {workspace.isLoading && !workspace.layout ? (
        <LoadingState />
      ) : workspace.layout ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <Card>
            <CardHeader>
              <CardTitle>{workspace.layout.layout.name}</CardTitle>
              <CardDescription>
                Select sensor, click image to place it, or drag existing marker. Position saves on release.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LayoutCanvas
                activeLayout={workspace.layout}
                disabled={!hasToken || workspace.isSaving}
                onPositionChange={(sensorCode, positionX, positionY) => void workspace.saveMarker(sensorCode, positionX, positionY)}
                onSensorSelect={setSelectedSensor}
                selectedSensor={selectedSensor}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MousePointer2 aria-hidden="true" className="size-4" />
                  Placement tool
                </CardTitle>
                <CardDescription>Active target: {selectedSensor}. Map click updates selected marker.</CardDescription>
              </CardHeader>
            </Card>
            {workspace.sensors.map((sensor) => {
              const reading = workspace.latestReadings[sensor.sensor_code]
              const marker = workspace.layout?.devices.find((device) => device.sensor_code === sensor.sensor_code)
              return (
                <Card className={selectedSensor === sensor.sensor_code ? "border-primary" : undefined} key={sensor.sensor_code}>
                  <CardHeader className="flex-row items-start justify-between gap-3 pb-0">
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{sensor.sensor_code}</p>
                      <CardTitle className="mt-1 capitalize">{sensor.sensor_role}</CardTitle>
                    </div>
                    <StatusBadge status={marker?.final_status || sensor.sensor_health_status} />
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4 text-sm">
                    <p className="font-display font-bold">{formatMeasurement(reading?.temperature, "°C")} · {formatMeasurement(reading?.humidity, "%")}</p>
                    <p className="text-xs leading-5 text-muted-foreground">Last seen {formatDateTime(sensor.last_seen_at)}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setSelectedSensor(sensor.sensor_code)} size="sm" variant={selectedSensor === sensor.sensor_code ? "default" : "secondary"}>
                        {marker ? "Move marker" : "Place marker"}
                      </Button>
                      {marker ? (
                        <Button disabled={!hasToken || workspace.isSaving} onClick={() => void workspace.removeMarker(sensor.sensor_code)} size="sm" variant="ghost">
                          <Trash2 aria-hidden="true" className="size-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ) : (
        <EmptyState
          description="Upload one testbed image to start placing S1 ambient and S2 hotspot markers. No multi-floor management is needed for this prototype."
          icon={MapPinned}
          title="No active layout image"
        />
      )}
    </div>
  )
}
