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
- [x] `POST /api/v1/readings` accepts authenticated Raspberry Pi hardware data.
- [x] `GET /api/v1/readings/latest` returns S1 and S2 hardware readings.
- [ ] `GET /api/v1/readings/history` returns bounded filtered history.
- [x] `POST /api/v1/gateway/status` updates gateway and sensor health state.
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
- [x] Hardware reading rows captured.
- [ ] Active model row captured.
- [ ] Prediction, anomaly, notification, and system-log rows captured.
- [ ] Layout marker ratio rows captured.

## Gateway Hardware Checklist - M10B

- [x] Stage-one SSH to Raspberry Pi validated at `gamaliel@192.168.18.33`
  (`lmnop`).
- [x] Stage-three SSH to Raspberry Pi validated at `gamaliel@192.168.10.108`
  (`lmnop`) after Wi-Fi change.
- [x] Confirm Raspberry Pi Python environment and gateway config.
- [x] Confirm USB RS485 adapter appears in `diagnose ports`.
- [x] Record Raspberry Pi undervoltage warning as hardware risk.
- [x] Attempt safe raw XY-MD02 reads for one connected sensor.
- [x] Add and validate gateway support for XY-MD02 function `04` input
  registers.
- [x] Validate S1 raw input-register read with slave ID `1`, address `1`,
  count `2`.
- [x] Validate configured `diagnose sensor --sensor-code S1` for one connected
  XY-MD02 sensor.
- [x] Run gateway loop and capture backend S1 hardware readings.
- [x] Verify `reading.latest` and `gateway.status` SSE during one-sensor run.
- [x] Read raw XY-MD02 registers for configured slave IDs `1` and `2` once.
- [x] Validate configured `diagnose sensor --sensor-code S2` once.
- [x] Capture one backend hardware row for S1 and one backend hardware row for
  S2 through `GatewayRuntime.run_once()`.
- [x] Run gateway loop with both S1 and S2 connected for 3-5 minutes and capture backend
      hardware readings.
- [ ] Disconnect one sensor and capture graceful trouble behavior.
- [ ] Interrupt backend temporarily and verify bounded buffer plus replay.
- [ ] Verify heartbeat and gateway recovery behavior.

Stabilization result on 2026-06-03: done. After adding a configurable
`300 ms` inter-sensor Modbus delay, both S1 and S2 passed raw/configured
diagnostics and the canonical loop ran for about `190` seconds with repeated
hardware inserts for both sensors. Full evidence is recorded in
`Dokumentasi/M10B_HARDWARE_VALIDATION_LOG.md`.

## ML Training Evidence Checklist

- [x] Install documented TensorFlow dependency on the ML workstation.
- [x] Validate real TensorFlow train, evaluate, and infer runtime with a clearly
  labeled generated development dataset.
- [x] Attempt final hardware dataset collection with Raspberry Pi gateway,
  backend, PostgreSQL, and dashboard running.
- [x] Attempt XY-MD02 `STOP` command over Raspberry Pi `/dev/ttyUSB0` to
  disable ordinary UART/common-protocol automatic reporting.
- [ ] Disable XY-MD02 ordinary UART/common-protocol automatic reporting on both
  sensors and rerun long passive Modbus RTU collection.
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

Disable XY-MD02 ordinary UART/common-protocol automatic reporting on both
sensors, verify the RS485 bus is quiet when idle, then rerun long hardware
collection before final TensorFlow training.

The hardware dataset collection attempt started on 2026-06-03 with Pi gateway
PID `1309` and was stopped after the long run became unstable. It reached S1
`273` and S2 `253` hardware-valid rows, with latest values S1 `26.10 C` /
`51.90 %` and S2 `27.30 C` / `43.40 %` at
`2026-06-03 07:42:26.761374+00`. These rows prove short hardware delivery, but
they are not accepted as the final thesis ML dataset because gateway logs showed
ordinary ASCII temperature/humidity reports on the RS485 bus and Modbus RTU ID
mismatch errors (`id=32`, `id=161`, `id=163`). Next hardware step: send the
ordinary-protocol `STOP` command, or equivalent vendor configuration command, on
both XY-MD02 sensors; confirm no automatic ASCII output while idle; then rerun
the 2+ hour passive Modbus RTU collection.

Follow-up STOP attempt on 2026-06-03 did not clear the bus. `STOP\r\n`,
`STOP\n`, `STOP`, and a repeated STOP burst were sent over `/dev/ttyUSB0`, but a
10-second quiet check still found `4080` queued bytes containing repeated ASCII
temperature/humidity reports. The requested repeated raw-read validation could
not complete because the first raw diagnostic hung on the noisy serial stream.
No 10-minute or 2-hour collection was started. Next step remains hardware/device
configuration: power-cycle and isolate each XY-MD02, stop automatic reporting or
set passive Modbus RTU mode, confirm idle bus silence, then rerun collection.
