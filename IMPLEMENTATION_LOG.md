# EMS Thermal LSTM Implementation Log

## Milestone -1 - Documentation Lock

Status: Done

Documentation-only work:

- Locked canonical documentation path to `Dokumentasi/`.
- Recorded approved architecture and security decisions.
- Aligned runbook and technical documentation.
- Created project control files.
- Did not create implementation code.

## Milestone 0 - Repository Foundation

Status: Done

Foundation-only work:

- Created root `.gitignore`.
- Created root `.env.example` with dummy-safe local values.
- Created PostgreSQL-only `docker-compose.yml`.
- Created `backend-go/`, `frontend-dashboard/`, `gateway-rpi/`, `ml-worker/`, and `scripts/` skeleton folders.
- Added placeholder README files for each skeleton folder.
- Updated root README with project structure and PostgreSQL foundation instructions.
- Did not create database migrations.
- Did not add backend, frontend, gateway, or ML business logic.
- Did not install dependencies or start runtime services.

## Milestone 1 - Database Migrations and Seed

Status: Done

Database-only work:

- Created six ordered SQL migrations under `backend-go/migrations/`.
- Created all 16 required PostgreSQL tables.
- Added indexes, status constraints, numeric range constraints, and foreign keys.
- Added reading dedupe key `(gateway_id, sensor_id, recorded_at)`.
- Added partial unique indexes for one active model and one active layout.
- Added idempotent seed data for gateway `raspi-gateway-01`, sensors S1/S2, and 16 settings.
- Left `api_tokens` empty because the backend must bootstrap a hashed token from `.env`.
- Added PowerShell and Bash migration helpers.
- Did not implement backend API handlers or other application logic.

## Milestone 2A - Backend Core API

Status: Done

Backend-only work:

- Initialized the Go module inside `backend-go/`.
- Added environment configuration with safe local defaults and required database and gateway-token checks.
- Added PostgreSQL connection pooling.
- Added layered repository, service, handler, router, and middleware packages.
- Added consistent JSON success and error responses.
- Added configured CORS and request logging middleware.
- Added gateway Bearer authentication using SHA-256 token hashes stored in `api_tokens`.
- Added `GET /api/v1/health`.
- Added protected `POST /api/v1/readings` with S1 ambient and S2 hotspot validation.
- Added protected `POST /api/v1/gateway/status`.
- Added sensor list, detail, and metadata update endpoints.
- Added latest and history reading endpoints with bounded pagination.
- Added duplicate-safe insert behavior for `(gateway_id, sensor_id, recorded_at)`.
- Added last-seen updates for gateway and sensor readings.
- Added focused validation tests and backend setup documentation.
- Did not add frontend, gateway Python, ML Worker, Telegram, layout, prediction, dashboard-summary, or SSE implementation.

## Milestone 2B - Backend Realtime and System Core

Status: Done

Backend-only work:

- Added safe dashboard summary aggregation for gateway, latest readings, optional model/prediction/metrics state, Telegram enabled state, daily counts, and recent events.
- Added SSE hub and public `GET /api/v1/events`.
- Added SSE event delivery for successful readings ingestion, gateway status updates, sensor trouble reports, and system logs.
- Added reserved SSE constants for future prediction, anomaly, and notification events without implementing prediction logic early.
- Added configurable offline checker interval with a 30-second default.
- Added timeout handling based on `sensor_timeout_minutes`, default 5 minutes.
- Added transition-only gateway offline and sensor trouble updates so checker cycles do not write duplicate logs.
- Added `system_logs` repository support and used it for timeout transitions and reported trouble transitions.
- Added reusable admin/internal Bearer token middleware for future sensitive routes without adding those routes early.
- Aligned `go.mod` to installed Go `1.24.3` and pinned compatible `pgx v5.8.0`.
- Did not add gateway Python, frontend, ML prediction callback, Telegram, layout, or future sensitive endpoint implementation.

## Milestone 3 - Gateway Diagnostic and Delivery

Status: Done

Gateway-only work:

- Added the installable `gateway-rpi` Python package with a `src/gateway/`
  layout and canonical `python -m gateway.cli ...` command surface.
- Added YAML configuration, environment overrides, dummy-safe examples, and
  validation for hardware mode, S1 ambient, S2 hotspot, retry limits, and runtime
  paths.
- Added USB serial-port discovery, Modbus RTU holding-register diagnostics,
  configured sensor reads, and clear RS485 troubleshooting output.
- Added sensor reading validation for temperature `0-80` and humidity `0-100`.
- Added payload builders matching backend readings and gateway-status contracts.
- Added Bearer-authenticated HTTP delivery with one retry only.
- Added bounded JSONL failed-payload storage and throttled replay batches after
  successful realtime delivery.
- Added separate heartbeat/status reporting with trouble updates and a default
  60-second heartbeat interval.
- Added a basic periodic hardware run loop that continues when one sensor or the
  backend is unavailable.
- Added local file logging, Raspberry Pi setup documentation, and a
  documentation-only systemd service example.
- Added focused standard-library unit tests without adding frontend, ML Worker,
  Telegram, or backend API changes.

## Milestone 4 - Frontend Foundation and Dashboard Shell

Status: Done

Frontend-only work:

- Initialized the React, Vite, and TypeScript application inside
  `frontend-dashboard/`.
- Added Tailwind CSS, shadcn/ui-compatible configuration and primitives, and
  Chart.js dependencies for planned realtime dashboard charts.
- Added a restrained monitoring-first layout with the locked six-menu sidebar,
  responsive mobile menu, and compact system topbar.
- Added API, SSE, gateway placeholder, model placeholder, and last-update
  topbar status.
- Added environment-configurable API and SSE clients with a finite API timeout
  and safe connection cleanup.
- Added typed dashboard-summary support for `GET /api/v1/dashboard/summary`.
- Added SSE listeners for the backend realtime event contract and refreshes on
  received events.
- Added reusable status badges plus loading, empty, and unavailable states.
- Added intentional placeholder pages for Sensors & Readings, Prediction &
  LSTM, Layout, Events & Logs, and Settings.
- Added Dashboard summary cards, sensor cards, chart placeholders, metric
  placeholders, and recent-event regions without production dummy data.
- Did not add full realtime tables/charts, frontend M5 detail, ML Worker,
  Telegram, layout editing, gateway changes, or backend changes.

## Milestone 5 - Sensors and Readings Realtime Dashboard

Status: Done

Frontend-only work:

- Extended the typed frontend API client for `GET /api/v1/sensors`,
  `GET /api/v1/readings/latest`, and bounded `GET /api/v1/readings/history`.
- Reused the existing dashboard-summary endpoint for gateway state, S1/S2
  summary cards, today count, and last-update display.
- Added shared SSE event revision handling so `reading.latest`,
  `gateway.status`, `sensor.trouble`, and `system.log` refresh active sensor
  views without manual reload.
- Replaced Dashboard chart placeholders with bounded Chart.js temperature and
  humidity history charts.
- Replaced the Sensors & Readings placeholder with live S1/S2 cards, gateway and
  SSE state, sensor metadata, history filters, history charts, and responsive
  history table/card views.
- Added `sensor_code`, `from`, `to`, `quality_status`, and `limit` query filter
  controls plus manual refresh.
- Preserved loading, empty, unavailable, and disconnected states without
  production dummy data.
- Did not add prediction/model UI detail, layout editing, Telegram settings, ML
  Worker code, gateway changes, or backend API changes.

## Milestone 6 - ML Worker Training Pipeline

Status: Done

ML-worker-only work:

- Added the installable `ml-worker` Python package with canonical
  `python -m ml_worker.cli train`, `evaluate`, and `infer` commands.
- Added environment configuration, PostgreSQL connection handling, local file
  logging, dummy-safe `.env.example`, and ignored artifact/report directories.
- Added filtered `sensor_readings` loading for S1 ambient and S2 hotspot data
  with hardware-plus-valid defaults and configurable development sources.
- Added one-minute mean resampling, bounded interpolation/forward fill, range
  validation, S1/S2 pivoting, and five-minute future S2 target generation.
- Added chronological `70%` / `15%` / `15%` splitting with train-only feature
  and target scaler fitting.
- Added 30-point sequence windows, Celsius-unit persistence and moving-average
  baselines, TensorFlow LSTM construction, early stopping, Celsius-unit LSTM
  evaluation, and artifact persistence.
- Added PostgreSQL writers for `model_versions`, `prediction_runs`,
  `model_metrics`, `baseline_results`, and `system_logs`.
- Added basic saved-model evaluation and local-only inference. Backend
  prediction submission remains deferred to Milestone `7`.
- Added lazy TensorFlow loading so lightweight development checks remain usable
  without the large runtime dependency. TensorFlow setup is documented
  separately in `requirements-tensorflow.txt`.
- Did not add backend prediction integration, frontend prediction UI, Telegram,
  layout changes, gateway changes, or Milestone `7` work.

## Milestone 7 - Prediction Bridge and Alerts

Status: Done

Cross-component work:

- Added protected backend `POST /api/v1/ml/predictions` using
  `INTERNAL_API_TOKEN` or `ADMIN_TOKEN`.
- Added backend-owned thermal classification from database thresholds and
  trouble-priority final status assembly.
- Added prediction persistence with optional model linkage, clearly logged
  development-manual fallback, nearby actual S2 matching, and stale TTL
  handling.
- Added prediction/model/metric/comparison/anomaly/notification read APIs and
  protected model activation.
- Added anomaly creation for `waspada`, `anomali`, and `trouble` outcomes plus
  `prediction.latest`, `anomaly.created`, and `notification.sent` SSE events.
- Added Telegram settings loading, safe disabled/config-missing behavior,
  sender integration, sensor-plus-status cooldown checks, notification logs,
  and protected notification testing.
- Extended ML-worker inference so loaded model output is submitted through the
  backend bridge with the internal Bearer token.
- Added mocked ML bridge tests without requiring TensorFlow.
- Replaced the frontend Prediction & LSTM placeholder with live prediction,
  model-version, activation, Celsius metric, baseline comparison, chart,
  history, model-not-ready, no-prediction, and API-unavailable states.
- Kept full Events & Logs frontend work, Layout work, and remaining Settings
  work deferred. Telegram core was intentionally pulled forward by the approved
  Milestone `7` scope.

## Milestone 8 - Alert, Telegram, and Events Logs

Status: Done

Backend and frontend work:

- Added masked settings contracts, repository persistence, service validation,
  and handlers for public reads plus protected allowlisted updates.
- Added masked-secret overwrite protection so frontend placeholder values
  cannot replace configured Telegram credentials.
- Added cross-setting validation for
  `threshold_normal_max < threshold_anomaly_min`.
- Added public filtered `GET /api/v1/system-logs` with source, level, time,
  limit, and offset filters.
- Reused Milestone `7` anomaly-event, notification-log, Telegram sender, and
  protected notification-test behavior instead of duplicating alert logic.
- Replaced the Events & Logs placeholder with three focused operational tabs,
  relevant filters, refresh, responsive tables, and safe loading, empty, and
  unavailable states.
- Replaced the Settings placeholder with grouped thermal thresholds, Telegram
  settings, blank secret-update fields, masked configured-state indicators,
  notification testing, and read-only gateway, app, and ML configuration.
- Kept Layout upload, sensor markers, and drag positioning deferred to
  canonical Milestone `9`.

## Milestone 9 - Layout Upload and Sensor Marker

Status: Done

Backend and frontend work:

- Added active-layout model, repository, service, handler, and route layers.
- Added public `GET /api/v1/layout` plus controlled
  `GET /api/v1/layout/images/{fileName}` serving without exposing filesystem
  paths.
- Added protected layout image upload with configurable ignored `UPLOAD_DIR`,
  generated filenames, 5 MB limit, file-extension and decoded-image checks,
  and PNG, JPG, JPEG, and WebP support.
- Pinned `golang.org/x/image v0.36.0` for WebP decoding because newer releases
  require Go `1.25`; local project toolchain remains Go `1.24.3`.
- Added protected marker upsert and delete endpoints for S1/S2 only, with
  required `0-1` ratio validation and backend system logs.
- Replaced Layout placeholder with restrained upload, map, placement, telemetry,
  no-layout, loading, and unavailable states.
- Added click-to-place plus drag-save marker interactions and a lightweight
  read-only Dashboard layout preview.
- Kept layout scope to one active server-testbed image; no enterprise site,
  floor, or multi-layout management was added.

## Milestone 10A - Local Full Integration Test and Evidence Checklist

Status: Done

Validation and documentation only:

- Ran the complete local stack against an isolated PostgreSQL validation
  database on Docker host port `55432`.
- Applied all migrations and seed data, launched the backend with
  `APP_PORT=8081`, and launched the frontend on `5173`.
- Exercised gateway `send-test`, authenticated readings, latest/history reads,
  gateway status transitions, and all seven SSE event types.
- Submitted a development-manual ML-worker prediction through the protected
  backend bridge without installing TensorFlow.
- Exercised backend-owned anomaly classification, Telegram-disabled skipped
  notification logging, layout image upload and serving, S1/S2 ratio markers,
  settings persistence, sensitive-value masking, and filtered logs.
- Validated the six frontend routes against populated local state with no
  browser console errors.
- Added `Dokumentasi/M10_EVIDENCE_CHECKLIST.md` to separate completed local
  integration smoke from the final Raspberry Pi, TensorFlow, Telegram, and
  Bab 4 evidence work.
- Added no application feature, refactor, dependency, or runtime script.

## Milestone 10B - Raspberry Pi Hardware Validation and Evidence

Status: Blocked - waiting hardware access

Documentation-only blocker record:

- Started PostgreSQL on Docker host port `55432` and applied migrations plus
  seed data.
- Started backend on `APP_PORT=8081` because local port `8080` remained
  occupied.
- Confirmed backend health locally and through laptop ZeroTier addresses
  `10.147.17.201:8081` and `10.147.20.201:8081`.
- Started frontend locally on `5173`.
- Could not continue Raspberry Pi preparation because hardware is not
  physically available and no reachable Pi SSH target exists.
- Did not run Raspberry Pi OS, Python, git, serial-permission, USB RS485,
  Modbus, sensor, gateway delivery, or live-loop checks.
- Added `Dokumentasi/M10B_HARDWARE_VALIDATION_LOG.md` with exact continuation
  checklist.
- Added no application code, dependency, or configuration-secret change.

## Milestone 10C - TensorFlow Setup and ML Training Runtime Validation

Status: Done - development validation only

Runtime validation and documentation work:

- Reused ignored `ml-worker/.venv` with Python `3.10.11`.
- Installed documented TensorFlow requirements with
  `python -m pip install --no-cache-dir -r requirements-tensorflow.txt`.
- Confirmed TensorFlow `2.20.0` CPU runtime import and dependency health.
- Created isolated PostgreSQL database `ems_thermal_lstm_m10c_validation`.
- Inserted `5,040` generated simulator readings tagged as M10C
  development-only data.
- Ran real TensorFlow LSTM training with `2` epochs for bounded runtime
  validation, then ran saved-model evaluation and backend-submitted inference.
- Confirmed model artifacts, Celsius metrics, baseline metrics, active
  `model_versions`, `model_metrics`, `baseline_results`, successful
  `prediction_runs`, backend prediction persistence, and ML system logs.
- Removed generated artifacts, report, isolated database, backend executable,
  and temporary logs after recording evidence.
- Added `Dokumentasi/M10C_TENSORFLOW_TRAINING_LOG.md`.
- Added no algorithm, application code, or final thesis model result.
- Kept Milestone `10B` blocked until Raspberry Pi hardware is available.

## Milestone 10B - Raspberry Pi Hardware Validation Stage One

Status: Blocked - raw Modbus and laptop inbound backend access

Hardware validation attempt:

- Confirmed passwordless SSH to Raspberry Pi at `gamaliel@192.168.18.33`.
- Confirmed hostname `lmnop`, Debian GNU/Linux 13 `trixie`, Python `3.13.5`,
  and git `2.47.3`.
- Confirmed gateway repository at `/home/gamaliel/EMS/gateway-rpi` on commit
  `dfe966a`.
- Confirmed gateway virtual environment and CLI help are usable.
- Confirmed FT232 USB RS485 adapter at `/dev/ttyUSB0` and `gamaliel` belongs
  to the `dialout` group.
- Created/updated ignored Raspberry Pi gateway `config.yaml` and `.env` with
  the approved backend URL, serial settings, and S1 slave ID without printing
  tokens.
- Confirmed laptop PostgreSQL, migrations, backend on `APP_PORT=8081`, local
  backend health, LAN self-health, and frontend startup.
- Recorded Raspberry Pi undervoltage risk: `vcgencmd get_throttled` returned
  `0x50000` and kernel logs showed repeated undervoltage messages.
- Ran `diagnose ports`; it detected `/dev/ttyS0` and `/dev/ttyUSB0`.
- Ran safe raw Modbus reads for slave ID `1` at addresses `0` and `1`; both
  returned no response after retries.
- Ran a documented slave ID `2` address `0` check; it also returned no
  response.
- Confirmed no process was holding `/dev/ttyUSB0` after diagnostics.
- Pi-to-laptop backend health and gateway `send-test` timed out against
  `192.168.18.9:8081`; non-admin firewall rule creation was denied.
- Did not run configured S1 sensor diagnostic or live gateway loop because raw
  Modbus reads did not succeed.
- Added no application code, dependency, feature, or secret-bearing config to
  the repository.

## Milestone 10B - Raspberry Pi Hardware Validation Stage Two

Status: Partial - S1 hardware validated, S2 pending

Gateway compatibility and hardware validation:

- Implemented minimal gateway support for Modbus function `04` input registers.
- Added `modbus.register_type`, per-register `register_type`, and
  `MODBUS_REGISTER_TYPE` environment override support.
- Added `diagnose raw --register-type holding|input` while keeping the
  canonical raw command working through config defaults.
- Kept function `03` holding-register support for older/alternate devices.
- Updated `config.example.yaml` to use XY-MD02 function `04` input registers by
  default.
- Updated `gateway-rpi/README.md` with input-register configuration guidance.
- Added gateway unit coverage proving configured input registers are used by the
  sensor reader.
- Deployed the gateway patch to the Raspberry Pi working tree for validation.
- Confirmed Pi-to-laptop backend health over LAN after firewall access was
  available.
- Configured ignored Pi `config.yaml`/`.env` for S1 slave ID `1`, input
  registers at addresses `1` and `2`, `/dev/ttyUSB0`, 9600 8N1, and the backend
  URL without printing tokens.
- Disabled S2 only in the ignored Pi local config for this validation because
  only one XY-MD02 sensor was connected.
- Confirmed raw S1 input-register read returned `raw=[352, 547]`.
- Confirmed configured S1 diagnostic produced about `35.1 C` and `54.6 %`.
- Confirmed gateway `send-test` reached the backend and stored simulator
  transport rows.
- Ran the gateway loop for about 3 minutes and stored `19` S1 hardware rows.
- Confirmed backend latest readings, dashboard summary API, `reading.latest`
  SSE events, and `gateway.status` SSE events.
- Recorded Raspberry Pi undervoltage and `pymodbus` receive-buffer cleanup
  warnings as hardware risks to revisit before final evidence.
- Kept M10B Partial, not Done, because S2 hotspot hardware was not connected or
  validated.

## Milestone 10B - Raspberry Pi Hardware Validation Stage Three

Status: Partial - two-sensor one-shot validated, loop blocked

Hardware validation retry:

- Updated active network context to laptop `192.168.10.112` and Raspberry Pi
  `192.168.10.108`; old `192.168.18.x` addresses are no longer current.
- Started laptop backend on `APP_PORT=8081` and confirmed it listened on
  `0.0.0.0:8081` / `[::]:8081`.
- Used PostgreSQL host port `15432` because Windows excluded TCP range
  `55365-55464`, which includes requested ports `55432` and `55433`.
- Confirmed Pi-to-backend health at
  `http://192.168.10.112:8081/api/v1/health`.
- Updated ignored Pi `config.yaml`/`.env` for the new backend URL, both sensors
  enabled, input-register function `04`, `/dev/ttyUSB0`, and 9600 8N1 without
  printing tokens.
- Confirmed raw diagnostics for both sensors:
  S1 slave `1` `raw=[256, 425]`; S2 slave `2` `raw=[253, 440]`.
- Confirmed configured diagnostics for both sensors:
  S1 about `25.5 C` / `42.4 %`; S2 about `25.2 C` / `44.0 %`.
- Confirmed one runtime cycle sent both S1 and S2 hardware readings to backend.
- Confirmed `GET /api/v1/readings/latest` and Dashboard summary API returned
  both sensors as `source=hardware`.
- Attempted the canonical 3-5 minute gateway loop, but it stalled on serial
  receive-buffer cleanup and did not insert repeated two-sensor rows.
- Tried a defensive serial-buffer flush patch, but hardware retry still failed;
  reverted the patch locally and on the Pi, so no unvalidated code fix was kept.
- Recorded the likely hardware/config blocker as unsolicited ASCII/junk bytes
  flooding the RTU receive buffer, plus persistent undervoltage
  `throttled=0x50005`.

## Milestone 10B - Raspberry Pi Hardware Validation Stabilization

Status: Done

Gateway stabilization and hardware validation:

- Recorded new manual evidence that repeated raw Modbus reads were stable:
  S1 succeeded `15/15` attempts with values around `[253-255, 447-453]`;
  S2 succeeded `15/15` attempts with values around `[253-255, 484-515]`.
- Identified the difference between stable diagnostics and the blocked run
  loop: diagnostics open a client for one short transaction, while the run loop
  reads both enabled sensors back-to-back through one persistent client.
- Added `modbus.inter_read_delay_ms` with a default of `300` ms and
  `MODBUS_INTER_READ_DELAY_MS` environment override.
- Updated the run loop to read enabled sensors sequentially and wait between
  sensor transactions, including after a sensor read failure, without changing
  retry, buffer, heartbeat, or backend API behavior.
- Updated `config.example.yaml`, gateway README, and gateway tests for the
  inter-sensor delay.
- Deployed the gateway patch to Raspberry Pi `lmnop` at `192.168.10.108`.
- Configured ignored Pi local config for laptop backend
  `http://192.168.10.112:8081/api/v1`, `/dev/ttyUSB0`, function `04` input
  registers, 9600 8N1, both sensors enabled, and `300` ms inter-read delay
  without printing or committing tokens.
- Confirmed post-patch diagnostics for both sensors and ran the canonical
  gateway loop for about `190` seconds.
- Confirmed repeated backend inserts for both S1 and S2 hardware readings and
  active gateway/sensor state.
- Marked M10B Done because the hardware path S1/S2 -> Raspberry Pi gateway ->
  backend -> PostgreSQL -> latest/dashboard summary is now validated.
- Kept `vcgencmd get_throttled=0x50000` as historical undervoltage/throttling
  risk and recommended clean reboot plus recheck before longer final evidence
  capture.

## Milestone 10B - XY-MD02 Auto-Report Disable Attempt

Status: Blocked - automatic reporting persists

Documentation and operator validation only:

- Stopped any Raspberry Pi gateway run-loop before serial tests.
- Sent safe ASCII `STOP` variants to `/dev/ttyUSB0` using Raspberry Pi
  `pyserial`: `STOP\r\n`, `STOP\n`, `STOP`, and a repeated burst including
  `STOP\r`.
- Did not print tokens or modify committed gateway configuration.
- Confirmed the RS485 receive buffer remained noisy after STOP attempts; a
  10-second quiet check still queued `4080` bytes containing ASCII
  temperature/humidity reports.
- Attempted the requested repeated raw-read validation, but the first S1 raw
  diagnostic hung on the noisy serial stream before 20 attempts could complete.
- Stopped the leftover diagnostic process and confirmed no intended gateway
  collection loop was left running.
- Did not start the 10-minute or 2-hour collection and did not mark the final
  hardware dataset valid.
- Added no source-code mitigation because ignoring ASCII bytes in software is
  not the root fix for final thesis evidence.
- Next required hardware action: power-cycle/isolate each XY-MD02, disable
  ordinary UART/common-protocol automatic reporting or set passive Modbus RTU
  mode, verify idle bus silence, then rerun raw reads and long collection.

## Milestone 10E - Best-Effort Hardware Collection

Status: Completed - zero new rows

Documentation and operator validation only:

- Kept the known XY-MD02 ASCII auto-report issue in scope as an unresolved
  blocker and labeled the run as preliminary/noisy, not final thesis evidence.
- Reused the running local EMS stack: PostgreSQL on Docker host port `15432`,
  backend on `APP_PORT=8081`, and frontend on `localhost:5173`.
- Confirmed local backend health and Raspberry Pi access to
  `http://192.168.18.9:8081/api/v1/health`.
- Confirmed Raspberry Pi gateway config pointed to laptop backend
  `192.168.18.9`, `/dev/ttyUSB0`, input registers, S1 slave `1`, S2 slave `2`,
  and `500 ms` inter-read delay.
- Started `python -m gateway.cli run` on the Raspberry Pi in the background
  with log `logs/best_effort_20260603T122434Z.log`.
- Ran a simple local monitor for about `1 hour 56 minutes` with 24 samples.
- Did not change application code, gateway config, secrets, or committed
  runtime files.
- Did not run final TensorFlow training.
- The gateway process stayed alive, so no watchdog restarts were performed.
- Hardware-valid row counts did not advance: S1 remained `273`, S2 remained
  `253`.
- Gateway logs repeatedly showed `/readings` and `/gateway/status` HTTP
  timeouts plus XY-MD02 ASCII receive-buffer cleanup.
- Left the gateway running at the end because the requested mode was
  best-effort collection while the operator was away.

## Milestone 10F - Hardware LSTM Candidate Training

Status: Completed - preliminary/final-candidate only

Documentation and ML runtime validation only:

- Did not stop the Raspberry Pi gateway, backend, frontend, or PostgreSQL.
- Used only `source=hardware` and `quality_status=valid` rows.
- Confirmed live hardware-valid counts before training: S1 `1,025`, S2
  `1,005`, latest `2026-06-03 20:02:36.200559+00`.
- Confirmed paired minute data was sufficient for a small candidate after
  one-minute resampling: `218` usable minute rows and `213` labeled rows after
  the five-minute target shift.
- Used chronological split only with small-dataset overrides:
  `ML_MINIMUM_RESAMPLED_ROWS=120`, train/validation/test ratio `0.60/0.20/0.20`,
  `ML_EPOCHS=30`, and `ML_BATCH_SIZE=32`.
- Trained and activated hardware candidate model `v20260603_200711`.
- Generated local artifacts under `ml-worker/models/ems_s2_lstm_v20260603_200711`
  and `ml-worker/reports/ems_s2_lstm_v20260603_200711`; these were not staged.
- Ran evaluate and infer.
- Submitted inference through the protected backend ML bridge; backend stored
  prediction id `1` with predicted S2 `32.1194 C`, `thermal_status=anomali`,
  and `final_status=anomali`.
- Verified API/database state: one active model, one metrics row, persistence
  and moving-average baseline rows, and a non-stale latest prediction.
- Recorded limitations: short dataset, small validation/test windows, and
  baselines outperforming the LSTM, so this is not final Bab 4 model quality
  evidence.

## Milestone 10H - Larger Hardware LSTM Candidate Training

Status: Completed - larger hardware candidate only

Documentation and ML runtime validation only:

- Did not stop the Raspberry Pi gateway, backend, frontend, or PostgreSQL.
- Used only `source=hardware` and `quality_status=valid` rows.
- Confirmed live collection before training: S1 `2,602`, S2 `2,582`, latest
  hardware timestamp `2026-06-04 01:00:38.723418+00`, only seconds behind
  database time.
- Confirmed larger paired dataset after overnight collection: `5,198` raw rows,
  `496` usable one-minute rows, and `491` labeled rows after five-minute target
  shift.
- Used default chronological split ratios with `ML_EPOCHS=50` and
  `ML_BATCH_SIZE=32`.
- Trained and activated hardware candidate model `v20260604_010335`.
- Generated local artifacts under `ml-worker/models/ems_s2_lstm_v20260604_010335`
  and `ml-worker/reports/ems_s2_lstm_v20260604_010335`; these were not staged.
- Ran evaluate and infer.
- Submitted inference through the protected backend ML bridge; backend stored
  prediction id `2` with predicted S2 `32.7849 C`, `thermal_status=anomali`,
  and `final_status=anomali`.
- Verified API/database state: two model versions total, active model
  `v20260604_010335`, latest metrics row, persistence and moving-average
  baseline rows, and latest non-stale prediction.
- Recorded limitation: despite larger dataset, persistence and moving-average
  baselines still outperform the LSTM, so this remains candidate evidence, not
  final model quality evidence.

## Milestone 10G - Current Thermal Status Classification

Status: Completed

Backend and frontend integration:

- Added current actual-reading thermal classification to dashboard summary
  without changing gateway or ML Worker behavior.
- Kept `sensor_health_status` separate from `current_thermal_status`.
- Added per-sensor `current_thermal_status` for S1 and S2 latest readings.
- Added `overall_current_thermal_status` and
  `overall_current_thermal_source_sensor`, using severity order
  `anomali > waspada > normal` and preferring S2 on equal severity because S2
  is the hotspot/prediction target.
- Added `prediction_thermal_status` only when a latest non-stale prediction is
  available.
- Reused settings thresholds `threshold_normal_max` and
  `threshold_anomaly_min`, with existing defaults `30.0` and `32.0`.
- Did not change existing LSTM prediction classification, Telegram behavior,
  anomaly-event creation, gateway code, or ML Worker code.
- Updated dashboard UI labels so sensor health, current thermal status, and
  prediction status are visually and textually distinct.
- Restarted backend on `APP_PORT=8081` after the build and confirmed the
  Raspberry Pi gateway continued posting readings successfully.
