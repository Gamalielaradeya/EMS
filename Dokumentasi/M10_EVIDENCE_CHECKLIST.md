# M10 Evidence Checklist - EMS Thermal LSTM

## Purpose

This checklist separates the completed local integration baseline from the
final Bab 4 evidence that must be captured on the intended hardware and ML
workstation.

Evidence rules:

- Simulator readings and development-manual prediction payloads are valid only
  for local API integration smoke tests.
- Final thesis evidence must use XY-MD02 hardware readings from Raspberry Pi.
- Final LSTM metrics must come from a real TensorFlow-trained artifact using
  the documented leakage-safe pipeline.
- Screenshots must not expose gateway tokens, internal tokens, Telegram bot
  tokens, chat IDs, or database passwords.

## M10A Local Integration Baseline

| Flow | Local result | Final-evidence boundary |
|---|---|---|
| PostgreSQL migration and seed | Passed on isolated Docker database | Capture final schema/query evidence |
| Backend health | Passed on `APP_PORT=8081` | Capture deployment health response |
| Gateway delivery | Passed with `python -m gateway.cli send-test` | Repeat with Raspberry Pi and XY-MD02 |
| Readings to latest/history | Passed with simulator payload | Repeat with hardware readings |
| SSE delivery | Passed for all seven event types | Capture browser/API evidence |
| Prediction bridge | Passed with ML-worker development payload | Repeat with real active model |
| Backend classification | Passed for `anomali` | Capture normal, waspada, and anomali cases |
| Telegram disabled handling | Passed with skipped notification log | Capture enabled Telegram delivery |
| Layout image and markers | Passed with generated small PNG and S1/S2 ratios | Capture final testbed image |
| Settings persistence | Passed with validation and masked-secret protection | Capture safe masked settings view |
| Frontend routes | Passed for all six routes with no console errors | Capture screenshots listed below |

## Screenshot Checklist

- [ ] Physical server testbed with S1 ambient and S2 hotspot placement.
- [ ] Raspberry Pi, USB RS485 adapter, and XY-MD02 wiring.
- [ ] Dashboard overview with current S1/S2 values and gateway status.
- [ ] Sensors & Readings page with history chart and bounded table.
- [ ] Prediction & LSTM page with active model, forecast, metrics, and chart.
- [ ] Layout page with active testbed image and S1/S2 markers.
- [ ] Events & Logs anomaly tab with at least one thermal event.
- [ ] Events & Logs notification tab with sent Telegram record.
- [ ] Events & Logs system-log tab with operational records.
- [ ] Settings page with masked secrets and configured thresholds.
- [ ] Telegram alert received in the intended chat.

## API Evidence Checklist

- [ ] `GET /api/v1/health` returns healthy backend and database state.
- [ ] `POST /api/v1/readings` accepts authenticated Raspberry Pi hardware data.
- [ ] `GET /api/v1/readings/latest` returns S1 and S2 hardware readings.
- [ ] `GET /api/v1/readings/history` returns bounded filtered history.
- [ ] `POST /api/v1/gateway/status` updates gateway and sensor health state.
- [ ] `GET /api/v1/events` emits realtime reading and status events.
- [ ] `POST /api/v1/ml/predictions` requires internal authentication.
- [ ] Real inference submission creates backend-owned thermal classification.
- [ ] `GET /api/v1/anomaly-events` returns the expected thermal event.
- [ ] `GET /api/v1/notification-logs` returns the Telegram delivery outcome.
- [ ] `GET /api/v1/layout` returns the final image and ratio markers.
- [ ] `GET /api/v1/settings` masks configured sensitive values.

## Database Evidence Checklist

Capture query output without exposing secrets:

```sql
SELECT gateway_code, status, last_seen_at FROM gateways;
SELECT sensor_code, sensor_role, sensor_health_status, last_seen_at FROM sensors ORDER BY sensor_code;
SELECT COUNT(*) FROM sensor_readings;
SELECT sensor_id, recorded_at, temperature, humidity, source, quality_status
FROM sensor_readings
ORDER BY recorded_at DESC
LIMIT 10;
SELECT version, is_active, trained_at FROM model_versions ORDER BY created_at DESC;
SELECT predicted_temperature, actual_temperature, thermal_status, final_status, predicted_for
FROM predictions
ORDER BY created_at DESC
LIMIT 10;
SELECT status, severity, detected_at FROM anomaly_events ORDER BY detected_at DESC LIMIT 10;
SELECT channel, status, sent_at, created_at FROM notification_logs ORDER BY created_at DESC LIMIT 10;
SELECT source, level, message, created_at FROM system_logs ORDER BY created_at DESC LIMIT 20;
SELECT sensor_id, position_x, position_y FROM layout_devices ORDER BY sensor_id;
```

- [ ] Migration and seed evidence captured.
- [ ] Hardware reading rows captured.
- [ ] Active model row captured.
- [ ] Prediction, anomaly, notification, and system-log rows captured.
- [ ] Layout marker ratio rows captured.

## Gateway Hardware Checklist - M10B

- [ ] Confirm Raspberry Pi Python environment and gateway config.
- [ ] Confirm USB RS485 adapter appears in `diagnose ports`.
- [ ] Read raw XY-MD02 registers for the configured slave IDs.
- [ ] Validate configured `diagnose sensor --sensor-code S1`.
- [ ] Validate configured `diagnose sensor --sensor-code S2`.
- [ ] Run gateway loop and capture backend hardware readings.
- [ ] Disconnect one sensor and capture graceful trouble behavior.
- [ ] Interrupt backend temporarily and verify bounded buffer plus replay.
- [ ] Verify heartbeat and gateway recovery behavior.

## ML Training Evidence Checklist

- [x] Install documented TensorFlow dependency on the ML workstation.
- [x] Validate real TensorFlow train, evaluate, and infer runtime with a clearly
  labeled generated development dataset.
- [ ] Train from hardware readings with `source=hardware` and
  `quality_status=valid`.
- [ ] Record one-minute resampling, chronological split sizes, and window count.
- [ ] Capture persistence and moving-average baseline results in Celsius.
- [ ] Capture LSTM RMSE, MAE, and MAPE in Celsius units.
- [ ] Capture generated artifacts: `model.keras`, feature scaler, target scaler,
  and metadata JSON.
- [ ] Activate the selected model and capture active-model API evidence.
- [ ] Submit real inference output through the backend bridge.

Development-only TensorFlow runtime details are recorded in
`Dokumentasi/M10C_TENSORFLOW_TRAINING_LOG.md`. They prove runtime wiring, not
final thesis model quality.

## Alert and Telegram Checklist

- [ ] Keep Telegram disabled during dry runs and confirm safe skipped logs.
- [ ] Configure Telegram through protected settings without exposing secrets.
- [ ] Run protected Telegram test and capture received message.
- [ ] Trigger waspada or anomali from real inference and capture the alert.
- [ ] Verify cooldown suppresses duplicate notification delivery.
- [ ] Verify stale predictions stay in history but do not send alerts.

## Next Step

Resume Milestone `10B` when Raspberry Pi hardware is available. After hardware
data collection, run final TensorFlow training for Bab 4 evidence.
