import { Check, Pencil, X } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ApiError, api } from "@/lib/api"
import { controlClassName } from "@/lib/forms"
import { formatDateTime, formatMeasurement } from "@/lib/format"
import type { ModelComparison, ModelMetrics, ModelVersion } from "@/types/api"

interface ModelDetailModalProps {
  model: ModelVersion
  fullMetrics?: ModelMetrics | null
  comparison?: ModelComparison | null
  onClose: () => void
  onRenamed?: () => void
}

export function ModelDetailModal({ model, fullMetrics, comparison, onClose, onRenamed }: ModelDetailModalProps) {
  const [displayName, setDisplayName] = useState(model.model_name)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(model.model_name)
  const [isSaving, setIsSaving] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditing) {
          setIsEditing(false)
          setRenameError(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose, isEditing])

  async function handleRename() {
    const trimmed = inputValue.trim()
    if (!trimmed || trimmed === displayName) {
      setIsEditing(false)
      setRenameError(null)
      return
    }
    setIsSaving(true)
    setRenameError(null)
    try {
      await api.updateModelVersion(model.id, trimmed)
      setDisplayName(trimmed)
      setIsEditing(false)
      onRenamed?.()
    } catch (err) {
      setRenameError(err instanceof ApiError ? err.message : "Failed to rename model.")
    } finally {
      setIsSaving(false)
    }
  }

  // Use full metrics if this is the active model, otherwise use the model's embedded metrics
  const metrics = fullMetrics && fullMetrics.model_version === model.version ? fullMetrics : null
  const hasMetrics = model.metrics || metrics

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h2 className="font-display text-lg font-bold">{displayName}</h2>
              <span className="font-mono text-xs text-muted-foreground">{model.version}</span>
            </div>
            <Badge variant={model.is_active ? "normal" : "inactive"}>
              {model.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <Button onClick={onClose} size="icon" variant="ghost" className="size-8">
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <div className="space-y-6 p-6">
          {/* Identity */}
          <Section title="Identity">
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">Model name</span>
              <div className="flex flex-col items-end gap-1.5">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className={`${controlClassName} h-8 w-48`}
                      disabled={isSaving}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRename()
                      }}
                      type="text"
                      value={inputValue}
                    />
                    <Button disabled={isSaving} onClick={() => void handleRename()} size="icon" variant="ghost" className="size-8 text-success">
                      <Check aria-hidden="true" className="size-4" />
                    </Button>
                    <Button disabled={isSaving} onClick={() => { setIsEditing(false); setRenameError(null); }} size="icon" variant="ghost" className="size-8 text-muted-foreground">
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-right font-semibold">{displayName}</span>
                    <Button onClick={() => { setIsEditing(true); setInputValue(displayName); }} size="icon" variant="ghost" className="size-6">
                      <Pencil aria-hidden="true" className="size-3.5" />
                    </Button>
                  </div>
                )}
                {renameError ? <span className="text-xs text-danger">{renameError}</span> : null}
              </div>
            </div>
            <Row label="Algorithm" value={model.algorithm} />
            <Row label="Trained at" value={model.trained_at ? formatDateTime(model.trained_at) : "—"} />
            <Row label="Created at" value={formatDateTime(model.created_at)} />
          </Section>

          {/* Configuration */}
          <Section title="Configuration">
            <Row label="Window size" value={`${model.window_size} minutes`} />
            <Row label="Prediction horizon" value={`${model.horizon_minutes} minutes`} />
            <Row label="Raw sampling interval" value={`${model.raw_sampling_interval_seconds} s`} />
            <Row label="Resample interval" value={`${model.resample_interval_seconds} s`} />
            <Row label="Features" value={model.feature_columns.join(", ")} />
            <Row label="Target" value={model.target_column} />
          </Section>

          {/* Evaluation Metrics */}
          {hasMetrics ? (
            <Section title="Evaluation Metrics (Test Set)">
              <div className="grid grid-cols-3 gap-3">
                <MetricBox label="RMSE" value={formatMeasurement(model.metrics?.rmse ?? metrics?.rmse, "°C")} />
                <MetricBox label="MAE" value={formatMeasurement(model.metrics?.mae ?? metrics?.mae, "°C")} />
                <MetricBox
                  label="MAPE"
                  value={model.metrics ? `${model.metrics.mape.toFixed(2)}%` : metrics ? `${metrics.mape.toFixed(2)}%` : "—"}
                />
              </div>
            </Section>
          ) : null}

          {/* Dataset Info (only available for active model via /model-metrics/latest) */}
          {metrics ? (
            <Section title="Training Dataset">
              <Row
                label="Data range"
                value={
                  metrics.dataset_start_at && metrics.dataset_end_at
                    ? `${formatDateTime(metrics.dataset_start_at)} – ${formatDateTime(metrics.dataset_end_at)}`
                    : "—"
                }
              />
              {(() => {
                const train = metrics.train_size ?? 0
                const val = metrics.validation_size ?? 0
                const test = metrics.test_size ?? 0
                const total = train + val + test
                const trainPct = total > 0 ? (train / total) * 100 : 0
                const valPct = total > 0 ? (val / total) * 100 : 0
                const testPct = total > 0 ? (test / total) * 100 : 0
                return (
                  <>
                    <Row label="Total samples" value={total.toLocaleString()} />
                    <div className="grid grid-cols-3 gap-3">
                      <MetricBox label="Train" value={train.toLocaleString()} />
                      <MetricBox label="Validation" value={val.toLocaleString()} />
                      <MetricBox label="Test" value={test.toLocaleString()} />
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full">
                      <div className="bg-success" style={{ width: `${trainPct}%` }} />
                      <div className="bg-warning" style={{ width: `${valPct}%` }} />
                      <div className="bg-danger" style={{ width: `${testPct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{`Train ${trainPct.toFixed(0)}%`}</span>
                      <span>{`Val ${valPct.toFixed(0)}%`}</span>
                      <span>{`Test ${testPct.toFixed(0)}%`}</span>
                    </div>
                  </>
                )
              })()}
            </Section>
          ) : null}

          {/* Baseline Comparison (only available for active model via /model-comparison/latest) */}
          {comparison && model.is_active ? (
            <Section title="Baseline Comparison">
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Model</th>
                      <th className="px-3 py-2.5 text-right">RMSE</th>
                      <th className="px-3 py-2.5 text-right">MAE</th>
                      <th className="px-3 py-2.5 text-right">MAPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b font-semibold">
                      <td className="px-3 py-2.5">LSTM</td>
                      <td className="px-3 py-2.5 text-right font-mono">{comparison.lstm.rmse.toFixed(4)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{comparison.lstm.mae.toFixed(4)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{comparison.lstm.mape.toFixed(2)}%</td>
                    </tr>
                    {comparison.baselines.map((baseline) => (
                      <tr key={baseline.baseline_type} className="border-b last:border-0">
                        <td className="px-3 py-2.5 capitalize">{baseline.baseline_type.replace("_", " ")}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{baseline.rmse.toFixed(4)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{baseline.mae.toFixed(4)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{baseline.mape.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          {!model.is_active ? (
            <p className="rounded-md border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              Full dataset details and baseline comparison are only available for the active model.
              Activate this model to see complete training data.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/50 p-3 text-center">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  )
}
