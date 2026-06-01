# Backend Go

Go REST API foundation for EMS Thermal LSTM.

Planned responsibilities:

- Receive validated gateway readings.
- Store and query PostgreSQL data.
- Provide REST API and SSE events.
- Own final status classification, anomaly events, and Telegram decisions.

Implementation begins in Milestone `2`. Database migrations begin in Milestone `1`.

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

The seed does not store a plaintext gateway token. Backend token hashing and bootstrap begin in Milestone `2`.

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
