import type {
  ApiResponse,
  DashboardSummary,
  HealthSummary,
  ReadingHistoryFilters,
  ReadingHistoryMeta,
  ReadingHistoryResult,
  ModelComparison,
  ModelMetrics,
  ModelVersion,
  Prediction,
  PredictionHistoryResult,
  Sensor,
  SensorReading,
} from "@/types/api"

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()
export const API_BASE_URL = (configuredApiUrl || "http://localhost:8080/api/v1").replace(/\/$/, "")
export const HAS_ADMIN_TOKEN = Boolean(import.meta.env.VITE_ADMIN_TOKEN?.trim())

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function requestEnvelope<T, TMeta = never>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T, TMeta>> {
  let response: Response
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5000)
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: init?.signal || controller.signal,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError("Backend API is unavailable. Check the service and try again.")
  } finally {
    window.clearTimeout(timeout)
  }

  let body: ApiResponse<T, TMeta>
  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new ApiError("Backend returned an unreadable response.", response.status)
  }

  if (!response.ok || body.status !== "success") {
    throw new ApiError(body.message || "Backend request failed.", response.status, body.errors)
  }
  if (body.data === undefined) {
    throw new ApiError("Backend response did not include expected data.", response.status)
  }
  return body
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await requestEnvelope<T>(path, init)
  return body.data as T
}

function readingHistoryQuery(filters: ReadingHistoryFilters) {
  const query = new URLSearchParams()
  if (filters.sensor_code) query.set("sensor_code", filters.sensor_code)
  if (filters.from) query.set("from", filters.from)
  if (filters.to) query.set("to", filters.to)
  if (filters.quality_status) query.set("quality_status", filters.quality_status)
  query.set("limit", String(filters.limit))
  return query.toString()
}

function adminHeaders() {
  const token = import.meta.env.VITE_ADMIN_TOKEN?.trim()
  if (!token) throw new ApiError("Set VITE_ADMIN_TOKEN locally to activate a model.")
  return { Authorization: `Bearer ${token}` }
}

export const api = {
  getHealth: () => request<HealthSummary>("/health"),
  getDashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
  getSensors: () => request<Sensor[]>("/sensors"),
  getLatestReadings: () =>
    request<Partial<Record<"S1" | "S2", SensorReading>>>("/readings/latest"),
  getReadingHistory: async (filters: ReadingHistoryFilters): Promise<ReadingHistoryResult> => {
    const body = await requestEnvelope<SensorReading[], ReadingHistoryMeta>(
      `/readings/history?${readingHistoryQuery(filters)}`,
    )
    return {
      readings: body.data as SensorReading[],
      meta: body.meta || { total: 0, limit: filters.limit, offset: 0 },
    }
  },
  getLatestPrediction: () => request<Prediction | null>("/predictions/latest"),
  getPredictionHistory: async (limit = 120): Promise<PredictionHistoryResult> => {
    const body = await requestEnvelope<Prediction[], ReadingHistoryMeta>(
      `/predictions/history?limit=${limit}`,
    )
    return {
      predictions: body.data as Prediction[],
      meta: body.meta || { total: 0, limit, offset: 0 },
    }
  },
  getModelVersions: () => request<ModelVersion[]>("/model-versions"),
  activateModelVersion: (id: number) =>
    request<ModelVersion>(`/model-versions/${id}/activate`, {
      method: "PUT",
      headers: adminHeaders(),
    }),
  getLatestModelMetrics: () => request<ModelMetrics | null>("/model-metrics/latest"),
  getLatestModelComparison: () => request<ModelComparison | null>("/model-comparison/latest"),
}
