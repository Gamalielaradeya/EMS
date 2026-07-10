# EMS Thermal LSTM Milestones

Canonical plan source: `Dokumentasi/10_Codex_Implementation_Runbook.md`.

| Milestone | Name | Status |
|---|---|---|
| `-1` | Documentation Lock | Done |
| `0` | Repository Foundation | Done |
| `1` | Database Migrations and Seed | Done |
| `2A` | Backend Core API | Done |
| `2B` | Backend Realtime and System Core | Done |
| `3` | Gateway Diagnostic and Delivery | Done |
| `4` | Frontend Foundation and Dashboard Shell | Done |
| `5` | Sensors and Readings Realtime Dashboard | Done |
| `6` | ML Worker Training Pipeline | Done |
| `7` | Prediction Bridge and Alerts | Done |
| `8` | Alert, Telegram, and Events Logs | Done |
| `9` | Layout Upload and Sensor Marker | Done |
| `10A` | Local Full Integration Test and Evidence Checklist | Done |
| `10B` | Raspberry Pi Hardware Validation and Final Bab 4 Evidence | Partial - XY-MD02 auto-report/bus noise resolved; remaining Bab 4 evidence, Telegram, final capture |
| `10C` | TensorFlow Setup and ML Training Runtime Validation | Done - development validation only |

## Milestone -1 Completion

- Canonical docs path locked to `Dokumentasi/`.
- Runbook verified and aligned.
- Approved architecture decisions recorded in `DECISIONS.md`.
- Technical documents amended before implementation.
- No backend, frontend, gateway, or ML implementation code created.

## Milestone 0 Completion

- Root `.gitignore` added.
- Root `.env.example` added with dummy-safe values.
- PostgreSQL-only `docker-compose.yml` added.
- Backend, frontend, gateway, ML worker, and scripts skeleton folders added.
- Each skeleton folder contains documentation only.
- No migrations, dependencies, or business logic added.

## Milestone 1 Completion

- Added six ordered PostgreSQL migration files.
- Added all 16 required tables with documented indexes and constraints.
- Added sensor reading dedupe key `(gateway_id, sensor_id, recorded_at)`.
- Added partial unique indexes for one active model and one active layout.
- Added idempotent gateway, S1, S2, and default settings seeds.
- Added local and Docker migration helper scripts.
- Validated migrations twice against a clean PostgreSQL validation database.
- Confirmed no PUE, energy, or cooling tables exist.

## Milestone 2A Completion

- Added Go module and layered backend structure for config, repository, service, handler, router, and middleware.
- Added PostgreSQL connection and health check.
- Added configured CORS and request logging middleware.
- Added gateway Bearer token authentication backed by hashed `api_tokens`.
- Added validated readings ingestion with S1 ambient and S2 hotspot enforcement.
- Added duplicate-safe readings insert using the database dedupe constraint.
- Added gateway heartbeat persistence and sensor health updates.
- Added sensor listing, sensor detail, sensor metadata update, latest readings, and reading history endpoints.
- Added focused validation tests and verified the approved API surface against PostgreSQL.

## Milestone 2B Completion

- Added safe `GET /api/v1/dashboard/summary` for empty and populated database states.
- Added SSE hub and public `GET /api/v1/events`.
- Added `reading.latest`, `gateway.status`, `sensor.trouble`, and `system.log` SSE delivery.
- Reserved future SSE event constants for prediction, anomaly, and notification integration.
- Added configurable backend offline checker with 30-second default interval.
- Added transition-only gateway offline and sensor trouble updates with `system_logs`.
- Added reusable admin/internal Bearer token middleware for future sensitive endpoints.
- Aligned the Go module with local Go `1.24.3` and compatible `pgx v5.8.0`.
- Validated runtime behavior against PostgreSQL on backend port `8081`.

Milestone `3` requires explicit user approval.

## Milestone 3 Completion

- Added the installable Raspberry Pi Python gateway package under `gateway-rpi/`.
- Added YAML configuration with environment overrides and dummy-safe examples.
- Added canonical CLI commands for port discovery, raw Modbus reads, configured
  sensor reads, backend `send-test`, and the periodic gateway loop.
- Added XY-MD02 S1 ambient and S2 hotspot validation with temperature `0-80` and
  humidity `0-100` limits.
- Added Bearer-authenticated HTTP readings and gateway-status delivery with one
  retry only.
- Added bounded JSONL buffering and throttled replay that runs after successful
  realtime delivery.
- Added sensor trouble reporting, separate 60-second heartbeat delivery, and
  local file logging.
- Added Raspberry Pi setup documentation and a documentation-only systemd service
  example.
- Validated diagnostics safely without requiring a connected USB RS485 adapter.

Milestone `4` requires explicit user approval.

## Milestone 4 Completion

- Added the React, Vite, and TypeScript frontend package under
  `frontend-dashboard/`.
- Added Tailwind CSS, shadcn/ui-compatible setup, and Chart.js dependencies.
- Added the monitoring-first application layout with the locked six-menu
  sidebar and responsive mobile menu.
- Added compact topbar state for API, SSE, gateway, model, and last update.
- Added environment-configurable API and SSE clients.
- Added reusable status badges and loading, empty, and unavailable states.
- Added intentional placeholder pages for the five post-Dashboard menus.
- Added a Dashboard shell backed by `GET /api/v1/dashboard/summary` with
  placeholder chart regions reserved for Milestone `5`.
- Validated graceful behavior while the backend is unavailable.

Milestone `5` requires explicit user approval.

## Milestone 5 Completion

- Connected Dashboard and Sensors & Readings pages to existing backend sensor
  endpoints without backend API changes.
- Added bounded S1/S2 temperature and humidity history charts using Chart.js.
- Added live latest-reading cards, gateway state, sensor health state, and last
  update timestamps.
- Added sensor metadata display and responsive readings history table/card
  views.
- Added `sensor_code`, `from`, `to`, `quality_status`, and `limit` history
  filters plus manual refresh.
- Reused one SSE connection for `reading.latest`, `gateway.status`,
  `sensor.trouble`, and `system.log` refreshes.
- Validated offline, empty, populated, filtered, realtime, and responsive
  frontend states against a temporary PostgreSQL-backed backend.

Milestone `6` requires explicit user approval.

## Milestone 6 Completion

- Added the installable Python ML worker package under `ml-worker/`.
- Added canonical `train`, `evaluate`, and local-only `infer` CLI commands.
- Added PostgreSQL dataset loading with configurable source and quality filters.
- Added S1/S2 one-minute resampling, bounded missing-value handling, range
  validation, and five-minute future S2 target construction.
- Added chronological `70%` / `15%` / `15%` splitting and train-only feature
  and target scaler fitting.
- Added 30-point LSTM windows plus persistence and moving-average baselines
  evaluated in Celsius.
- Added lazy TensorFlow dependency handling and the documented two-step
  lightweight/full dependency installation path.
- Added LSTM artifact writing and PostgreSQL persistence for model versions,
  prediction runs, model metrics, baseline results, and system logs.
- Added focused tests for resampling, chronological splitting, scaler leakage
  prevention, windowing, metric calculation, and baseline calculation.
- Validated the preprocessing pipeline against development-only simulator data
  without treating simulator metrics as thesis results.

Milestone `7` requires explicit user approval.

## Milestone 7 Completion

- Added protected `POST /api/v1/ml/predictions` using the configured internal or
  admin Bearer token.
- Added backend-owned threshold classification, trouble-priority final status,
  stale-prediction handling, nearby actual S2 matching, and prediction
  persistence.
- Added prediction, anomaly, notification, model-version, model-metric, and
  baseline-comparison read APIs plus protected model activation.
- Added `prediction.latest`, `anomaly.created`, and `notification.sent` SSE
  delivery.
- Added Telegram settings loading, sender integration, cooldown checks,
  transition-safe notification logging, and protected notification testing.
- Added ML-worker inference submission to the protected backend bridge without
  requiring TensorFlow during lightweight tests.
- Replaced the Prediction & LSTM frontend placeholder with live model,
  prediction, metric, comparison, chart, activation, empty, and unavailable
  states.
- Validated simulator/manual payloads as development-only API evidence, not
  thesis results.

Milestone `8` requires explicit user approval.

## Milestone 8 Completion

- Added public filtered `GET /api/v1/system-logs` alongside the existing
  anomaly-event and notification-log read APIs.
- Added public masked `GET /api/v1/settings` and protected
  `PUT /api/v1/settings/{key}` with allowlisted validation.
- Added masked-secret overwrite protection and threshold ordering validation.
- Preserved Telegram-disabled notification testing as a safe skipped outcome.
- Replaced the Events & Logs frontend placeholder with filtered anomaly,
  notification, and system-log tabs.
- Replaced the Settings frontend placeholder with grouped thermal, Telegram,
  and read-only runtime configuration panels.
- Kept layout upload, layout markers, and sensor drag positioning deferred to
  canonical Milestone `9`.

Milestone `9` requires explicit user approval.

## Milestone 9 Completion

- Added public active-layout reads and controlled uploaded-image serving.
- Added protected layout image upload with PNG, JPG, JPEG, WebP, and 5 MB
  validation.
- Added protected S1/S2 marker create, update, and delete endpoints.
- Stored marker coordinates as responsive ratios from `0` to `1`.
- Added transition-safe backend system logs for layout image and marker changes.
- Replaced Layout placeholder with one-layout upload, empty, unavailable,
  telemetry, click-to-place, and drag-marker workspace.
- Added lightweight read-only Dashboard layout preview when an active layout
  exists.
- Kept enterprise site, floor, and multi-layout management out of scope.

## Milestone 10A Completion

- Validated the full local stack against an isolated PostgreSQL database on
  Docker host port `55432`.
- Validated migrations and seed, backend on overridden `APP_PORT=8081`,
  frontend on `5173`, gateway `send-test`, and ML-worker development
  prediction submission through the protected backend bridge.
- Validated readings, SSE, gateway state, backend-owned prediction
  classification, anomaly records, Telegram-disabled skipped logs, layout
  upload and markers, settings persistence, and filtered logs.
- Validated all six frontend routes against populated local API state with no
  browser console errors.
- Added `Dokumentasi/M10_EVIDENCE_CHECKLIST.md` for Bab 4 evidence capture.
- Kept simulator readings and manual predictions explicitly limited to local
  integration validation, not thesis evidence.

## Milestone 10B Stage-One Blocker (historical; later superseded)

- Raspberry Pi SSH access is now available at `gamaliel@192.168.18.33`
  (`lmnop`).
- Laptop EMS preparation passed: PostgreSQL migration and seed, backend health
  on `APP_PORT=8081`, frontend startup, and laptop LAN self-health on
  `192.168.18.9:8081`.
- Raspberry Pi environment checks passed: Debian 13, Python `3.13.5`, git
  `2.47.3`, FT232 USB RS485 adapter detected at `/dev/ttyUSB0`, and user is in
  `dialout`.
- Raspberry Pi undervoltage was recorded with `vcgencmd get_throttled`
  returning `0x50000`; this is a hardware risk for final evidence.
- At stage one, M10B was blocked because safe raw Modbus reads for slave ID `1`
  at addresses `0` and `1` returned no response, and a slave ID `2` check also
  returned no response (later fixed via function `04` / two-sensor path).
- At stage one, M10B was also blocked because the Pi cannot reach
  `http://192.168.18.9:8081/api/v1/health`; laptop backend is healthy locally,
  but Pi-side curl times out and non-admin firewall-rule creation was denied
  (later network/backend path was fixed in subsequent stages).
- S1/S2 sensor diagnostics, hardware reading insert, dashboard realtime update,
  and the 3-5 minute gateway run-loop were not run or claimed.
- Continue from `Dokumentasi/M10B_HARDWARE_VALIDATION_LOG.md` after fixing
  RS485/sensor response and laptop inbound backend access.

## Milestone 10B Partial Hardware Validation

- Added gateway compatibility for Modbus function `04` input registers while
  preserving function `03` holding-register support.
- Updated gateway configuration, diagnostics, sensor reader, README, and tests
  for `register_type` / input-register operation.
- Confirmed Pi-to-laptop backend connectivity:
  `http://192.168.18.9:8081/api/v1/health` returned HTTP `200` from the
  Raspberry Pi.
- Confirmed S1 raw input-register diagnostic with slave ID `1`, address `1`,
  count `2`: `raw=[352, 547]`.
- Confirmed configured S1 diagnostic: temperature about `35.1 C`, humidity
  about `54.6 %`.
- Confirmed gateway `send-test` reached the backend; those rows remain
  simulator transport evidence only.
- Ran gateway loop for about 3 minutes with S2 disabled in ignored Pi local
  config because only one sensor was connected.
- Confirmed `19` S1 hardware rows stored, gateway active state, `reading.latest`
  and `gateway.status` SSE events, and Dashboard summary API showing S1 hardware
  data.
- Kept M10B partial, not done, because S2 hotspot hardware was not connected or
  validated.
- Kept Raspberry Pi undervoltage warning as a hardware risk for final evidence.

## Milestone 10B Two-Sensor Retry

- Updated network context to laptop `192.168.10.112` and Raspberry Pi
  `192.168.10.108`; old `192.168.18.x` addresses are no longer current.
- Docker could not bind PostgreSQL host ports `55432` or `55433` because
  Windows excluded TCP range `55365-55464`; this validation run used host port
  `15432` for PostgreSQL while backend still ran on `APP_PORT=8081`.
- Confirmed Pi-to-laptop backend health:
  `http://192.168.10.112:8081/api/v1/health` returned HTTP `200`.
- Confirmed both raw input-register diagnostics:
  S1 slave `1` returned `raw=[256, 425]`; S2 slave `2` returned
  `raw=[253, 440]`.
- Confirmed configured diagnostics:
  S1 about `25.5 C` / `42.4 %`; S2 about `25.2 C` / `44.0 %`.
- Confirmed one successful runtime cycle inserted S1 and S2 hardware rows:
  S1 `25.6 C` / `42.9 %`, S2 `25.1 C` / `44.4 %`.
- Confirmed `GET /api/v1/readings/latest` and Dashboard summary API returned
  both S1 and S2 as `source=hardware`.
- Full M10B remains not done because the canonical 3-5 minute
  `python -m gateway.cli run` loop stalled on serial ASCII/junk receive-buffer
  flooding before repeated two-sensor delivery could be captured.
- Raspberry Pi undervoltage persisted with `throttled=0x50005`.

## Milestone 10C Completion

- Installed and imported TensorFlow `2.20.0` inside ignored ML-worker virtual
  environment using Python `3.10.11`.
- Re-ran ML-worker compile, unit, and CLI-help checks.
- Trained, evaluated, and inferred with a real CPU TensorFlow LSTM runtime
  against an isolated PostgreSQL validation database.
- Used `5,040` generated simulator readings only for development validation.
- Confirmed artifact creation, Celsius metrics, baselines, model metadata,
  prediction runs, active model persistence, backend bridge submission, and ML
  system logs.
- Recorded results in `Dokumentasi/M10C_TENSORFLOW_TRAINING_LOG.md`.
- Did not treat generated-data metrics as thesis evidence and did not unblock
  Milestone `10B`.

## Milestone 10B Stabilization Completion

- Added configurable gateway inter-sensor Modbus delay with a `300 ms` default.
- Kept Modbus reads sequential and avoided overlapping serial transactions.
- Confirmed manual repeated raw diagnostics were stable before the fix:
  S1 `15/15` and S2 `15/15` successful raw reads.
- Deployed the gateway stabilization patch to Raspberry Pi `lmnop`.
- Confirmed Pi gateway compile and unit checks still pass.
- Confirmed two-sensor diagnostics after the patch:
  S1 `raw=[255, 444]`, S2 `raw=[257, 449]`, S1 about `25.6 C / 44.5 %`,
  and S2 about `25.7 C / 45.0 %`.
- Ran the canonical gateway loop for about `190` seconds with both sensors
  enabled.
- Confirmed repeated backend delivery with HTTP `201` readings and heartbeat
  status responses.
- Confirmed PostgreSQL hardware rows for both sensors, latest API readings,
  gateway active state, and Dashboard summary returning S1/S2 hardware data.
- Kept Raspberry Pi `throttled=0x50000` as historical undervoltage/throttling
  risk; recommend a clean reboot and recheck before long final evidence runs.

## Milestone 10B Final Collection Blocker (historical)

- Attempted to disable XY-MD02 ordinary UART/common-protocol automatic
  reporting from the Raspberry Pi over `/dev/ttyUSB0`.
- Sent safe ASCII variants `STOP\r\n`, `STOP\n`, `STOP`, plus a repeated
  STOP burst at 9600 baud, 8 data bits, no parity, 1 stop bit.
- The RS485 receive buffer remained noisy after the STOP attempts; after a
  10-second quiet check, `4080` bytes were still queued with temperature and
  humidity ASCII text.
- A requested repeated raw-read validation could not complete because the first
  raw diagnostic hung on the noisy serial stream; the leftover diagnostic
  process was stopped.
- No 10-minute or 2-hour collection was started during that blocked period, and
  no final ML dataset was marked valid at that time.

## Milestone 10B Auto-Report Resolution

- Operator-confirmed: the XY-MD02 ordinary UART/common-protocol automatic
  reporting / RS485 bus-noise issue is **resolved**.
- Historical STOP-attempt failures and noisy-bus collection notes above remain
  as the record of the earlier blocked period; they are no longer the active
  collection blocker.
- M10B remains **partial** only for remaining thesis evidence work (not bus
  noise): longer clean hardware collection if still needed for final model
  narrative, enabled Telegram evidence, disconnect/buffer recovery checks,
  and final Bab 4 screenshots/API/DB capture.
