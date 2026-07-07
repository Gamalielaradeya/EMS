import L, { type DivIcon, type LatLngBoundsExpression, type Marker as LeafletMarker } from "leaflet"
import { useEffect, useMemo, useRef, useState } from "react"

import { resolveApiAssetUrl } from "@/lib/api"
import { formatMeasurement } from "@/lib/format"
import { prepareFloorplanDisplayImage, type PreparedFloorplanImage } from "@/lib/imageProcessing"
import { formatStatus } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { ActiveLayout, LayoutDevice } from "@/types/api"

interface FloorplanMonitoringMapProps {
  activeLayout: ActiveLayout | null
  className?: string
  fitKey?: number | string
}

const FALLBACK_WIDTH = 1200
const FALLBACK_HEIGHT = 720

export function FloorplanMonitoringMap({ activeLayout, className, fitKey }: FloorplanMonitoringMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<LeafletMarker[]>([])
  const [preparedImage, setPreparedImage] = useState<(PreparedFloorplanImage & { sourceUrl: string }) | null>(null)

  const dimensions = useMemo(() => {
    const width = activeLayout?.layout.image_width || FALLBACK_WIDTH
    const height = activeLayout?.layout.image_height || FALLBACK_HEIGHT
    return { width, height }
  }, [activeLayout])

  const sourceImageUrl = useMemo(() => {
    return activeLayout ? resolveApiAssetUrl(activeLayout.layout.image_url) : null
  }, [activeLayout])

  useEffect(() => {
    if (!sourceImageUrl) {
      setPreparedImage(null)
      return undefined
    }

    let cancelled = false
    let prepared: PreparedFloorplanImage | null = null
    setPreparedImage(null)
    void prepareFloorplanDisplayImage(sourceImageUrl).then((result) => {
      if (cancelled) {
        result.revoke()
        return
      }
      prepared = result
      setPreparedImage({ ...result, sourceUrl: sourceImageUrl })
    })

    return () => {
      cancelled = true
      prepared?.revoke()
    }
  }, [sourceImageUrl])

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container || !activeLayout || !preparedImage || preparedImage.sourceUrl !== sourceImageUrl) return

    const bounds: LatLngBoundsExpression = [[0, 0], [dimensions.height, dimensions.width]]
    const map = L.map(container, {
      attributionControl: false,
      crs: L.CRS.Simple,
      maxBounds: bounds,
      maxBoundsViscosity: 0.65,
      maxZoom: 3,
      minZoom: -4,
      preferCanvas: true,
      wheelPxPerZoomLevel: 90,
      zoomControl: true,
      zoomSnap: 0.25,
    })

    L.imageOverlay(preparedImage.url, bounds, {
      alt: `${activeLayout.layout.name} dark floorplan`,
      className: cn(
        "ems-floorplan-image-overlay",
        preparedImage.converted ? "ems-floorplan-image-overlay--prepared" : "ems-floorplan-image-overlay--fallback-dark",
      ),
      interactive: false,
    }).addTo(map)

    map.fitBounds(bounds, { animate: false, padding: [72, 72] })
    markersRef.current = activeLayout.devices.map((device) => {
      const marker = L.marker(deviceToLatLng(device, dimensions.width, dimensions.height), {
        icon: sensorDivIcon(device),
        keyboard: true,
        title: `${device.sensor_code} ${formatStatus(device.final_status)}`,
      })
      marker.addTo(map)
      return marker
    })

    return () => {
      markersRef.current = []
      map.remove()
    }
  }, [activeLayout, dimensions.height, dimensions.width, fitKey, preparedImage, sourceImageUrl])

  return (
    <div className={cn("relative h-full min-h-[28rem] overflow-hidden bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.10),transparent_42%),#020617]", className)}>
      {activeLayout ? (
        <>
          {!preparedImage ? (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.10),transparent_42%),#020617] text-center text-slate-300">
              <div className="rounded-md border border-white/10 bg-black/35 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] backdrop-blur">
                Preparing dark floorplan
              </div>
            </div>
          ) : null}
          <div className="ems-floorplan-leaflet h-full w-full" ref={mapContainerRef} />
        </>
      ) : (
        <div className="grid h-full min-h-[28rem] place-items-center bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_38%),#020617] px-6 text-center text-white">
          <div className="max-w-md rounded-lg border border-white/10 bg-black/45 p-6 shadow-floating backdrop-blur">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Floorplan unavailable</p>
            <h2 className="mt-2 font-display text-2xl font-bold">Upload a server testbed layout</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Dashboard monitoring will use the uploaded AutoCAD floorplan as a dark Leaflet image overlay with S1/S2 markers.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function deviceToLatLng(device: LayoutDevice, width: number, height: number): [number, number] {
  return [height * (1 - device.position_y), width * device.position_x]
}

function sensorDivIcon(device: LayoutDevice): DivIcon {
  const statusClass = statusToClass(device.final_status)
  const temperature = formatMeasurement(device.temperature ?? undefined, "°C")
  const humidity = formatMeasurement(device.humidity ?? undefined, "%")
  const role = device.sensor_role === "ambient" ? "Ambient" : "Hotspot"

  return L.divIcon({
    className: "ems-leaflet-marker-wrapper",
    html: `
      <div class="ems-leaflet-marker ems-leaflet-marker--${statusClass}">
        <div class="ems-leaflet-marker__pin">${device.sensor_code}</div>
        <div class="ems-leaflet-marker__card">
          <div class="ems-leaflet-marker__topline">
            <span>${device.sensor_code}</span>
            <span>${formatStatus(device.final_status)}</span>
          </div>
          <div class="ems-leaflet-marker__role">${role}</div>
          <div class="ems-leaflet-marker__value">${temperature} · ${humidity}</div>
        </div>
      </div>
    `,
    iconAnchor: [22, 22],
    iconSize: [44, 44],
  })
}

function statusToClass(status: LayoutDevice["final_status"]) {
  switch (status) {
    case "normal":
      return "normal"
    case "waspada":
      return "warning"
    case "anomali":
      return "danger"
    case "trouble":
      return "trouble"
  }
}
