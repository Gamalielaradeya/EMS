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
