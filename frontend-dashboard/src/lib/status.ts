import type { FinalStatus, GatewayStatus, SensorHealthStatus } from "@/types/api"

export type DisplayStatus =
  | FinalStatus
  | GatewayStatus
  | SensorHealthStatus
  | "connected"
  | "disconnected"
  | "checking"
  | "ready"
  | "not-ready"
  | "stale"

export type StatusVariant = "normal" | "warning" | "danger" | "trouble" | "troubleStrong" | "inactive" | "info"

export function getStatusVariant(status: DisplayStatus): StatusVariant {
  switch (status) {
    case "normal":
    case "active":
    case "connected":
    case "ready":
      return "normal"
    case "waspada":
    case "maintenance":
    case "checking":
    case "stale":
      return "warning"
    case "anomali":
      return "danger"
    case "trouble":
    case "offline":
    case "disconnected":
      return "troubleStrong"
    case "inactive":
    case "not-ready":
      return "inactive"
  }
  return "inactive"
}

export function formatStatus(status: string) {
  return status.replace("-", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

export function resolveSystemStatus(
  gatewayStatus?: GatewayStatus,
  sensorStatuses: SensorHealthStatus[] = [],
  predictionStatus?: FinalStatus,
): FinalStatus {
  if (
    !gatewayStatus ||
    gatewayStatus === "offline" ||
    gatewayStatus === "trouble" ||
    sensorStatuses.includes("trouble")
  ) {
    return "trouble"
  }
  return predictionStatus || "normal"
}
