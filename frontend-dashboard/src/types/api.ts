export type SensorHealthStatus = "normal" | "trouble" | "inactive"
export type ThermalStatus = "normal" | "waspada" | "anomali"
export type FinalStatus = ThermalStatus | "trouble"
export type GatewayStatus = "active" | "offline" | "trouble" | "maintenance"
export type SensorCode = "S1" | "S2"
export type SensorRole = "ambient" | "hotspot"
export type ReadingQualityStatus = "valid" | "invalid" | "timeout" | "simulated"

export interface ApiResponse<T, TMeta = never> {
  status: "success" | "error"
  message: string
  data?: T
  meta?: TMeta
  errors?: Record<string, string[]>
}

export interface GatewaySummary {
  gateway_code: string
  status: GatewayStatus
  last_seen_at: string | null
}

export interface DashboardReading {
  sensor_code: SensorCode
  sensor_role: SensorRole
  temperature: number
  humidity: number
  sensor_health_status: SensorHealthStatus
  quality_status: string
  recorded_at: string
}

export interface PredictionSummary {
  id: number
  target_sensor: SensorCode
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

export interface Sensor {
  id: number
  gateway_id: string | null
  sensor_code: SensorCode
  sensor_role: SensorRole
  name: string
  type: string
  location: string | null
  modbus_slave_id: number | null
  sensor_health_status: SensorHealthStatus
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface SensorReading {
  id: number
  gateway_id: string
  sensor_code: SensorCode
  sensor_role: SensorRole
  temperature: number
  humidity: number
  recorded_at: string
  quality_status: ReadingQualityStatus
  source: string
}

export interface ReadingHistoryFilters {
  sensor_code?: SensorCode
  from?: string
  to?: string
  quality_status?: ReadingQualityStatus
  limit: number
}

export interface ReadingHistoryMeta {
  total: number
  limit: number
  offset: number
}

export interface ReadingHistoryResult {
  readings: SensorReading[]
  meta: ReadingHistoryMeta
}
