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
