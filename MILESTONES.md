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
| `4` | Frontend Foundation and Dashboard Shell | Not started |
| `5` | Sensors and Readings Realtime Dashboard | Not started |
| `6` | ML Worker Training Pipeline | Not started |
| `7` | ML Inference and Prediction Integration | Not started |
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
