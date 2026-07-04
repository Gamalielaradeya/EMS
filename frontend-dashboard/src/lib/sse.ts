import { API_BASE_URL } from "@/lib/api"

export type SSEConnectionStatus = "connecting" | "connected" | "disconnected"

export const SSE_EVENT_TYPES = [
  "reading.latest",
  "gateway.status",
  "sensor.trouble",
  "prediction.latest",
  "anomaly.created",
  "notification.sent",
  "system.log",
] as const

export type SSEEventType = (typeof SSE_EVENT_TYPES)[number]

const configuredSseUrl = import.meta.env.VITE_SSE_URL?.trim()
export const SSE_URL = configuredSseUrl || `${API_BASE_URL}/events`

export interface SSEClientOptions {
  onStatusChange: (status: SSEConnectionStatus) => void
  onEvent?: (eventType: SSEEventType) => void
}

export function connectSSE({ onStatusChange, onEvent }: SSEClientOptions) {
  onStatusChange("connecting")
  const source = new EventSource(SSE_URL)

  source.onopen = () => onStatusChange("connected")
  source.onerror = () => onStatusChange("disconnected")

  for (const eventType of SSE_EVENT_TYPES) {
    source.addEventListener(eventType, () => onEvent?.(eventType))
  }

  return () => source.close()
}
