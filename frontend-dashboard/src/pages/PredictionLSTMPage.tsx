import { Activity, BrainCircuit, Database, RefreshCw, ShieldAlert } from "lucide-react"

import { PredictionChart } from "@/components/charts/PredictionChart"
import { SummaryMetric } from "@/components/dashboard/SummaryMetric"
import { PageHeader } from "@/components/layout/PageHeader"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { LoadingState } from "@/components/states/LoadingState"
import { StatusBadge } from "@/components/status/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardContext } from "@/hooks/useDashboardContext"
import { usePredictionWorkspace } from "@/hooks/usePredictionWorkspace"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import { useAdminToken } from "@/hooks/useAdminToken"

export function PredictionLSTMPage() {
  const { eventRevision } = useDashboardContext()
  const workspace = usePredictionWorkspace(eventRevision)
  const { hasToken } = useAdminToken()
  const activeModel = workspace.models.find((model) => model.is_active)

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button onClick={() => void workspace.refresh()} size="sm" variant="secondary">
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        }
        description="Inspect active LSTM readiness, five-minute S2 forecasts, and evaluation evidence from backend APIs."
        title="Prediction & LSTM"
      />

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
              detail={workspace.latest ? `Forecast for ${formatDateTime(workspace.latest.predicted_for)}` : "No inference result has arrived."}
              icon={BrainCircuit}
              label="Predicted S2"
              tone="accent"
              value={formatMeasurement(workspace.latest?.predicted_temperature, "°C")}
            />
            <SummaryMetric
              detail={workspace.latest ? `Created ${formatDateTime(workspace.latest.created_at)}` : "Awaiting backend prediction bridge."}
              icon={ShieldAlert}
              label="Prediction status"
              value={workspace.latest?.final_status || "No prediction"}
            />
            <SummaryMetric
              detail={activeModel ? `Trained ${formatDateTime(activeModel.trained_at)}` : "Activation required before ML inference."}
              icon={Database}
              label="Active model"
              value={activeModel?.version || "Not ready"}
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
                  {workspace.latest ? "Latest five-minute hotspot forecast" : "Awaiting first inference submission"}
                </p>
                <p className="mt-2 max-w-[70ch] text-sm leading-6 text-sidebar-muted">
                  Stale predictions stay in history but cannot drive active dashboard state or Telegram alerts.
                </p>
              </div>
              {workspace.latest ? (
                <StatusBadge label={`Final: ${workspace.latest.final_status}`} status={workspace.latest.final_status} />
              ) : (
                <StatusBadge label="No prediction" status="inactive" />
              )}
            </CardContent>
          </Card>

          <section aria-label="Model evaluation metrics" className="grid gap-4 sm:grid-cols-3">
            <SummaryMetric icon={Activity} label="RMSE" value={workspace.metrics ? workspace.metrics.rmse.toFixed(2) : "--"} detail="Root mean square error." />
            <SummaryMetric icon={Activity} label="MAE" value={workspace.metrics ? workspace.metrics.mae.toFixed(2) : "--"} detail="Mean absolute error." />
            <SummaryMetric icon={Activity} label="MAPE" value={workspace.metrics ? `${workspace.metrics.mape.toFixed(2)}%` : "--"} detail="Mean absolute percentage error." />
          </section>

          <PredictionChart predictions={workspace.history} />

          <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <ModelVersions
              hasToken={hasToken}
              isActivating={workspace.isActivating}
              models={workspace.models}
              onActivate={(id) => void workspace.activate(id)}
            />
            <BaselineComparison comparison={workspace.comparison} />
          </section>

          <PredictionHistory predictions={workspace.history} />
        </>
      )}
    </div>
  )
}

function ModelVersions({
  hasToken,
  isActivating,
  models,
  onActivate,
}: {
  hasToken: boolean
  isActivating: boolean
  models: ReturnType<typeof usePredictionWorkspace>["models"]
  onActivate: (id: number) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Model versions</CardTitle>
        <CardDescription>Training artifacts registered by ML Worker. Only one model can be active.</CardDescription>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <EmptyState description="No model version has been registered yet." icon={Database} title="No trained model" />
        ) : (
          <div className="space-y-3">
            {models.map((model) => (
              <div className="flex flex-col gap-3 rounded-md border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between" key={model.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-bold">{model.version}</p>
                    <StatusBadge label={model.is_active ? "Active" : "Inactive"} status={model.is_active ? "normal" : "inactive"} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Window {model.window_size} min / horizon {model.horizon_minutes} min / {formatDateTime(model.trained_at)}
                  </p>
                </div>
                {!model.is_active ? (
                  <Button disabled={!hasToken || isActivating} onClick={() => onActivate(model.id)} size="sm" variant="secondary">
                    Activate
                  </Button>
                ) : null}
              </div>
            ))}
            {!hasToken ? <p className="text-xs leading-5 text-muted-foreground">Set the admin token in Settings to enable model activation.</p> : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BaselineComparison({ comparison }: { comparison: ReturnType<typeof usePredictionWorkspace>["comparison"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>LSTM vs baseline</CardTitle>
        <CardDescription>Latest active model comparison, evaluated in Celsius units.</CardDescription>
      </CardHeader>
      <CardContent>
        {!comparison ? (
          <EmptyState description="Comparison appears after active-model metrics exist." icon={Activity} title="No comparison yet" />
        ) : (
          <div className="space-y-3 text-sm">
            <ComparisonRow label="LSTM" rmse={comparison.lstm.rmse} />
            {comparison.baselines.map((baseline) => (
              <ComparisonRow key={baseline.baseline_type} label={baseline.baseline_type.replace("_", " ")} rmse={baseline.rmse} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ComparisonRow({ label, rmse }: { label: string; rmse: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted px-3 py-2">
      <span className="capitalize text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-bold">{rmse.toFixed(2)} RMSE</span>
    </div>
  )
}

function PredictionHistory({ predictions }: { predictions: ReturnType<typeof usePredictionWorkspace>["history"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prediction history</CardTitle>
        <CardDescription>Latest bounded forecasts with actual-temperature matching when available.</CardDescription>
      </CardHeader>
      <CardContent>
        {predictions.length === 0 ? (
          <EmptyState description="Prediction bridge has not stored a forecast yet." icon={BrainCircuit} title="No prediction history" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-3 py-3">Predicted for</th><th className="px-3 py-3">Predicted</th><th className="px-3 py-3">Actual</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Model</th><th className="px-3 py-3">Freshness</th></tr>
              </thead>
              <tbody>
                {predictions.map((prediction) => (
                  <tr className="border-b last:border-0" key={prediction.id}>
                    <td className="px-3 py-3">{formatDateTime(prediction.predicted_for)}</td>
                    <td className="px-3 py-3 font-mono">{formatMeasurement(prediction.predicted_temperature, "°C")}</td>
                    <td className="px-3 py-3 font-mono">{prediction.actual_temperature === null ? "--" : formatMeasurement(prediction.actual_temperature, "°C")}</td>
                    <td className="px-3 py-3"><StatusBadge status={prediction.final_status} /></td>
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
