import type { DashboardEvent, FinalStatus } from "@/types/api"

export type EventCategory = "Alarm" | "Pre-Alarm" | "Trouble" | "Recovery" | "Status"

export function getEventCategory(eventType: DashboardEvent["event_type"], status: FinalStatus): EventCategory {
  if (status === "normal") return "Recovery"
  if (eventType === "actual_threshold") return "Alarm"
  if (eventType === "prediction_threshold") return "Pre-Alarm"
  if (eventType === "sensor_trouble" || eventType === "gateway_trouble") return "Trouble"
  return "Status"
}
