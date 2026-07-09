import { useCallback, useEffect, useState } from "react"

import { ApiError, api } from "@/lib/api"
import type { ModelComparison, ModelMetrics, ModelVersion, Prediction } from "@/types/api"

interface PredictionWorkspace {
  comparison: ModelComparison | null
  history: Prediction[]
  latest: Prediction | null
  metrics: ModelMetrics | null
  models: ModelVersion[]
}

const emptyWorkspace: PredictionWorkspace = {
  comparison: null,
  history: [],
  latest: null,
  metrics: null,
  models: [],
}

export function usePredictionWorkspace(eventRevision: number) {
  const [workspace, setWorkspace] = useState(emptyWorkspace)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActivating, setIsActivating] = useState(false)

  const refresh = useCallback(async (mode: "hard" | "soft" = "hard") => {
    // Soft SSE refresh must not flip isLoading while data already exists,
    // or the page can flash empty/loading and jump scroll.
    if (mode === "hard") {
      setIsLoading(true)
    }
    try {
      const [latest, history, models, metrics, comparison] = await Promise.all([
        api.getLatestPrediction(),
        api.getPredictionHistory(),
        api.getModelVersions(),
        api.getLatestModelMetrics(),
        api.getLatestModelComparison(),
      ])
      setWorkspace({ latest, history: history.predictions, models, metrics, comparison })
      setError(null)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Prediction workspace could not be loaded.",
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const activate = useCallback(async (id: number) => {
    setIsActivating(true)
    try {
      await api.activateModelVersion(id)
      await refresh("hard")
    } catch (requestError) {
      setError(
        requestError instanceof ApiError ? requestError.message : "Model activation failed.",
      )
    } finally {
      setIsActivating(false)
    }
  }, [refresh])

  useEffect(() => {
    queueMicrotask(() => void refresh(eventRevision === 0 ? "hard" : "soft"))
  }, [eventRevision, refresh])

  return { ...workspace, error, isActivating, isLoading, refresh: () => refresh("hard"), activate }
}
