import L, { type DivIcon, type LatLngBoundsExpression, type Map as LeafletMap, type Marker as LeafletMarker } from "leaflet"
import { useEffect, useMemo, useRef, useState } from "react"

import { resolveApiAssetUrl } from "@/lib/api"
import { formatMeasurement } from "@/lib/format"
import { prepareFloorplanDisplayImage, type PreparedFloorplanImage } from "@/lib/imageProcessing"
import { formatStatus } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { ActiveLayout, LayoutDevice, SensorCode } from "@/types/api"

interface FloorplanMonitoringMapProps {
  activeLayout: ActiveLayout | null
  className?: string
  focusedEventTone?: "alarm" | "preAlarm" | "trouble" | null
  focusedSensorCode?: SensorCode | null
}

const FALLBACK_WIDTH = 1200
const FALLBACK_HEIGHT = 720

export function FloorplanMonitoringMap({ activeLayout, className, focusedEventTone, focusedSensorCode }: FloorplanMonitoringMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<LeafletMarker[]>([])
  const lastFocusRef = useRef<string | null>(null)
  const [preparedImage, setPreparedImage] = useState<(PreparedFloorplanImage & { sourceUrl: string }) | null>(null)

  const dimensions = useMemo(() => {
    const width = activeLayout?.layout.image_width || FALLBACK_WIDTH
    const height = activeLayout?.layout.image_height || FALLBACK_HEIGHT
    return { width, height }
  }, [activeLayout])

  const sourceImageUrl = useMemo(() => {
    return activeLayout ? resolveApiAssetUrl(activeLayout.layout.image_url) : null
  }, [activeLayout])
  const layoutName = activeLayout?.layout.name

  useEffect(() => {
    if (!sourceImageUrl) {
      return undefined
    }

    let cancelled = false
    let prepared: PreparedFloorplanImage | null = null
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
    if (!container || !layoutName || !preparedImage || preparedImage.sourceUrl !== sourceImageUrl) return

    const bounds: LatLngBoundsExpression = [[0, 0], [dimensions.height, dimensions.width]]
    const map = L.map(container, {
      attributionControl: false,
      crs: L.CRS.Simple,
      maxZoom: 3,
      minZoom: -4,
      preferCanvas: true,
      wheelPxPerZoomLevel: 90,
      zoomControl: true,
      zoomSnap: 0.25,
    })

    L.imageOverlay(preparedImage.url, bounds, {
      alt: `${layoutName} dark floorplan`,
      className: "ems-floorplan-image-overlay",
      interactive: false,
    }).addTo(map)

    map.fitBounds(bounds, { animate: false, padding: [72, 72] })
    mapRef.current = map

    return () => {
      markersRef.current = []
      mapRef.current = null
      lastFocusRef.current = null
      map.remove()
    }
  }, [dimensions.height, dimensions.width, layoutName, preparedImage, sourceImageUrl])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !activeLayout) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = activeLayout.devices.map((device) => {
      const marker = L.marker(deviceToLatLng(device, dimensions.width, dimensions.height), {
        icon: sensorDivIcon(device, device.sensor_code === focusedSensorCode ? focusedEventTone : null),
        keyboard: true,
        title: `${device.sensor_code} ${formatStatus(device.final_status)}`,
      })
      marker.addTo(map)
      return marker
    })

    const focusedDevice = activeLayout.devices.find((device) => device.sensor_code === focusedSensorCode)
    const nextFocus = focusedDevice ? `${focusedDevice.sensor_code}:${focusedEventTone ?? "none"}` : null
    if (focusedDevice && nextFocus !== lastFocusRef.current) {
      map.setView(deviceToLatLng(focusedDevice, dimensions.width, dimensions.height), Math.max(map.getZoom(), -1), { animate: false })
    }
    lastFocusRef.current = nextFocus

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
    }
  }, [activeLayout, dimensions.height, dimensions.width, focusedEventTone, focusedSensorCode])

  return (
    <div className={cn("relative h-full min-h-[28rem] overflow-hidden bg-black", className)}>
      {activeLayout ? (
        <div className="ems-floorplan-leaflet h-full w-full" ref={mapContainerRef} />
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

function sensorDivIcon(device: LayoutDevice, focusTone: FloorplanMonitoringMapProps["focusedEventTone"]): DivIcon {
  const statusClass = statusToClass(device.final_status)
  const temperature = formatMeasurement(device.temperature ?? undefined, "°C")
  const humidity = formatMeasurement(device.humidity ?? undefined, "%")
  const role = device.sensor_role === "ambient" ? "Ambient" : "Hotspot"

  return L.divIcon({
    className: "ems-leaflet-marker-wrapper",
    html: `
      <div class="ems-leaflet-marker ems-leaflet-marker--${statusClass}${focusTone ? ` ems-leaflet-marker--focused ems-leaflet-marker--focus-${focusTone}` : ""}">
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
