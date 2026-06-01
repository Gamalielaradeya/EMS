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

## Milestone 2A - Backend Core API

Status: Done

Build and unit checks:

- Passed: `gofmt -w .` inside `backend-go/`.
- Passed: `go mod tidy`.
- Passed: `go test ./...`.
- Passed: `go vet ./...`.
- Initial `go build ./cmd/server` attempt was blocked because the system drive lacked free space.
- Passed: cleared disposable Go compiler cache and temporary `go-build*` directories only.
- Passed: `go build ./cmd/server`.
- Passed: `POSTGRES_PORT=55432 docker compose config --quiet`.
- Passed: started PostgreSQL with temporary host override `POSTGRES_PORT=55432`.
- Passed: `./scripts/run-migrations-docker.ps1`.

API validation against PostgreSQL:

- Passed: `GET /api/v1/health` returned `200`.
- Passed: `POST /api/v1/readings` without token returned `401`.
- Passed: authenticated `POST /api/v1/readings` stored S1 and S2 with `201`.
- Passed: repeated reading payload returned `201` with `stored_count=0`.
- Passed: temperature `81` returned validation error `422`.
- Passed: authenticated `POST /api/v1/gateway/status` stored heartbeat with `201`.
- Passed: `GET /api/v1/sensors` returned seeded S1 and S2.
- Passed: `GET /api/v1/sensors/S1` returned ambient role.
- Passed: `PUT /api/v1/sensors/S1` updated editable metadata.
- Passed: `GET /api/v1/readings/latest` returned S1 and S2.
- Passed: `GET /api/v1/readings/history?limit=10` returned stored rows.
- Passed: configured frontend-origin CORS preflight returned `204`.

Database assertions:

- Passed: one gateway API token exists, token storage does not match plaintext, and usage timestamp is updated.
- Passed: gateway `last_seen_at` and active status were updated.
- Passed: both sensor `last_seen_at` values and health statuses were updated.
- Passed: one gateway status log and two deduplicated sensor readings exist.

Environment note:

- Local port `5432` remained occupied, so runtime validation used host port `55432`.
- TimescaleDB was not enabled; standard PostgreSQL remains the default.

## Milestone 2B - Backend Realtime and System Core

Status: Done

Build and static checks:

- Passed: aligned `go.mod` from unavailable Go `1.26.3` to installed local Go `1.24.3`.
- Passed: pinned `github.com/jackc/pgx/v5` to compatible `v5.8.0`; newer `v5.9.2` requires Go `>=1.25`.
- Passed: `GOTOOLCHAIN=local gofmt -w .`.
- Passed: `GOTOOLCHAIN=local go mod tidy`.
- Passed: `GOTOOLCHAIN=local go test ./...`.
- Passed: `GOTOOLCHAIN=local go vet ./...`.
- Passed: `GOTOOLCHAIN=local go build ./cmd/server`.
- Passed: `POSTGRES_PORT=55432 docker compose config --quiet`.

Runtime validation:

- Docker Desktop was started temporarily for validation.
- Passed: started PostgreSQL with temporary host override `POSTGRES_PORT=55432`.
- Passed: created clean validation database `ems_thermal_lstm_m2b_validation`.
- Passed: `./scripts/run-migrations-docker.ps1 -DatabaseName ems_thermal_lstm_m2b_validation -DatabaseUser ems_user`.
- Passed: launched backend with `APP_PORT=8081` because local port `8080` was occupied.
- Passed: `GET /api/v1/health` returned `200` on port `8081`.
- Passed: `GET /api/v1/dashboard/summary` safely returned empty readings, null model, null prediction, null metrics, and Telegram disabled before readings existed.
- Passed: authenticated `POST /api/v1/readings` stored S1 and S2 and emitted SSE `reading.latest`.
- Passed: populated `GET /api/v1/dashboard/summary` returned S1 and S2 latest readings while optional ML state remained null safely.
- Passed: authenticated `POST /api/v1/gateway/status` emitted SSE `gateway.status`.
- Passed: reported S2 trouble emitted SSE `sensor.trouble` and `system.log`.
- Passed: offline checker marked one stale gateway offline and two stale sensors trouble.
- Passed: offline checker wrote three timeout transition logs on the first cycle and remained at three logs after later cycles, confirming duplicate-log suppression.
- Passed: SSE disconnect after the curl timeout did not crash backend.
- Passed: admin/internal Bearer middleware unit tests accept configured `ADMIN_TOKEN` and `INTERNAL_API_TOKEN` values and reject missing tokens.

Cleanup:

- Passed: stopped temporary backend process.
- Passed: dropped `ems_thermal_lstm_m2b_validation`.
- Passed: removed validation Compose container/network with `docker compose down`.
- Passed: stopped Docker Desktop after validation.
- The named PostgreSQL volume remains available for later milestones.

## Milestone 3 - Gateway Diagnostic and Delivery

Status: Done

Environment setup:

- Passed: created ignored `gateway-rpi/.venv` with local Python `3.10.11`.
- Passed: installed gateway-only dependencies with
  `./.venv/Scripts/python.exe -m pip install -r requirements.txt`.
- Passed: `./.venv/Scripts/python.exe -m pip check`.

Syntax and unit checks:

- Passed: `./.venv/Scripts/python.exe -m compileall src tests`.
- Passed: `./.venv/Scripts/python.exe -m unittest discover -s tests -v`.
- Passed: 12 tests cover YAML/env configuration, backend payload shape, sensor
  validation, Bearer authentication, one-retry limit, bounded JSONL storage,
  throttled replay, replay retention while offline, heartbeat timing, throttled
  offline heartbeat attempts, immediate sensor-status changes, and one-cycle
  resilience when S2 plus backend fail.

CLI and laptop diagnostics:

- Passed: `./.venv/Scripts/python.exe -m gateway.cli --help`.
- Passed: `./.venv/Scripts/python.exe -m gateway.cli diagnose --help`.
- Passed: `./.venv/Scripts/python.exe -m gateway.cli diagnose ports`; reported
  no serial ports without crashing because this laptop has no USB RS485 adapter.
- Passed: `./.venv/Scripts/python.exe -m gateway.cli diagnose raw --config
  ./config.example.yaml --slave-id 1 --address 1 --count 2`; returned exit `1`
  with clear RS485 troubleshooting causes because `/dev/ttyUSB0` is absent.
- Passed: `./.venv/Scripts/python.exe -m gateway.cli diagnose sensor --config
  ./config.example.yaml --sensor-code S1`; returned a clear no-adapter error.
- Passed: backend-offline `send-test` returned exit `1` after exactly two HTTP
  attempts: the initial request and one configured retry.

Security and packaging checks:

- Passed: root `.gitignore` excludes `.env`, `config.yaml`, `.venv/`, `*.log`,
  `failed_payloads.jsonl`, `__pycache__/`, and generated `*.egg-info/`.
- Passed: `git check-ignore -v` confirmed local secret/runtime paths are ignored.
- Passed: `systemd/ems-thermal-lstm-gateway.service.example` is documentation
  only and points at the gateway virtual-environment Python executable.

Environment note:

- Physical XY-MD02 success remains deferred until Raspberry Pi wiring, serial
  permissions, slave IDs, and register addresses are verified.
- A live backend was not started for M3 laptop validation. Mocked HTTP tests
  validated payload submission, Bearer token use, retry behavior, buffering, and
  replay; the CLI offline path was also validated.

## Milestone 4 - Frontend Foundation and Dashboard Shell

Status: Done

Environment setup:

- Passed: installed frontend-only dependencies with `npm install` inside
  `frontend-dashboard/`.
- Passed: confirmed `node_modules/`, `dist/`, and `.env.local` are ignored.

Static checks:

- Passed: `npm run typecheck`.
- Passed: `npm run lint`.
- Passed: `npm run build`.

Runtime and browser checks:

- Passed: launched the frontend temporarily with `npm run dev`.
- Passed: opened `http://127.0.0.1:5173` in the in-app browser.
- Passed: unavailable backend state renders safely after the API timeout.
- Passed: Dashboard, Sensors & Readings, Prediction & LSTM, Layout, Events &
  Logs, and Settings routes open without browser console errors.
- Passed: responsive sweep at widths `320`, `375`, `414`, `768`, and `1280`
  found no horizontal document overflow.
- Passed: mobile menu expands at `320px` and exposes all six locked routes.

Scope note:

- Chart regions remain intentional placeholders until Milestone `5`.
- Backend runtime integration was not required for M4 because unavailable-state
  behavior is part of the shell contract.
