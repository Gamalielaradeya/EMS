# EMS Thermal LSTM ML Worker

Database-driven Python worker for Milestone 6 training, evaluation, and local
inference. It reads PostgreSQL `sensor_readings`, produces leakage-safe
time-series datasets, compares Celsius-unit baselines, trains an LSTM, and
stores model metadata in the backend database.

Milestone 6 local inference does not submit predictions to the backend. The
protected backend prediction bridge belongs to Milestone 7.

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
| `ML_ALLOWED_SOURCES` | `hardware` | comma-separated allowed reading sources |
| `ML_ALLOWED_QUALITY_STATUSES` | `valid` | comma-separated quality filters |
| `ML_MINIMUM_RESAMPLED_ROWS` | `300` | minimum minute rows before training |
| `ML_WINDOW_SIZE` | `30` | input sequence length |
| `ML_HORIZON_MINUTES` | `5` | future S2 prediction horizon |
| `ML_EPOCHS` | `50` | maximum LSTM epochs |
| `ML_LOG_FILE` | `./ml-worker.log` | ignored local worker log |

For development validation only, set `ML_ALLOWED_SOURCES=simulator`. Simulator
metrics are not thesis results.

## Canonical CLI

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli train
./.venv/Scripts/python.exe -m ml_worker.cli train --activate
./.venv/Scripts/python.exe -m ml_worker.cli evaluate
./.venv/Scripts/python.exe -m ml_worker.cli infer
```

All commands accept PostgreSQL settings through environment variables.
`train` and `evaluate` also accept `--start` and `--end` ISO-8601 timestamps.
`evaluate` and `infer` accept `--version`; otherwise the active model is
preferred, then the latest model.

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
