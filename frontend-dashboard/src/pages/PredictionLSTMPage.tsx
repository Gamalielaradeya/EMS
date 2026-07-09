import { Activity, BrainCircuit, Database, Eye, Layers, ShieldAlert, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { PredictionChart } from "@/components/charts/PredictionChart"
import { SummaryMetric } from "@/components/dashboard/SummaryMetric"
import { ModelDetailModal } from "@/components/prediction/ModelDetailModal"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdminToken } from "@/hooks/useAdminToken"
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock"
import { useDashboardContext } from "@/hooks/useDashboardContext"
import { usePredictionWorkspace } from "@/hooks/usePredictionWorkspace"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import { formatStatus } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { ModelComparison, ModelVersion } from "@/types/api"

export function PredictionLSTMPage() {
  const { eventRevision } = useDashboardContext()
  const workspace = usePredictionWorkspace(eventRevision)
  const { hasToken } = useAdminToken()
  const activeModel = workspace.models.find((model) => model.is_active)
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const selectedModel = selectedModelId ? workspace.models.find((m) => m.id === selectedModelId) : null

  return (
    <div className="space-y-6">
      {workspace.error ? (
        <ErrorState message={workspace.error} onRetry={() => void workspace.refresh()} title="Prediction API unavailable" />
      ) : null}

      {workspace.isLoading && workspace.models.length === 0 ? (
        <LoadingState />
      ) : (
        <>
          {!activeModel ? (
            <EmptyState
              description="No active LSTM model exists. Train and activate a model before production inference. Development API payloads remain clearly marked as manual validation."
              icon={ShieldAlert}
              title="Model not ready"
            />
          ) : null}

          <section aria-label="Prediction status metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric
              detail={
                workspace.latest
                  ? `Forecast for ${formatDateTime(workspace.latest.predicted_for)}`
                  : "No inference result has arrived."
              }
              icon={BrainCircuit}
              label="Predicted S2"
              tone="accent"
              value={formatMeasurement(workspace.latest?.predicted_temperature, "°C")}
            />
            <SummaryMetric
              detail={
                workspace.latest
                  ? `Created ${formatDateTime(workspace.latest.created_at)}`
                  : "Awaiting backend prediction bridge."
              }
              icon={ShieldAlert}
              label="Prediction status"
              value={workspace.latest ? formatStatus(workspace.latest.final_status) : "No prediction"}
            />
            <SummaryMetric
              detail={
                activeModel
                  ? `Trained ${formatDateTime(activeModel.trained_at)}`
                  : "Activation required before ML inference."
              }
              icon={Database}
              label="Active model"
              value={activeModel?.model_name || "Not ready"}
            />
            <SummaryMetric
              detail="Latest active-model evaluation in Celsius units."
              icon={Activity}
              label="RMSE"
              value={workspace.metrics ? workspace.metrics.rmse.toFixed(2) : "--"}
            />
          </section>

          <Card className="overflow-hidden bg-sidebar text-sidebar-foreground">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-sidebar-muted">
                  Backend-owned classification
                </p>
                <p className="mt-1 font-display text-xl font-bold">
                  {workspace.latest
                    ? "Latest five-minute hotspot forecast"
                    : "Awaiting first inference submission"}
                </p>
                <p className="mt-2 max-w-[70ch] text-sm leading-6 text-sidebar-muted">
                  Stale predictions stay in history but cannot drive active dashboard state or Telegram alerts.
                </p>
              </div>
              {workspace.latest ? (
                <StatusBadge label={workspace.latest.final_status} status={workspace.latest.final_status} />
              ) : (
                <StatusBadge label="No prediction" status="inactive" />
              )}
            </CardContent>
          </Card>

          <section aria-label="Model evaluation metrics" className="grid gap-4 sm:grid-cols-3">
            <SummaryMetric
              detail="Root mean square error."
              icon={Activity}
              label="RMSE"
              value={workspace.metrics ? workspace.metrics.rmse.toFixed(2) : "--"}
            />
            <SummaryMetric
              detail="Mean absolute error."
              icon={Activity}
              label="MAE"
              value={workspace.metrics ? workspace.metrics.mae.toFixed(2) : "--"}
            />
            <SummaryMetric
              detail="Mean absolute percentage error."
              icon={Activity}
              label="MAPE"
              value={workspace.metrics ? `${workspace.metrics.mape.toFixed(2)}%` : "--"}
            />
          </section>

          <PredictionChart predictions={workspace.history} />

          <section className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
            <ActiveModelCard
              activeModel={activeModel}
              modelCount={workspace.models.length}
              onDetail={(id) => setSelectedModelId(id)}
              onManage={() => setManageOpen(true)}
            />
            <BaselineComparison comparison={workspace.comparison} />
          </section>

          <PredictionHistory predictions={workspace.history} />
        </>
      )}

      {manageOpen ? (
        <ManageModelsModal
          hasToken={hasToken}
          isActivating={workspace.isActivating}
          models={workspace.models}
          onActivate={(id) => void workspace.activate(id)}
          onClose={() => setManageOpen(false)}
          onDetail={(id) => {
            setManageOpen(false)
            setSelectedModelId(id)
          }}
        />
      ) : null}

      {selectedModel ? (
        <ModelDetailModal
          comparison={workspace.comparison}
          fullMetrics={workspace.metrics}
          model={selectedModel}
          onClose={() => setSelectedModelId(null)}
          onDeleted={() => void workspace.refresh()}
          onRenamed={() => void workspace.refresh()}
        />
      ) : null}
    </div>
  )
}

function ActiveModelCard({
  activeModel,
  modelCount,
  onDetail,
  onManage,
}: {
  activeModel: ModelVersion | undefined
  modelCount: number
  onDetail: (id: number) => void
  onManage: () => void
}) {
  return (
    <Card className="self-start">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Model versions</CardTitle>
          <CardDescription>
            Active inference model. Browse all registered artifacts from Manage models.
          </CardDescription>
        </div>
        <Button onClick={onManage} size="sm" type="button" variant="secondary">
          <Layers aria-hidden="true" className="size-4" />
          Manage models
          {modelCount > 0 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-muted-foreground">
              {modelCount}
            </span>
          ) : null}
        </Button>
      </CardHeader>
      <CardContent>
        {!activeModel ? (
          <EmptyState
            description="No active model. Open Manage models to activate a registered version."
            icon={Database}
            title="No active model"
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-md border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-bold">{activeModel.model_name}</p>
                <StatusBadge label="Active" status="normal" />
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{activeModel.version}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Window {activeModel.window_size} min / horizon {activeModel.horizon_minutes} min /{" "}
                {formatDateTime(activeModel.trained_at)}
              </p>
            </div>
            <Button onClick={() => onDetail(activeModel.id)} size="sm" type="button" variant="ghost">
              <Eye aria-hidden="true" className="size-4" />
              Detail
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ManageModelsModal({
  hasToken,
  isActivating,
  models,
  onActivate,
  onClose,
  onDetail,
}: {
  hasToken: boolean
  isActivating: boolean
  models: ModelVersion[]
  onActivate: (id: number) => void
  onClose: () => void
  onDetail: (id: number) => void
}) {
  useBodyScrollLock(true)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 overscroll-none"
      onClick={onClose}
      onWheel={(event) => {
        // Keep page scroll locked; allow only the modal list to scroll.
        if (!(event.target instanceof Element) || !event.target.closest("[data-modal-scroll]")) {
          event.preventDefault()
        }
      }}
      role="dialog"
    >
      <div
        className="flex max-h-[min(85vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-card shadow-floating"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold">Manage models</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Registered training artifacts. Only one model can be active.
            </p>
          </div>
          <Button
            aria-label="Close manage models"
            className="size-8 shrink-0"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5" data-modal-scroll>
          {models.length === 0 ? (
            <EmptyState
              description="No model version has been registered yet."
              icon={Database}
              title="No trained model"
            />
          ) : (
            <div className="space-y-3">
              {models.map((model) => (
                <div
                  className="flex flex-col gap-3 rounded-md border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={model.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-bold">{model.model_name}</p>
                      <StatusBadge
                        label={model.is_active ? "Active" : "Inactive"}
                        status={model.is_active ? "normal" : "inactive"}
                      />
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{model.version}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Window {model.window_size} min / horizon {model.horizon_minutes} min /{" "}
                      {formatDateTime(model.trained_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button onClick={() => onDetail(model.id)} size="sm" type="button" variant="ghost">
                      <Eye aria-hidden="true" className="size-4" />
                      Detail
                    </Button>
                    {!model.is_active ? (
                      <Button
                        disabled={!hasToken || isActivating}
                        onClick={() => onActivate(model.id)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Activate
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {!hasToken ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  Set the admin token in Settings to enable model activation.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function BaselineComparison({
  comparison,
}: {
  comparison: ReturnType<typeof usePredictionWorkspace>["comparison"]
}) {
  const ranking = useMemo(() => (comparison ? rankComparison(comparison) : null), [comparison])

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>LSTM vs Baseline</CardTitle>
        <CardDescription>Active-model Error Comparison</CardDescription>
      </CardHeader>
      <CardContent>
        {!comparison || !ranking ? (
          <EmptyState
            description="Comparison appears after active-model metrics are stored."
            icon={Activity}
            title="No comparison yet"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[18rem] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-bold">Model</th>
                  <th className="px-2 py-2 text-right font-bold">RMSE</th>
                  <th className="px-2 py-2 text-right font-bold">MAE</th>
                  <th className="px-2 py-2 text-right font-bold">MAPE</th>
                </tr>
              </thead>
              <tbody>
                {ranking.rows.map((row) => (
                  <ComparisonRow
                    isBest={row.label === ranking.bestLabel}
                    key={row.label}
                    label={row.label}
                    metrics={row.metrics}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ComparisonRow({
  isBest,
  label,
  metrics,
}: {
  isBest: boolean
  label: string
  metrics: { rmse: number; mae: number; mape: number }
}) {
  return (
    <tr className={cn("border-b last:border-0", isBest && "bg-success-soft/50")}>
      <td className={cn("px-2 py-2.5", isBest ? "font-semibold text-foreground" : "text-muted-foreground")}>
        {label}
        {isBest ? (
          <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-wide text-success">Best</span>
        ) : null}
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-sm font-bold">{metrics.rmse.toFixed(2)}</td>
      <td className="px-2 py-2.5 text-right font-mono text-sm font-bold">{metrics.mae.toFixed(2)}</td>
      <td className="px-2 py-2.5 text-right font-mono text-sm font-bold">{metrics.mape.toFixed(2)}%</td>
    </tr>
  )
}

function PredictionHistory({
  predictions,
}: {
  predictions: ReturnType<typeof usePredictionWorkspace>["history"]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prediction history</CardTitle>
        <CardDescription>
          Latest bounded forecasts with actual-temperature matching when available.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {predictions.length === 0 ? (
          <EmptyState
            description="Prediction bridge has not stored a forecast yet."
            icon={BrainCircuit}
            title="No prediction history"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Predicted for</th>
                  <th className="px-3 py-3">Predicted</th>
                  <th className="px-3 py-3">Actual</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Model</th>
                  <th className="px-3 py-3">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((prediction) => (
                  <tr className="border-b last:border-0" key={prediction.id}>
                    <td className="px-3 py-3">{formatDateTime(prediction.predicted_for)}</td>
                    <td className="px-3 py-3 font-mono">
                      {formatMeasurement(prediction.predicted_temperature, "°C")}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {prediction.actual_temperature === null
                        ? "--"
                        : formatMeasurement(prediction.actual_temperature, "°C")}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={prediction.final_status} />
                    </td>
                    <td className="px-3 py-3">{prediction.model_version || "Manual dev"}</td>
                    <td className="px-3 py-3">{prediction.is_stale ? "Stale" : "Active"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function rankComparison(comparison: ModelComparison) {
  const rows = [
    { label: "LSTM", metrics: comparison.lstm },
    ...comparison.baselines.map((baseline) => ({
      label: formatBaselineLabel(baseline.baseline_type),
      metrics: {
        rmse: baseline.rmse,
        mae: baseline.mae,
        mape: baseline.mape,
      },
    })),
  ]
  const best = rows.reduce((winner, row) => (row.metrics.rmse < winner.metrics.rmse ? row : winner))
  return {
    rows,
    bestLabel: best.label,
  }
}

function formatBaselineLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
