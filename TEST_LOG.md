# EMS Thermal LSTM Test Log

## Milestone -1 - Documentation Lock

Status: Done

Verification scope:

- Passed: canonical documentation path references use `Dokumentasi/`; no obsolete documentation-path references remain in Markdown files.
- Passed: runbook exists at `Dokumentasi/10_Codex_Implementation_Runbook.md`.
- Passed: approved decisions are recorded in `DECISIONS.md` and aligned across technical documents.
- Passed: canonical gateway and ML CLI references use `gateway.cli` and `ml_worker.cli`.
- Passed: root folder inspection confirms no backend, frontend, gateway, or ML implementation folders were created.
- Note: Git metadata was not present during the Documentation Lock verification.

No build, dependency installation, migration, or runtime test executed during Documentation Lock.

## Milestone 0 - Repository Foundation

Status: Done

Safe non-runtime verification:

- Passed: `docker compose config` resolves the PostgreSQL-only service definition.
- Passed: root folder listing contains `backend-go/`, `frontend-dashboard/`, `gateway-rpi/`, `ml-worker/`, and `scripts/`.
- Passed: skeleton component folders contain README files only.
- Passed: `backend-go/migrations/` does not exist yet.
- Passed: `.env` is ignored and `.env.example` remains trackable.
- Passed: sensitive values in `.env.example` are dummy placeholders or empty.

No dependency installation, container startup, database migration, application build, or runtime test executed during Milestone `0`.

## Milestone 1 - Database Migrations and Seed

Status: Done

Commands and results:

- Passed: `docker compose config --quiet`.
- Initial `docker compose up -d postgres` attempt was blocked because host port `5432` was already allocated.
- Passed: PostgreSQL started with temporary host override `$env:POSTGRES_PORT='55432'`.
- Passed: created clean validation database `ems_thermal_lstm_m1_validation`.
- Passed: `./scripts/run-migrations-docker.ps1 -DatabaseName ems_thermal_lstm_m1_validation -DatabaseUser ems_user`.
- Passed: reran the same migration command; schema and seed remained idempotent.
- Passed: `./scripts/seed-docker.ps1 -DatabaseName ems_thermal_lstm_m1_validation -DatabaseUser ems_user`.

Database assertions:

- Passed: exactly 16 required tables exist.
- Passed: gateway seed count is 1 for `raspi-gateway-01`.
- Passed: sensor seeds are S1 ambient slave `1` and S2 hotspot slave `2`.
- Passed: settings seed count is 16.
- Passed: `api_tokens` remains empty; plaintext token is not seeded.
- Passed: reading dedupe rejects duplicate `(gateway_id, sensor_id, recorded_at)`.
- Passed: partial unique index rejects a second active model.
- Passed: partial unique index rejects a second active layout.
- Passed: no table name contains PUE, energy, cooling, fan, or relay scope.
- Passed: migration PowerShell helper scripts parse successfully.

Environment note:

- Docker Desktop was started for validation.
- Local `psql` is not installed, so Docker-based helpers are the verified Windows path.
- TimescaleDB was not enabled; standard PostgreSQL remains the default.
- Cleanup passed: dropped `ems_thermal_lstm_m1_validation`, stopped PostgreSQL, and removed the validation Compose container/network with `docker compose down`.
- The named PostgreSQL volume remains available for later milestones.
