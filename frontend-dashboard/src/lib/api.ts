import type { ApiResponse, DashboardSummary, HealthSummary } from "@/types/api"

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()
export const API_BASE_URL = (configuredApiUrl || "http://localhost:8080/api/v1").replace(/\/$/, "")

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

  let body: ApiResponse<T>
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
  return body.data
}

export const api = {
  getHealth: () => request<HealthSummary>("/health"),
  getDashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
}
