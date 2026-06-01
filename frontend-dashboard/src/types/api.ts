export type SensorHealthStatus = "normal" | "trouble" | "inactive"
export type ThermalStatus = "normal" | "waspada" | "anomali"
export type FinalStatus = ThermalStatus | "trouble"
export type GatewayStatus = "active" | "offline" | "trouble" | "maintenance"

export interface ApiResponse<T> {
  status: "success" | "error"
  message: string
  data?: T
  errors?: Record<string, string[]>
}

export interface GatewaySummary {
  gateway_code: string
  status: GatewayStatus
  last_seen_at: string | null
}

export interface DashboardReading {
  sensor_code: "S1" | "S2"
  sensor_role: "ambient" | "hotspot"
  temperature: number
  humidity: number
  sensor_health_status: SensorHealthStatus
  quality_status: string
  recorded_at: string
}

export interface PredictionSummary {
  id: number
  target_sensor: "S2"
  predicted_temperature: number
  predicted_for: string
  thermal_status: ThermalStatus
  final_status: FinalStatus
  model_version: string | null
  is_stale: boolean
}

export interface ActiveModelSummary {
  id: number
  version: string
  trained_at: string | null
}

export interface MetricsSummary {
  rmse: number
  mae: number
  mape: number
}

export interface TodaySummary {
  total_readings: number
  total_waspada: number
  total_anomali: number
  total_trouble: number
}

export interface TelegramSummary {
  enabled: boolean
  last_status: string | null
}

export interface DashboardEvent {
  id: number
  sensor_code: string | null
  status: FinalStatus
  severity: string
  description: string | null
  detected_at: string
}

export interface DashboardSummary {
  gateway: GatewaySummary | null
  latest_readings: Partial<Record<"S1" | "S2", DashboardReading>>
  latest_prediction: PredictionSummary | null
  active_model: ActiveModelSummary | null
  latest_metrics: MetricsSummary | null
  today_summary: TodaySummary
  telegram: TelegramSummary
  recent_events: DashboardEvent[]
}

export interface HealthSummary {
  database: string
  time: string
}
