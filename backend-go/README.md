# Backend Go

Go REST API for EMS Thermal LSTM.

Milestone `2A` implements the core gateway ingestion and reading query surface.
Milestone `2B` adds dashboard summary, SSE delivery, timeout status checks, and
system logs. Milestone `7` adds protected prediction integration, backend-owned
final classification, status event history, model query APIs, and Telegram
notification. Status event history is stored through the existing internal
`anomaly_events` table and `/api/v1/anomaly-events` route; those names are kept
stable as API/database contracts. Milestone `8` adds filtered system logs and
masked settings management. Milestone `9` adds one active testbed layout image
and ratio-based sensor markers.

Alert events are transition-based: actual S1/S2 threshold changes are Alarm,
non-stale S2 prediction changes are Pre-Alarm, and sensor/gateway health changes
are Trouble. Recovery is recorded when a source returns to normal.

## Database Migrations

PostgreSQL migrations are stored in `migrations/` and run in filename order:

```text
001_create_core_tables.sql
002_create_sensor_tables.sql
003_create_ml_tables.sql
004_create_event_notification_tables.sql
005_create_layout_settings_logs.sql
006_seed_initial_data.sql
007_add_alert_event_categories.sql
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
TELEGRAM_API_BASE_URL=https://api.telegram.org
UPLOAD_DIR=./uploads
```

`APP_PORT` is configurable. If local port `8080` is occupied, use another port:

```powershell
$env:APP_PORT = "8081"
go run ./cmd/server
```

## Implemented Endpoints

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
POST /api/v1/ml/predictions
GET  /api/v1/predictions/latest
GET  /api/v1/predictions/history
GET  /api/v1/model-versions
GET  /api/v1/model-versions/{id}
PUT  /api/v1/model-versions/{id}/activate
GET  /api/v1/model-metrics/latest
GET  /api/v1/model-comparison/latest
GET  /api/v1/anomaly-events
GET  /api/v1/notification-logs
GET  /api/v1/system-logs
GET  /api/v1/settings
PUT  /api/v1/settings/{key}
POST /api/v1/notifications/test
GET  /api/v1/layout
GET  /api/v1/layout/images/{fileName}
POST /api/v1/layout/image
PUT  /api/v1/layout/devices/{sensorCode}
DELETE /api/v1/layout/devices/{sensorCode}
```

Gateway write endpoints require `Authorization: Bearer <gateway-token>`.
Prediction submission, model activation, settings updates, and notification
testing accept
`Authorization: Bearer <internal-or-admin-token>` using `INTERNAL_API_TOKEN` or
`ADMIN_TOKEN`.

Layout write endpoints use the same internal-or-admin token. Uploaded runtime
files are written below ignored `UPLOAD_DIR`, default `./uploads`, with
generated filenames. Supported image types are PNG, JPG, JPEG, and WebP up to
5 MB.

Upload one active layout and place S1:

```bash
curl -X POST http://localhost:8080/api/v1/layout/image \
  -H "Authorization: Bearer change-admin-token" \
  -F "name=Server Testbed Layout" \
  -F "image=@./testbed-layout.png"

curl -X PUT http://localhost:8080/api/v1/layout/devices/S1 \
  -H "Authorization: Bearer change-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"label":"S1 Ambient","position_x":0.25,"position_y":0.40}'
```

Settings reads mask configured Telegram secrets. Send a new secret only when
changing it; do not send the masked placeholder back to the update endpoint.

Operational APIs support bounded filtering:

```bash
curl "http://localhost:8080/api/v1/anomaly-events?status=anomali&limit=50"
curl "http://localhost:8080/api/v1/notification-logs?status=skipped&limit=50"
curl "http://localhost:8080/api/v1/system-logs?source=backend&level=warning&limit=50"
curl http://localhost:8080/api/v1/settings
```

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

Submit a development-only prediction payload for API validation:

```bash
curl -X POST http://localhost:8080/api/v1/ml/predictions \
  -H "Authorization: Bearer change-internal-api-token" \
  -H "Content-Type: application/json" \
  -d '{"model_version":"dev-manual","target_sensor_code":"S2","predicted_temperature":31.4,"input_window_start_at":"2026-06-01T17:25:00+07:00","input_window_end_at":"2026-06-01T17:55:00+07:00","predicted_for":"2026-06-01T18:00:00+07:00"}'
```

Manual payloads validate API behavior only. Thesis evidence must come from a
real trained model and hardware readings.

The backend emits these SSE event types:

```text
reading.latest
gateway.status
sensor.trouble
system.log
prediction.latest
anomaly.created
notification.sent
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
