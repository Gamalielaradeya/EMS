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
| `8` | Alert, Telegram, and Events Logs | Not started |
| `9` | Layout Upload and Sensor Marker | Not started |
| `10` | Final Integration, Testing, and Bab 4 Evidence | Not started |

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
