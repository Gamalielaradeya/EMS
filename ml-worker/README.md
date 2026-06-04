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
./.venv/Scripts/python.exe -m ml_worker.cli evaluate
./.venv/Scripts/python.exe -m ml_worker.cli infer
./.venv/Scripts/python.exe -m ml_worker.cli infer-loop
```

All commands accept PostgreSQL settings through environment variables.
`train` and `evaluate` also accept `--start` and `--end` ISO-8601 timestamps.
`evaluate` and `infer` accept `--version`; otherwise the active model is
preferred, then the latest model. `infer` submits its final S2 prediction to
`POST /api/v1/ml/predictions`; it fails safely when backend or token is
unavailable.

`infer-loop` uses the same active-model and backend bridge behavior, but repeats
inference every `ML_INFER_INTERVAL_SECONDS` seconds until stopped. Each cycle
loads latest valid hardware readings, submits a prediction, logs the predicted
timestamp, predicted S2 value, backend thermal status, and continues on the next
cycle if one inference fails. Stop it with `Ctrl+C`.

Example runtime validation:

```powershell
$env:ML_ALLOWED_SOURCES = "hardware"
$env:ML_ALLOWED_QUALITY_STATUSES = "valid"
$env:ML_INFER_INTERVAL_SECONDS = "60"
./.venv/Scripts/python.exe -m ml_worker.cli infer-loop
```

Keep this process running alongside the backend when the dashboard needs a
fresh non-stale prediction stream. It uses the active model; it does not retrain.

## Pipeline

1. Read filtered S1 and S2 rows from `sensor_readings`.
2. Resample raw 10-second readings to one-minute means.
3. Pivot the feature columns:
   `temperature_s1`, `humidity_s1`, `temperature_s2`, `humidity_s2`.
4. Apply bounded interpolation and forward fill, then drop incomplete rows.
5. Create `future_temperature_s2` by shifting S2 five minutes ahead.
6. Split chronologically into train `70%`, validation `15%`, and test `15%`.
7. Fit feature and target scalers on the train partition only.
8. Compare persistence and five-point moving-average baselines in Celsius.
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
