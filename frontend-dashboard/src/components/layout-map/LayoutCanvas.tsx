import { useRef, useState, type PointerEvent } from "react"

import { StatusBadge } from "@/components/status/StatusBadge"
import { resolveApiAssetUrl } from "@/lib/api"
import { formatMeasurement } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ActiveLayout, LayoutDevice, SensorCode } from "@/types/api"

interface LayoutCanvasProps {
  activeLayout: ActiveLayout
  compact?: boolean
  disabled?: boolean
  onPositionChange?: (sensorCode: SensorCode, positionX: number, positionY: number) => void
  selectedSensor?: SensorCode
}

type Position = { position_x: number; position_y: number }

export function LayoutCanvas({
  activeLayout,
  compact = false,
  disabled = false,
  onPositionChange,
  selectedSensor,
}: LayoutCanvasProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<SensorCode | null>(null)
  const [positions, setPositions] = useState<Partial<Record<SensorCode, Position>>>({})

  const positionFromCoordinates = (clientX: number, clientY: number) => {
    const bounds = mapRef.current?.getBoundingClientRect()
    if (!bounds) return null
    return {
      position_x: clamp((clientX - bounds.left) / bounds.width),
      position_y: clamp((clientY - bounds.top) / bounds.height),
    }
  }

  const previewPosition = (sensorCode: SensorCode, position: Position) => {
    setPositions((current) => ({ ...current, [sensorCode]: position }))
  }

  const savePosition = (sensorCode: SensorCode, position: Position | null) => {
    if (position && onPositionChange) onPositionChange(sensorCode, position.position_x, position.position_y)
  }

  return (
    <div
      className={cn("relative overflow-hidden rounded-md border bg-muted", compact ? "min-h-44" : "min-h-72")}
      onClick={(event) => {
        if (disabled || !selectedSensor || dragging) return
        const position = positionFromCoordinates(event.clientX, event.clientY)
        if (!position) return
        previewPosition(selectedSensor, position)
        savePosition(selectedSensor, position)
      }}
      onPointerMove={(event) => {
        if (!dragging || disabled) return
        const position = positionFromCoordinates(event.clientX, event.clientY)
        if (position) previewPosition(dragging, position)
      }}
      onPointerUp={(event) => {
        if (!dragging || disabled) return
        const position = positionFromCoordinates(event.clientX, event.clientY)
        savePosition(dragging, position)
        setDragging(null)
      }}
      ref={mapRef}
    >
      <img
        alt={`${activeLayout.layout.name} sensor placement map`}
        className="block h-auto w-full select-none object-contain"
        draggable={false}
        src={resolveApiAssetUrl(activeLayout.layout.image_url)}
      />
      {activeLayout.devices.map((device) => (
        <Marker
          compact={compact}
          device={device}
          disabled={disabled}
          key={device.sensor_code}
          onPointerDown={(event) => {
            if (disabled || !onPositionChange) return
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            setDragging(device.sensor_code)
          }}
          position={positions[device.sensor_code] || device}
        />
      ))}
    </div>
  )
}

interface MarkerProps {
  compact: boolean
  device: LayoutDevice
  disabled: boolean
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  position: Position
}

function Marker({ compact, device, disabled, onPointerDown, position }: MarkerProps) {
  return (
    <button
      aria-label={`${device.sensor_code} ${device.sensor_role} marker. ${device.final_status}. Temperature ${formatMeasurement(device.temperature ?? undefined, "°C")}. Humidity ${formatMeasurement(device.humidity ?? undefined, "%")}.`}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card text-left shadow-card transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        compact ? "px-2 py-1" : "min-w-32 px-3 py-2",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={onPointerDown}
      style={{ left: `${position.position_x * 100}%`, top: `${position.position_y * 100}%` }}
      title={`${device.sensor_code} ${device.sensor_role}: ${formatMeasurement(device.temperature ?? undefined, "°C")}, ${formatMeasurement(device.humidity ?? undefined, "%")}`}
      type="button"
    >
      <span className="font-mono text-xs font-bold">{device.sensor_code}</span>
      {compact ? null : (
        <>
          <span className="mt-1 block text-xs text-muted-foreground">{device.sensor_role}</span>
          <span className="mt-2 block font-display text-sm font-bold">
            {formatMeasurement(device.temperature ?? undefined, "°C")} · {formatMeasurement(device.humidity ?? undefined, "%")}
          </span>
        </>
      )}
      <StatusBadge className="mt-2" label={device.final_status} showDot status={device.final_status} />
    </button>
  )
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}
