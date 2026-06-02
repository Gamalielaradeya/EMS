# M10C TensorFlow Training Runtime Validation Log - EMS Thermal LSTM

## Status

**Done - development validation only**

This run validates TensorFlow installation and real LSTM pipeline execution on
the laptop. It is not final thesis model evidence because Raspberry Pi hardware
readings are not available. Milestone `10B` remains blocked.

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
- This run does not unblock Milestone `10B`.
- This run is not final Bab 4 LSTM model evidence.
- Resume Milestone `10B` when hardware becomes available.
- After collecting hardware readings, run final training and capture final
  metrics, artifacts, API results, and screenshots.
