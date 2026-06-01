# Backend Go

Go REST API for EMS Thermal LSTM.

Milestone `2A` implements the core gateway ingestion and reading query surface.
Milestone `2B` adds dashboard summary, SSE delivery, timeout status checks, system
logs, and reusable admin/internal authentication middleware. Later milestones add
prediction integration, final thermal classification, anomaly events, and Telegram
notification.

## Database Migrations

PostgreSQL migrations are stored in `migrations/` and run in filename order:

```text
001_create_core_tables.sql
002_create_sensor_tables.sql
003_create_ml_tables.sql
004_create_event_notification_tables.sql
005_create_layout_settings_logs.sql
006_seed_initial_data.sql
```

The seed creates:

- Gateway `raspi-gateway-01`.
- Sensor `S1` as ambient/reference.
- Sensor `S2` as hotspot/exhaust.
- Default EMS settings.

The seed does not store a plaintext gateway token. On backend startup,
`GATEWAY_TOKEN` is hashed with SHA-256 and bootstrapped into `api_tokens` for
gateway `raspi-gateway-01`. API responses and logs never expose the full token.

## Local Database Setup

From the repository root:

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
./scripts/run-migrations-docker.ps1
```

To rerun seed data only:

```powershell
./scripts/seed-docker.ps1
```

For a local PostgreSQL installation with `psql` available:

```powershell
$env:DATABASE_URL = "postgres://ems_user:change-postgres-password@localhost:5432/ems_thermal_lstm?sslmode=disable"
./scripts/run-migrations.ps1
```

TimescaleDB is optional only. These migrations target standard PostgreSQL.

If port `5432` is occupied, set `POSTGRES_PORT=55432` for Docker and update the
host port inside `DATABASE_URL`.

## Run Backend

From `backend-go/`:

```powershell
Copy-Item .env.example .env
go run ./cmd/server
```

Required backend environment values:

```text
DATABASE_URL
GATEWAY_TOKEN
```

Optional values have local defaults:

```text
APP_ENV=development
APP_PORT=8080
FRONTEND_ORIGIN=http://localhost:5173
ACTIVE_GATEWAY_CODE=raspi-gateway-01
ADMIN_TOKEN=change-admin-token
INTERNAL_API_TOKEN=change-internal-api-token
BACKEND_OFFLINE_CHECK_INTERVAL_SECONDS=30
```

`APP_PORT` is configurable. If local port `8080` is occupied, use another port:

```powershell
$env:APP_PORT = "8081"
go run ./cmd/server
```

## Milestone 2A and 2B Endpoints

```text
GET  /api/v1/health
GET  /api/v1/events
GET  /api/v1/dashboard/summary
POST /api/v1/readings
POST /api/v1/gateway/status
GET  /api/v1/sensors
GET  /api/v1/sensors/{sensorCode}
PUT  /api/v1/sensors/{sensorCode}
GET  /api/v1/readings/latest
GET  /api/v1/readings/history
```

Gateway write endpoints require `Authorization: Bearer <gateway-token>`.
The prepared `AdminOrInternalBearerAuth` middleware accepts `ADMIN_TOKEN` or
`INTERNAL_API_TOKEN` for future sensitive write endpoints. Those future routes are
not added during Milestone `2B`.

## Curl Examples

Health:

```bash
curl http://localhost:8080/api/v1/health
```

Submit S1 and S2 hardware readings:

```bash
curl -X POST http://localhost:8080/api/v1/readings \
  -H "Authorization: Bearer change-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id":"raspi-gateway-01","recorded_at":"2026-06-01T18:00:00+07:00","source":"hardware","readings":[{"sensor_code":"S1","sensor_role":"ambient","temperature":27.4,"humidity":63.2},{"sensor_code":"S2","sensor_role":"hotspot","temperature":30.8,"humidity":58.5}]}'
```

Submit a gateway heartbeat:

```bash
curl -X POST http://localhost:8080/api/v1/gateway/status \
  -H "Authorization: Bearer change-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id":"raspi-gateway-01","status":"active","reported_at":"2026-06-01T18:01:00+07:00","message":"Gateway heartbeat","sensors":[{"sensor_code":"S1","status":"normal"},{"sensor_code":"S2","status":"normal"}]}'
```

Read latest values and filtered history:

```bash
curl http://localhost:8080/api/v1/readings/latest
curl "http://localhost:8080/api/v1/readings/history?sensor_code=S2&limit=100"
```

Read dashboard summary and connect to SSE:

```bash
curl http://localhost:8080/api/v1/dashboard/summary
curl -N http://localhost:8080/api/v1/events
```

The backend emits these Milestone `2B` SSE event types:

```text
reading.latest
gateway.status
sensor.trouble
system.log
```

The offline checker runs every `BACKEND_OFFLINE_CHECK_INTERVAL_SECONDS`, default
`30`. It applies the `sensor_timeout_minutes` database setting, default `5`, and
writes transition-only system logs when a gateway becomes offline or a sensor
becomes trouble.

## Verification

```powershell
gofmt -w .
go test ./...
go build ./cmd/server
```
