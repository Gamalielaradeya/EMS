# EMS Thermal LSTM ML Worker

Database-driven Python worker for Milestone 6 training, evaluation, and local
inference. It reads PostgreSQL `sensor_readings`, produces leakage-safe
time-series datasets, compares Celsius-unit baselines, trains an LSTM, and
stores model metadata in the backend database.

Inference submits final model output to the protected backend prediction
bridge. Backend owns thermal classification, persistence, anomaly events, SSE,
and Telegram decisions.

## Requirements

- Python `3.10+`
- PostgreSQL with project migrations applied
- A development workstation for TensorFlow training. Do not train on Raspberry
  Pi.

Create a local environment:

```powershell
cd ml-worker
python -m venv .venv
./.venv/Scripts/python.exe -m pip install --upgrade pip
./.venv/Scripts/python.exe -m pip install -r requirements.txt
./.venv/Scripts/python.exe -m pip install -r requirements-tensorflow.txt
Copy-Item .env.example .env
```

`requirements.txt` installs preprocessing, PostgreSQL, and test dependencies.
`requirements-tensorflow.txt` adds the larger TensorFlow runtime. Commands that
need TensorFlow exit with a clear setup message when it is absent.

## Configuration

`.env.example` contains dummy-safe defaults. Do not commit `.env`.

Important values:

| Variable | Default | Purpose |
|---|---:|---|
| `DATABASE_URL` | local PostgreSQL URL | source data and training metadata |
| `BACKEND_BASE_URL` | `http://localhost:8080/api/v1` | prediction submission target |
| `INTERNAL_API_TOKEN` | none | protected backend prediction token |
| `ML_ALLOWED_SOURCES` | `hardware` | comma-separated allowed reading sources |
| `ML_ALLOWED_QUALITY_STATUSES` | `valid` | comma-separated quality filters |
| `ML_MINIMUM_RESAMPLED_ROWS` | `300` | minimum minute rows before training |
| `ML_WINDOW_SIZE` | `30` | input sequence length |
| `ML_HORIZON_MINUTES` | `5` | future S2 prediction horizon |
| `ML_EPOCHS` | `50` | maximum LSTM epochs |
| `ML_INFER_INTERVAL_SECONDS` | `60` | periodic inference loop interval |
| `ML_LOG_FILE` | `./ml-worker.log` | ignored local worker log |

For development validation only, set `ML_ALLOWED_SOURCES=simulator`. Simulator
metrics are not thesis results.

## Canonical CLI

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli train
./.venv/Scripts/python.exe -m ml_worker.cli train --activate
./.venv/Scripts/python.exe -m ml_worker.cli train-augmented --synthetic ./reports/synthetic-run-01/synthetic_ml_wide.csv
./.venv/Scripts/python.exe -m ml_worker.cli evaluate
./.venv/Scripts/python.exe -m ml_worker.cli early-warning-report
./.venv/Scripts/python.exe -m ml_worker.cli generate-synthetic
./.venv/Scripts/python.exe -m ml_worker.cli infer
./.venv/Scripts/python.exe -m ml_worker.cli infer-loop
./.venv/Scripts/python.exe -m ml_worker.cli cleanup-artifacts
```

All commands accept PostgreSQL settings through environment variables.
`train` and `evaluate` also accept `--start` and `--end` ISO-8601 timestamps.
`evaluate` and `infer` accept `--version`; otherwise they require the active
model and fail safely when no model is active. `infer` submits its final S2 prediction to
`POST /api/v1/ml/predictions`; it fails safely when backend or token is
unavailable.

`infer-loop` checks for a new resampled input window every
`ML_INFER_INTERVAL_SECONDS` seconds until stopped. It submits only when
`input_window_end_at` is newer than the latest stored prediction for that model;
unchanged input is reported as `skipped_no_new_input`. This check survives
worker restarts because it reads the latest window timestamp from PostgreSQL.
Stop it with `Ctrl+C`.

Example runtime validation:

```powershell
$env:ML_ALLOWED_SOURCES = "hardware"
$env:ML_ALLOWED_QUALITY_STATUSES = "valid"
$env:ML_INFER_INTERVAL_SECONDS = "60"
./.venv/Scripts/python.exe -m ml_worker.cli infer-loop
```

Keep this process running alongside the backend when the dashboard needs a
fresh non-stale prediction stream. It uses the active model; it does not retrain.

`early-warning-report` is read-only. It compares stored LSTM metrics with the
best stored baseline and audits predictions that backend has matched to actual
S2 readings. The report includes threshold episodes, missed warnings, false
warnings, transition MAE, threshold recall, and median lead time. It never
activates or deactivates a model.

`train --activate` also applies the same baseline gate. A candidate that is
worse than the best baseline is still saved for audit, but remains inactive and
the command output explains the failed MAE/RMSE checks.

`cleanup-artifacts` lists generated model/report directories that are no longer
referenced by `model_versions`. It is a dry-run by default. Review the listed
paths, then use `cleanup-artifacts --apply` to delete them. Cleanup is restricted
to direct child directories named `<ML_MODEL_NAME>_v*`; synthetic datasets and
paths outside configured model/report roots are never selected.

`generate-synthetic` creates deterministic development-only temperature
patterns without writing to PostgreSQL or calling the backend. It produces a
wide ML CSV, a long sensor-like CSV marked `source=simulator` and
`quality_status=simulated`, plus a manifest. The patterns include stable,
gradual/rapid heating, hot hold, and recovery periods.

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli generate-synthetic `
  --output ./reports/synthetic-run-01 `
  --minutes 1440 `
  --seed 42
```

Synthetic rows may later be evaluated as training augmentation. They must not
enter validation/test partitions, hardware evidence, active inference input, or
Telegram testing. Model comparison must include hardware-only test results.

`train-augmented` implements that controlled experiment. Hardware readings are
split chronologically first. Synthetic windows are added only to the hardware
training partition and are capped at 30% by default. Validation, test metrics,
and persistence/moving-average baselines use hardware only. The resulting model
is always saved inactive, even if its promotion gate passes.

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli train-augmented `
  --synthetic ./reports/synthetic-run-01/synthetic_ml_wide.csv `
  --max-synthetic-ratio 0.30 `
  --seed 42
```

Example for a controlled heat/recovery period:

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli early-warning-report `
  --start 2026-07-07T11:30:00+07:00 `
  --end 2026-07-07T13:00:00+07:00
```

## Pipeline

1. Read filtered S1 and S2 rows from `sensor_readings`.
2. Resample raw 10-second readings to one-minute means.
3. Pivot the feature columns:
   `temperature_s1`, `humidity_s1`, `temperature_s2`, `humidity_s2`.
4. Apply bounded interpolation and forward fill, then drop incomplete rows.
5. Join `future_temperature_s2` at the exact `t+5 minute` timestamp.
6. Split chronologically into train `70%`, validation `15%`, and test `15%`.
7. Purge horizon-crossing rows at split boundaries to prevent target leakage.
8. Build windows only from continuous one-minute timestamps.
9. Fit feature and target scalers on the train partition only.
10. Compare persistence and five-point moving-average baselines in Celsius.
9. Train and evaluate the LSTM in Celsius units.
10. Save model files under `models/`, reports under `reports/`, and metadata in
    PostgreSQL.

Generated model files, reports, `.env`, `.venv`, and caches are ignored by Git.

## Validation

```powershell
./.venv/Scripts/python.exe -m compileall src tests
./.venv/Scripts/python.exe -m unittest discover -s tests -v
./.venv/Scripts/python.exe -m ml_worker.cli --help
```
