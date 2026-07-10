# M10C TensorFlow Training Runtime Validation Log - EMS Thermal LSTM

## Status

**Done - development validation only**

This run validates TensorFlow installation and real LSTM pipeline execution on
the laptop. It is not final thesis model evidence by itself (later hardware
candidate runs are recorded below). The earlier Milestone `10B` XY-MD02
auto-report / bus-noise blocker is operator-confirmed resolved; remaining M10B
gaps are thesis evidence and model-quality narrative, not serial noise.

## Environment

| Item | Result |
|---|---|
| Python | `3.10.11` |
| Virtual environment | Reused ignored `ml-worker/.venv` |
| TensorFlow | `2.20.0` |
| TensorFlow device | CPU |
| Free system-drive space before install | `9.92 GB` |
| Free system-drive space after validation | Approximately `8.48 GB` |
| PostgreSQL database | Isolated `ems_thermal_lstm_m10c_validation` |

Install command:

```powershell
./.venv/Scripts/python.exe -m pip install --no-cache-dir -r requirements-tensorflow.txt
```

Dependency checks:

```powershell
./.venv/Scripts/python.exe -m pip check
./.venv/Scripts/python.exe -c "import tensorflow as tf; print(tf.__version__)"
```

Result:

```text
No broken requirements found.
2.20.0
```

The first install command exceeded the 10-minute shell window while completing
package setup. Follow-up checks confirmed successful installation and import.

## Validation Commands

```powershell
./.venv/Scripts/python.exe -m compileall -q src tests
./.venv/Scripts/python.exe -W error::FutureWarning -m unittest discover -s tests -v
./.venv/Scripts/python.exe -m ml_worker.cli --help
./.venv/Scripts/python.exe -m ml_worker.cli train --help
./.venv/Scripts/python.exe -m ml_worker.cli evaluate --help
./.venv/Scripts/python.exe -m ml_worker.cli infer --help
```

Results:

- Syntax compilation passed.
- Ten ML-worker unit tests passed.
- Canonical CLI help surfaces passed.

## Development Dataset

Dataset source:

```text
source=simulator
quality_status=valid
validation_scope=M10C development-only generated dataset
```

This is generated development data, not XY-MD02 hardware data.

| Item | Count |
|---|---:|
| Raw S1/S2 readings | `5,040` |
| Raw cadence | `10 seconds` |
| Time span | `420 minutes` |
| Usable resampled rows | `420` |
| Labeled rows after five-minute shift | `415` |
| Chronological train rows | `290` |
| Chronological validation rows | `62` |
| Chronological test rows | `63` |
| Train windows | `260` |
| Validation windows | `32` |
| Test windows | `33` |

## Training Result

Runtime command:

```powershell
$env:ML_ALLOWED_SOURCES = "simulator"
$env:ML_ALLOWED_QUALITY_STATUSES = "valid"
$env:ML_EPOCHS = "2"
$env:ML_BATCH_SIZE = "32"
./.venv/Scripts/python.exe -m ml_worker.cli train --activate
```

Generated development model:

```text
v20260602_142909
```

Artifacts generated and verified before cleanup:

```text
model.keras
feature_scaler.pkl
target_scaler.pkl
model_metadata.json
training_report.json
```

LSTM metrics in Celsius:

| Metric | Value |
|---|---:|
| RMSE | `1.2562` |
| MAE | `1.2456` |
| MAPE | `4.0552%` |

Required baseline metrics in Celsius:

| Baseline | RMSE | MAE | MAPE |
|---|---:|---:|---:|
| Persistence | `0.2201` | `0.1818` | `0.5925%` |
| Moving average | `0.2585` | `0.2111` | `0.6876%` |

The baselines outperform the two-epoch LSTM. This is acceptable for bounded
runtime validation and is not accepted as final thesis model quality.

## Evaluate and Infer Result

Saved-model evaluation:

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli evaluate
```

Result: passed with Celsius-unit LSTM and baseline metrics.

Backend bridge inference:

```powershell
$env:BACKEND_BASE_URL = "http://localhost:8081/api/v1"
$env:INTERNAL_API_TOKEN = "<local-internal-token>"
./.venv/Scripts/python.exe -m ml_worker.cli infer
```

Result:

| Item | Value |
|---|---|
| Predicted S2 | `29.5286 C` |
| Backend submission | Passed |
| Backend thermal status | `normal` |
| Backend final status | `normal` |
| Prediction stale | `false` |

## Database Persistence

Validated in isolated PostgreSQL:

- One active `model_versions` LSTM row.
- One `model_metrics` row.
- Two `baseline_results` rows.
- Successful training, batch-evaluation, and inference `prediction_runs`.
- One backend `predictions` row from real saved-model inference.
- ML-worker training and inference `system_logs`.

## Cleanup

After recording evidence:

- Removed generated model artifact directory.
- Removed generated training report directory.
- Dropped isolated validation database.
- Stopped temporary backend.
- Removed generated backend executable and temporary local logs.
- Kept ignored `ml-worker/.venv` with TensorFlow `2.20.0` for later hardware
  dataset training.

## Limitations and Next Step

- This run does not use Raspberry Pi or XY-MD02 hardware data.
- This run alone is not final Bab 4 LSTM model evidence.
- Hardware candidate training runs are recorded in later sections of this log.
- XY-MD02 auto-report / bus noise is no longer the active hardware blocker.
- Remaining work is honest model-quality narrative plus final Bab 4
  metrics/artifacts/API/screenshot evidence as needed.

## M10F Hardware Dataset Candidate Training

Status: passed as final-candidate / preliminary hardware training only.

Date: 2026-06-04 local time.

Dataset source:

```text
Source filter: hardware
Quality filter: valid
Sensors: S1 ambient/reference and S2 hotspot/exhaust
Target: future_temperature_s2, five minutes ahead
Resample interval: 1 minute
Window size: 30
Horizon: 5 minutes
Split: chronological only
```

Hardware-valid rows before training:

| Sensor | Rows | Latest hardware timestamp |
|---|---:|---|
| S1 | `1,025` | `2026-06-03 20:02:36.200559+00` |
| S2 | `1,005` | `2026-06-03 20:02:36.200559+00` |

Dry dataset check:

| Item | Count |
|---|---:|
| Raw S1/S2 rows loaded | `2,070` |
| Usable one-minute resampled rows | `218` |
| Labeled rows after five-minute target shift | `213` |
| Chronological train rows | `127` |
| Chronological validation rows | `42` |
| Chronological test rows | `44` |
| Train windows | `97` |
| Validation windows | `12` |
| Test windows | `14` |

Because the hardware dataset was still small, the candidate run used explicit
small-dataset runtime overrides while preserving chronological splitting:

```powershell
$env:ML_ALLOWED_SOURCES = "hardware"
$env:ML_ALLOWED_QUALITY_STATUSES = "valid"
$env:ML_EPOCHS = "30"
$env:ML_BATCH_SIZE = "32"
$env:ML_MINIMUM_RESAMPLED_ROWS = "120"
$env:ML_TRAIN_RATIO = "0.60"
$env:ML_VALIDATION_RATIO = "0.20"
$env:ML_TEST_RATIO = "0.20"
./.venv/Scripts/python.exe -m ml_worker.cli train --activate
```

Generated active model:

```text
v20260603_200711
```

Generated local artifacts, not committed:

```text
ml-worker/models/ems_s2_lstm_v20260603_200711/model.keras
ml-worker/models/ems_s2_lstm_v20260603_200711/feature_scaler.pkl
ml-worker/models/ems_s2_lstm_v20260603_200711/target_scaler.pkl
ml-worker/models/ems_s2_lstm_v20260603_200711/model_metadata.json
ml-worker/reports/ems_s2_lstm_v20260603_200711/training_report.json
```

Training metrics in Celsius:

| Model | RMSE | MAE | MAPE |
|---|---:|---:|---:|
| LSTM | `0.1450` | `0.1131` | `0.3506%` |
| Persistence baseline | `0.1390` | `0.1095` | `0.3397%` |
| Moving-average baseline | `0.1346` | `0.1088` | `0.3374%` |

Evaluation command:

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli evaluate
```

Evaluation metrics in Celsius:

| Model | RMSE | MAE | MAPE |
|---|---:|---:|---:|
| LSTM | `0.1887` | `0.1430` | `0.4422%` |
| Persistence baseline | `0.1712` | `0.1256` | `0.3887%` |
| Moving-average baseline | `0.1696` | `0.1277` | `0.3951%` |

Inference command:

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli infer
```

Backend bridge result:

| Item | Value |
|---|---|
| Predicted S2 temperature | `32.1194 C` |
| Predicted for | `2026-06-03T20:12:00Z` |
| Backend submission | Passed |
| Backend prediction id | `1` |
| Thermal status | `anomali` |
| Final status | `anomali` |
| Stale | `false` |

Backend/database verification:

- `model_versions`: one active model, `v20260603_200711`.
- `model_metrics`: one row for the active model.
- `baseline_results`: persistence and moving-average rows exist.
- `predictions/latest`: returned the submitted non-stale prediction.
- Prediction and model APIs returned data usable by the dashboard Prediction &
  LSTM page.

Hardware-valid rows after the verification pass continued to increase while the
gateway stayed running:

| Sensor | Rows | Latest hardware timestamp |
|---|---:|---|
| S1 | `1,052` | `2026-06-03 20:07:06.204237+00` |
| S2 | `1,032` | `2026-06-03 20:07:06.204237+00` |

Limitations:

- This is a final-candidate/preliminary hardware model, not a final thesis
  claim.
- The dataset is still short and has limited variation.
- Validation and test windows are small (`12` and `14`).
- Both baselines outperform the LSTM, so the model is not selected as final
  evidence yet.
- Historical XY-MD02 automatic-report/noisy-bus risk applied to earlier
  collection windows; that issue is operator-confirmed resolved and should not
  be cited as a current active blocker.

## M10H Larger Overnight Hardware Dataset Training

Status: passed as larger hardware training candidate.

Date: 2026-06-04 local time.

Dataset source:

```text
Source filter: hardware
Quality filter: valid
Sensors: S1 ambient/reference and S2 hotspot/exhaust
Target: future_temperature_s2, five minutes ahead
Resample interval: 1 minute
Window size: 30
Horizon: 5 minutes
Split: chronological only
Epochs: 50
Batch size: 32
```

Collection status before training:

| Sensor | Rows | First hardware timestamp | Latest hardware timestamp |
|---|---:|---|---|
| S1 | `2,602` | `2026-06-03 01:17:26.270295+00` | `2026-06-04 01:00:38.723418+00` |
| S2 | `2,582` | `2026-06-03 05:39:31.022051+00` | `2026-06-04 01:00:38.723418+00` |

The latest hardware row was only seconds behind database `now()`, so collection
was still running during the training run.

Dry dataset check:

| Item | Count |
|---|---:|
| Raw S1/S2 rows loaded | `5,198` |
| Usable one-minute resampled rows | `496` |
| Labeled rows after five-minute target shift | `491` |
| Chronological train rows | `343` |
| Chronological validation rows | `73` |
| Chronological test rows | `75` |
| Train windows | `313` |
| Validation windows | `43` |
| Test windows | `45` |

Training command:

```powershell
$env:ML_ALLOWED_SOURCES = "hardware"
$env:ML_ALLOWED_QUALITY_STATUSES = "valid"
$env:ML_EPOCHS = "50"
$env:ML_BATCH_SIZE = "32"
./.venv/Scripts/python.exe -m ml_worker.cli train --activate
```

Generated active model:

```text
v20260604_010335
```

Generated local artifacts, not committed:

```text
ml-worker/models/ems_s2_lstm_v20260604_010335/model.keras
ml-worker/models/ems_s2_lstm_v20260604_010335/feature_scaler.pkl
ml-worker/models/ems_s2_lstm_v20260604_010335/target_scaler.pkl
ml-worker/models/ems_s2_lstm_v20260604_010335/model_metadata.json
ml-worker/reports/ems_s2_lstm_v20260604_010335/training_report.json
```

Training metrics in Celsius:

| Model | RMSE | MAE | MAPE |
|---|---:|---:|---:|
| LSTM | `1.2221` | `0.7854` | `2.3028%` |
| Persistence baseline | `0.9654` | `0.3752` | `1.0638%` |
| Moving-average baseline | `0.9805` | `0.3954` | `1.1244%` |

Evaluation command:

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli evaluate
```

Evaluation metrics in Celsius:

| Model | RMSE | MAE | MAPE |
|---|---:|---:|---:|
| LSTM | `1.4902` | `0.9049` | `2.6127%` |
| Persistence baseline | `1.1839` | `0.4763` | `1.3287%` |
| Moving-average baseline | `1.2384` | `0.5074` | `1.4180%` |

Inference command:

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli infer
```

Backend bridge result:

| Item | Value |
|---|---|
| Predicted S2 temperature | `32.7849 C` |
| Predicted for | `2026-06-04T01:08:00Z` |
| Backend submission | Passed |
| Backend prediction id | `2` |
| Thermal status | `anomali` |
| Final status | `anomali` |
| Stale | `false` |

Backend/database verification:

- `model_versions`: two models total, one active model `v20260604_010335`.
- `model_metrics`: two rows total, latest row for `v20260604_010335`.
- `baseline_results`: persistence and moving-average rows exist for the new
  model.
- `predictions/latest`: returned the submitted non-stale prediction.

Hardware-valid rows after verification continued to increase:

| Sensor | Rows | Latest hardware timestamp |
|---|---:|---|
| S1 | `2,628` | `2026-06-04 01:04:58.726242+00` |
| S2 | `2,608` | `2026-06-04 01:04:58.726242+00` |

Interpretation:

- Larger overnight hardware dataset was sufficient for normal minimum-row
  training without small-dataset ratio overrides.
- LSTM still underperforms persistence and moving-average baselines, so it is
  not yet strong final thesis model evidence.
- Keep collecting hardware data and investigate feature/target behavior before
  final model claim.

## M10I Periodic Active-Model Inference Loop

Status: passed.

Date: 2026-06-04 local time.

Purpose:

```text
Keep backend predictions fresh without retraining.
Use active model only.
Use source=hardware and quality_status=valid readings only.
Submit each result to POST /api/v1/ml/predictions.
```

Implemented command:

```powershell
./.venv/Scripts/python.exe -m ml_worker.cli infer-loop
```

Runtime configuration:

| Variable | Value |
|---|---|
| `ML_ALLOWED_SOURCES` | `hardware` |
| `ML_ALLOWED_QUALITY_STATUSES` | `valid` |
| `ML_INFER_INTERVAL_SECONDS` | `60` |
| Active model | `v20260604_010335` |

Validation process:

- Started `infer-loop` in background without printing token values.
- Left Raspberry Pi gateway, PostgreSQL, backend, and frontend running.
- Waited more than two minutes.
- Confirmed repeated backend prediction inserts.
- Confirmed dashboard summary exposed latest non-stale `prediction_thermal_status`.
- Confirmed gateway hardware row counts continued increasing.

Observed prediction updates:

| Prediction id | Predicted for | Predicted S2 | Backend thermal status | Final status |
|---:|---|---:|---|---|
| `3` | `2026-06-04T01:42:00+00:00` | `31.6347 C` | `waspada` | `waspada` |
| `4` | `2026-06-04T01:43:00+00:00` | `31.6157 C` | `waspada` | `waspada` |
| `5` | `2026-06-04T01:44:00+00:00` | `31.5987 C` | `waspada` | `waspada` |
| `6` | `2026-06-04T01:45:00+00:00` | `31.5839 C` | `waspada` | `waspada` |

Dashboard summary after loop validation:

```text
prediction_thermal_status=waspada
latest_prediction_id=6
latest_prediction_stale=false
overall_current_thermal_status=anomali
```

Gateway continuity:

- Raspberry Pi gateway process remained alive.
- Gateway log continued showing `POST /api/v1/readings` HTTP `201 Created`.
- Hardware-valid row counts increased during inference-loop validation.

Limitations:

- This task adds continuous inference only; it does not retrain the model.
- The active model still inherits M10H limitations: LSTM underperforms
  persistence and moving-average baselines.
