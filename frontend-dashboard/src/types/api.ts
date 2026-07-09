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
  current_thermal_status: ThermalStatus
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
  created_at: string
}

export interface Prediction extends PredictionSummary {
  prediction_run_id: number | null
  model_version_id: number | null
  actual_temperature: number | null
  input_window_start_at: string | null
  input_window_end_at: string | null
  threshold_normal_max: number
  threshold_anomaly_min: number
}

export interface ActiveModelSummary {
  id: number
  model_name: string
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
  total_alarm: number
  total_pre_alarm: number
  total_trouble: number
}

export interface TelegramSummary {
  enabled: boolean
  last_status: string | null
}

export interface DashboardEvent {
  id: number
  sensor_code: string | null
  event_type: "actual_threshold" | "prediction_threshold" | "sensor_trouble" | "gateway_trouble" | string
  status: FinalStatus
  severity: string
  description: string | null
  detected_at: string
}

export interface DashboardSummary {
  gateway: GatewaySummary | null
  latest_readings: Partial<Record<"S1" | "S2", DashboardReading>>
  overall_current_thermal_status: ThermalStatus
  overall_current_thermal_source_sensor: SensorCode | null
  prediction_thermal_status: ThermalStatus | null
  latest_prediction: PredictionSummary | null
  active_pre_alarm: PredictionSummary | null
  active_model: ActiveModelSummary | null
  latest_metrics: MetricsSummary | null
  today_summary: TodaySummary
  telegram: TelegramSummary
  active_events: DashboardEvent[]
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

export interface ModelVersion {
  id: number
  model_name: string
  model_type: string
  version: string
  algorithm: string
  feature_columns: string[]
  target_column: string
  window_size: number
  horizon_minutes: number
  raw_sampling_interval_seconds: number
  resample_interval_seconds: number
  is_active: boolean
  trained_at: string | null
  created_at: string
  metrics: MetricsSummary | null
}

export interface ModelMetrics extends MetricsSummary {
  model_version: string
  dataset_start_at: string | null
  dataset_end_at: string | null
  train_size: number | null
  validation_size: number | null
  test_size: number | null
}

export interface BaselineResult extends MetricsSummary {
  baseline_type: "persistence" | "moving_average"
}

export interface ModelComparison {
  model_version: string
  lstm: MetricsSummary
  baselines: BaselineResult[]
}

export interface PredictionHistoryResult {
  predictions: Prediction[]
  meta: ReadingHistoryMeta
}

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped"
export type SystemLogLevel = "info" | "warning" | "error" | "critical"
export type SystemLogSource = "backend" | "gateway" | "ml-worker" | "telegram" | "database"

export interface AnomalyEvent {
  id: number
  prediction_id: number | null
  sensor_code: string | null
  event_type: string
  status: FinalStatus
  severity: string
  predicted_temperature: number | null
  actual_temperature: number | null
  description: string | null
  detected_at: string
  created_at: string
}

export interface NotificationLog {
  id: number
  anomaly_event_id: number | null
  channel: string
  recipient: string | null
  message: string
  status: NotificationStatus
  sent_at: string | null
  error_message: string | null
  created_at: string
}

export interface SystemLog {
  id: number
  source: SystemLogSource
  level: SystemLogLevel
  message: string
  context?: Record<string, unknown>
  created_at: string
}

export interface OperationalLogFilters {
  status?: string
  source?: SystemLogSource
  level?: SystemLogLevel
  from?: string
  to?: string
  limit: number
}

export interface PagedResult<T> {
  items: T[]
  meta: ReadingHistoryMeta
}

export interface Setting {
  key: string
  value: string
  value_type: "string" | "number" | "boolean" | "json"
  description: string | null
  is_sensitive: boolean
  updated_at: string
}

export interface LayoutRecord {
  id: number
  name: string
  image_url: string
  image_width: number
  image_height: number
  created_at: string
  updated_at: string
}

export interface LayoutDevice {
  sensor_code: SensorCode
  sensor_role: SensorRole
  label: string
  position_x: number
  position_y: number
  final_status: FinalStatus
  temperature: number | null
  humidity: number | null
  last_seen_at: string | null
  sensor_health_status: SensorHealthStatus
}

export interface ActiveLayout {
  layout: LayoutRecord
  devices: LayoutDevice[]
}

export interface LayoutDeviceInput {
  label?: string
  position_x: number
  position_y: number
}
