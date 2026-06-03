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

## Milestone 5 - Sensors and Readings Realtime Dashboard

Status: Done

Static checks:

- Passed: `npm run typecheck`.
- Passed: `npm run lint`.
- Passed: `npm run build`.

Runtime setup:

- Passed: launched Docker Desktop temporarily.
- Passed: `POSTGRES_PORT=55432 docker compose config --quiet`.
- Passed: started PostgreSQL on host port `55432`.
- Passed: created clean validation database
  `ems_thermal_lstm_m5_validation`.
- Passed: `./scripts/run-migrations-docker.ps1 -DatabaseName
  ems_thermal_lstm_m5_validation -DatabaseUser ems_user`.
- Passed: launched backend on `APP_PORT=8081` because local port `8080` was
  occupied.
- Passed: launched frontend on `127.0.0.1:5173` with API and SSE URLs pointed
  at backend port `8081`.

Browser and API validation:

- Passed: guaranteed-offline frontend configuration showed safe API
  unavailable, SSE disconnected, trouble assembly, and empty chart states.
- Passed: online Dashboard loaded safely with empty sensor history.
- Passed: Sensors & Readings displayed seeded S1 ambient and S2 hotspot
  metadata with an empty history table before sample insertion.
- Passed: authenticated `POST /api/v1/readings` inserted S1/S2 samples.
- Passed: `reading.latest` updated cards and table without manual refresh.
- Passed: populated Dashboard displayed S1/S2 values, gateway state, last
  update, today count, and two Chart.js history canvases.
- Passed: populated Sensors & Readings displayed two Chart.js history canvases
  and a 12-row history result.
- Passed: `sensor_code=S1` and `quality_status=valid` filter controls reduced
  the visible history result from 12 rows to 6; reset restored 12 rows.
- Passed: `from` and `to` datetime controls are present and serialize through
  the typed API client; native datetime entry could not be driven by the
  browser automation surface.
- Passed: `gateway.status` and `sensor.trouble` changed gateway and S2 display
  to trouble without manual refresh; a restore payload returned both to normal.
- Passed: responsive sweep at widths `320`, `375`, `414`, `768`, and `1280`
  found no horizontal document overflow.
- Passed: narrow widths use reading cards instead of wide tables.
- Passed: browser console remained free of warnings and errors.

Cleanup:

- Passed: stopped temporary frontend and backend processes.
- Passed: dropped `ems_thermal_lstm_m5_validation`.
- Passed: removed validation Compose container/network with
  `docker compose down`.
- Passed: stopped Docker Desktop after validation.

## Milestone 6 - ML Worker Training Pipeline

Status: Done

Environment setup:

- Passed: created ignored `ml-worker/.venv` with local Python `3.10.11`.
- Passed: installed ML-worker-only lightweight dependencies from
  `ml-worker/requirements.txt`.
- Passed: confirmed `.venv`, `__pycache__`, generated `*.egg-info`, local logs,
  model artifacts, metadata JSON, and training reports are ignored.
- Deferred: TensorFlow installation is documented separately in
  `requirements-tensorflow.txt`. The heavyweight runtime was not installed on
  this laptop during M6 validation.

Static and unit checks:

- Passed: `./.venv/Scripts/python.exe -m compileall -q src tests`.
- Passed: `./.venv/Scripts/python.exe -W error::FutureWarning -m unittest
  discover -s tests -v`.
- Passed: eight focused tests cover resampling/target construction, invalid
  value handling, chronological split ordering, train-only scaler fitting,
  ordered windowing, Celsius-unit metrics, Celsius-unit baselines, and portable
  relative artifact-path persistence.
- Passed: canonical `train`, `evaluate`, and `infer` CLI help surfaces.

PostgreSQL development validation:

- Passed: launched Docker Desktop temporarily.
- Passed: `POSTGRES_PORT=55432 docker compose config --quiet`.
- Passed: started PostgreSQL on host port `55432`.
- Passed: created and migrated clean validation database
  `ems_thermal_lstm_m6_validation`.
- Passed: empty database `train` exits safely with code `1`, inserts a failed
  `prediction_runs` row, and writes an `ml-worker` error row to `system_logs`.
- Passed: inserted `5,040` development-only simulator readings for S1/S2.
- Passed: pipeline produced `420` one-minute rows, `415` labeled rows, safe
  chronological split sizes `290/62/63`, train windows `(260, 30, 4)`,
  validation windows `(32, 30, 4)`, and test windows `(33, 30, 4)`.
- Passed: development-only Celsius baselines calculated without treating
  simulator metrics as thesis results.
- Passed: full `train` reaches the TensorFlow boundary, exits safely with code
  `1` when TensorFlow is absent, and records the failed run plus system log with
  the documented install command.
- Passed: development-only stub-model success smoke exercised artifact writing
  and inserted one `model_versions` row, one `model_metrics` row, two
  `baseline_results` rows, a successful training run, and an info system log.
  This verifies persistence wiring only and is not an LSTM or thesis result.
- Passed: `evaluate` and local-only `infer` reach saved-model loading, exit
  safely with code `1` when TensorFlow is absent, and record failed runs.

Scope note:

- Full TensorFlow LSTM artifact generation requires installing
  `requirements-tensorflow.txt` on the intended development workstation.
- Backend prediction submission remains deferred to Milestone `7`.

## Milestone 7 - Prediction Bridge and Alerts

Status: Done

Static checks:

- Passed: backend `gofmt -w .`, `go mod tidy`, `go test ./...`, `go vet ./...`,
  and `go build ./cmd/server`.
- Passed: frontend `npm run typecheck`, `npm run lint`, and `npm run build`.
- Passed: ML worker `./.venv/Scripts/python.exe -m compileall -q src tests`.
- Passed: ML worker `./.venv/Scripts/python.exe -W error::FutureWarning -m
  unittest discover -s tests -v`; ten tests passed, including mocked backend
  submission payload and Bearer-token checks.
- Passed: `POSTGRES_PORT=55432 docker compose config --quiet`.

PostgreSQL-backed API and SSE validation:

- Passed: migrated clean validation database
  `ems_thermal_lstm_m7_validation`, launched backend on `APP_PORT=8081`, and
  confirmed `GET /api/v1/health` returned `200`.
- Passed: unauthenticated `POST /api/v1/ml/predictions` returned `401`.
- Passed: internal-token manual prediction stored safely with missing model
  linkage and wrote a clear development-manual system log.
- Passed: nearby simulator S2 reading matched `actual_temperature` within the
  configured tolerance.
- Passed: backend classified `waspada` and `anomali` from thresholds and
  upgraded a normal thermal prediction to final `trouble` while gateway/S2
  trouble was active.
- Passed: live SSE stream emitted `reading.latest`, `gateway.status`,
  `sensor.trouble`, `prediction.latest`, `anomaly.created`, and
  `notification.sent`.
- Passed: stale prediction remained queryable but created no anomaly or
  notification log and did not replace the dashboard active prediction.
- Passed: Telegram-disabled prediction alerts and protected notification test
  stored `skipped` notification logs without crashing backend.
- Passed: seeded development-only model records validated model list, detail,
  active metrics, baseline comparison, and protected activation APIs.
- Passed: offline checker wrote one gateway and two sensor timeout transitions;
  later cycles did not duplicate timeout logs.

Frontend browser validation:

- Passed: populated Prediction & LSTM page showed active model, forecast status,
  Celsius metrics, actual-versus-predicted Chart.js canvas, model versions,
  activation action, two baseline rows, and prediction history.
- Passed: empty validation records showed explicit model-not-ready,
  no-prediction, no-chart-data, no-model, no-comparison, and empty-history
  states.
- Passed: stopped backend showed safe Prediction API-unavailable state.
- Passed: browser console remained free of errors.
- Note: in-app browser screenshot capture timed out; DOM-state browser
  validation completed successfully.

Cleanup:

- Passed: stopped temporary frontend and backend processes.
- Passed: dropped `ems_thermal_lstm_m7_validation`.
- Passed: removed validation Compose container/network with
  `docker compose down`.
- TensorFlow remains intentionally uninstalled on this laptop; manual/simulator
  predictions are development-only API validation, not thesis evidence.

## Milestone 8 - Alert, Telegram, and Events Logs

Status: Done

Static checks:

- Passed: backend `gofmt -w .`, `go mod tidy`, `go test ./...`, `go vet ./...`,
  and `go build ./cmd/server`.
- Passed: frontend `npm run typecheck`, `npm run lint`, and `npm run build`.
- Passed: `POSTGRES_PORT=55432 docker compose config --quiet`.

PostgreSQL-backed API validation:

- Passed: migrated clean validation database
  `ems_thermal_lstm_m8_validation`, launched backend on `APP_PORT=8081`, and
  confirmed `GET /api/v1/health` returned `200`.
- Passed: anomaly events, notification logs, and system logs returned empty
  states safely before validation records were created.
- Passed: backend-info, backend-warning, anomaly-status, and
  notification-status filters returned expected populated subsets.
- Passed: public settings reads masked stored Telegram bot token and chat ID.
- Passed: protected settings update rejected missing authorization with `401`.
- Passed: invalid threshold ordering and masked-secret writeback both returned
  `422`.
- Passed: direct database check confirmed the rejected masked value did not
  overwrite the stored Telegram bot token.
- Passed: protected Telegram test returned skipped safely while Telegram was
  disabled and stored the notification outcome.
- Passed: frontend development server returned the Events & Logs route shell
  and API-backed settings/system-log requests returned `200`.

Frontend validation note:

- Passed: frontend typed clients, state hooks, safe states, and production
  build completed without TypeScript or lint errors.
- Blocked: in-app browser webview did not attach after a clean reconnect, so
  interactive rendered-state checks could not be completed in this run.
- Deferred: Layout upload and markers remain Milestone `9`.

## Milestone 9 - Layout Upload and Sensor Marker

Status: Done

Static checks:

- Passed: backend `GOTOOLCHAIN=local gofmt -w .`, `go mod tidy`,
  `go test ./...`, `go vet ./...`, and `go build ./cmd/server`.
- Passed: pinned Go `1.24.3`-compatible `golang.org/x/image v0.36.0`; latest
  releases require Go `1.25`.
- Passed: frontend `npm run typecheck`, `npm run lint`, and `npm run build`.
- Passed: `POSTGRES_PORT=55432 docker compose config --quiet`.

PostgreSQL-backed API validation:

- Passed: migrated clean database `ems_thermal_lstm_m9_validation`, launched
  backend on `APP_PORT=8081`, and confirmed health.
- Passed: `GET /api/v1/layout` returned `data: null` before upload.
- Passed: unauthenticated layout upload returned `401`.
- Passed: non-image upload returned `422`.
- Passed: valid small PNG upload returned `201`, recorded dimensions `48x32`,
  and served safely as `image/png`.
- Passed: missing controlled image URL returned `404`.
- Passed: marker update outside ratio range returned `422`.
- Passed: S1 and S2 ratio marker updates succeeded.
- Passed: marker delete removed S1 and subsequent update restored both markers.
- Passed: backend wrote layout and marker change system logs.

Frontend browser validation:

- Passed: Layout page rendered active image, S1/S2 marker labels, status text,
  temperatures, humidity values, and last-seen timestamps from API data.
- Passed: temporary no-layout state rendered upload prompt and safe empty state.
- Passed: Dashboard omitted layout preview safely when no layout existed and
  rendered a lightweight read-only preview when active layout existed.
- Passed: responsive sweep at `320`, `375`, `414`, `768`, and `1280` found no
  horizontal overflow; image and two markers remained present.
- Passed: marker CSS positions remained ratio-based (`25%/40%` and
  `72%/55%`) across resize checks.
- Passed: stopped backend rendered explicit Layout API unavailable state.
- Passed: browser console remained free of warnings and errors.
- Blocked: automated pointer click retry collided with overlay markers, so
  browser automation is not accepted as drag interaction evidence. Protected
  API persistence and rendered drag/click wiring were validated.
- Note: in-app browser screenshot capture timed out; DOM-state validation
  completed successfully.

Cleanup:

- Passed: stopped temporary frontend and backend processes.
- Passed: dropped `ems_thermal_lstm_m9_validation`.
- Passed: removed validation Compose container/network, generated upload,
  frontend `dist`, and backend executable.

## Milestone 10A - Local Full Integration Test and Evidence Checklist

Status: Done

Static checks:

- Passed: backend `GOTOOLCHAIN=local go test ./...`, `go vet ./...`, and
  `go build ./cmd/server`.
- Passed: frontend `npm run typecheck`, `npm run lint`, and `npm run build`.
- Passed: gateway `./.venv/Scripts/python.exe -m compileall -q src tests` and
  `./.venv/Scripts/python.exe -W error::FutureWarning -m unittest discover -s
  tests -v`; 12 tests passed.
- Passed: ML worker `./.venv/Scripts/python.exe -m compileall -q src tests` and
  `./.venv/Scripts/python.exe -W error::FutureWarning -m unittest discover -s
  tests -v`; 10 tests passed.
- Passed: `POSTGRES_PORT=55432 docker compose config --quiet`.

Full local integration smoke:

- Passed: created, migrated, and seeded isolated database
  `ems_thermal_lstm_m10a_validation`.
- Passed: launched backend on overridden `APP_PORT=8081` while local `8080`
  was occupied; health returned `200`.
- Passed: launched frontend on `5173`.
- Passed: gateway `python -m gateway.cli send-test --config
  ./config.example.yaml` stored two simulator readings.
- Passed: readings flowed through latest/history reads, dashboard summary, and
  `reading.latest` SSE.
- Passed: gateway heartbeat plus S2 trouble and restore transitions emitted
  `gateway.status`, `sensor.trouble`, and `system.log`.
- Passed: unauthenticated ML prediction and settings updates returned `401`.
- Passed: ML-worker `submit_prediction` sent a development-manual forecast
  through the protected bridge without TensorFlow. Backend classified
  `33.4 C` as `anomali`.
- Passed: compact SSE capture received all seven event types:
  `reading.latest`, `gateway.status`, `sensor.trouble`, `system.log`,
  `prediction.latest`, `anomaly.created`, and `notification.sent`.
- Passed: Telegram-disabled prediction and protected Telegram test stored
  skipped notification logs without crashing backend.
- Passed: invalid threshold ordering, masked-secret writeback, invalid layout
  image, and out-of-range marker ratio each returned `422`.
- Passed: database check confirmed rejected masked-secret writeback preserved
  the configured development-only dummy token.
- Passed: valid small PNG upload returned `201`, image serving returned `200`,
  and S1/S2 marker ratios persisted.
- Passed: filtered anomaly, notification, system-log, reading-history, and
  prediction-history endpoints returned populated subsets.

Frontend browser validation:

- Passed: Dashboard rendered S1/S2 values, gateway active status, latest
  `anomali` prediction, recent events, and layout preview.
- Passed: Sensors & Readings rendered S1/S2 values, history controls, and
  `SSE: CONNECTED`.
- Passed: Prediction & LSTM rendered model-not-ready state plus
  development-manual forecast history safely.
- Passed: Layout rendered uploaded image, S1/S2 markers, telemetry, and
  placement controls.
- Passed: Events & Logs rendered populated anomaly records and all three tabs.
- Passed: Settings rendered thermal, Telegram, masked-secret, and read-only
  configuration panels.
- Passed: browser console remained free of errors.
- Note: in-app screenshot capture timed out; final Bab 4 screenshot collection
  remains a manual Milestone `10B` checklist item.

Manual/deferred boundary:

- Deferred: physical Raspberry Pi, USB RS485, and XY-MD02 validation.
- Deferred: TensorFlow installation, real LSTM artifact generation, and final
  thesis metrics.
- Deferred: enabled Telegram delivery to a real chat.
- Added: `Dokumentasi/M10_EVIDENCE_CHECKLIST.md`.

## Milestone 10B - Raspberry Pi Hardware Validation and Evidence

Status: Blocked - waiting hardware access

Laptop preparation:

- Passed: clean repository gate and confirmed Milestone `10A` is done.
- Passed: `POSTGRES_PORT=55432 docker compose config --quiet`.
- Passed: started PostgreSQL on Docker host port `55432`.
- Passed: applied migrations and seed data to `ems_thermal_lstm`.
- Passed: built backend and launched it on overridden `APP_PORT=8081` while
  local port `8080` was occupied.
- Passed: `GET http://localhost:8081/api/v1/health`.
- Passed: backend health was also reachable through laptop ZeroTier addresses
  `http://10.147.17.201:8081/api/v1/health` and
  `http://10.147.20.201:8081/api/v1/health`.
- Passed: launched frontend locally on `http://localhost:5173`.

Hardware blocker:

- Blocked: Raspberry Pi hardware is not physically available.
- Blocked: no reachable Raspberry Pi SSH target exists for this run.
- Not run: Raspberry Pi OS info, Python version, git version, serial
  permission, and `dialout` checks.
- Not run: `ls /dev/ttyUSB*`.
- Not run: gateway virtual environment creation or Raspberry Pi dependency
  installation.
- Not run: Raspberry Pi gateway `config.yaml` creation.
- Not run: `diagnose ports`, raw register reads for slave IDs `1` and `2`, or
  configured S1/S2 sensor diagnostics.
- Not run: Raspberry Pi `send-test`.
- Not run: Raspberry Pi gateway live loop, 3-5 minute hardware readings,
  hardware SSE behavior, dashboard realtime update, or gateway log evidence.
- Not run: RS485 polarity, power, slave-ID, baudrate, or register troubleshooting
  because physical hardware is unavailable.

Cleanup:

- Passed: stopped temporary frontend and backend processes.
- Passed: removed validation Compose container/network with
  `docker compose down`.
- Passed: removed generated backend executable and temporary local logs.

## Milestone 10C - TensorFlow Setup and ML Training Runtime Validation

Status: Done - development validation only

Environment and dependency checks:

- Passed: confirmed local ML-worker virtual environment uses Python `3.10.11`.
- Passed: recorded free system-drive space before install: `9.92 GB`.
- Passed: installed documented TensorFlow requirements with
  `./.venv/Scripts/python.exe -m pip install --no-cache-dir -r
  requirements-tensorflow.txt`.
- Passed: `./.venv/Scripts/python.exe -m pip check`.
- Passed: `./.venv/Scripts/python.exe -c "import tensorflow as tf;
  print(tf.__version__)"` returned `2.20.0`.
- Passed: TensorFlow detected CPU device. No GPU dependency was required.

ML-worker checks:

- Passed: `./.venv/Scripts/python.exe -m compileall -q src tests`.
- Passed: `./.venv/Scripts/python.exe -W error::FutureWarning -m unittest
  discover -s tests -v`; 10 tests passed.
- Passed: canonical root, `train`, `evaluate`, and `infer` CLI help surfaces.

Development-only training runtime:

- Passed: created and migrated isolated database
  `ems_thermal_lstm_m10c_validation`.
- Passed: inserted `5,040` generated `source=simulator`,
  `quality_status=valid` readings for S1/S2 at 10-second cadence.
- Passed: preprocessing produced `420` usable one-minute rows and `415`
  labeled rows after five-minute target shift.
- Passed: chronological split sizes were `290/62/63`; train, validation, and
  test windows were `260/32/33` with `window_size=30`.
- Passed: real CPU TensorFlow training completed with `ML_EPOCHS=2`.
- Passed: generated `model.keras`, `feature_scaler.pkl`, `target_scaler.pkl`,
  `model_metadata.json`, and `training_report.json`.
- Passed: training LSTM Celsius metrics were RMSE `1.2562`, MAE `1.2456`, and
  MAPE `4.0552%`.
- Passed: persistence baseline Celsius metrics were RMSE `0.2201`, MAE
  `0.1818`, and MAPE `0.5925%`.
- Passed: moving-average baseline Celsius metrics were RMSE `0.2585`, MAE
  `0.2111`, and MAPE `0.6876%`.
- Passed: saved-model `evaluate` completed with Celsius metrics.
- Passed: backend-submitted `infer` predicted S2 `29.5286 C`; backend stored
  final status `normal`.
- Passed: database contained one active LSTM model, one model-metrics row, two
  baseline rows, successful training/evaluation/inference runs, one backend
  prediction, and ML-worker info logs.

Limitations:

- Development-only: generated simulator readings are not thesis evidence.
- Development-only: two epochs validate runtime wiring, not final model
  quality. Both required baselines outperformed this short LSTM smoke run.
- Blocked separately: Milestone `10B` Raspberry Pi hardware validation remains
  blocked until hardware is available.

Cleanup:

- Passed: stopped temporary backend process.
- Passed: dropped isolated validation database and removed Compose
  container/network with `docker compose down`.
- Passed: removed generated model artifacts, report, backend executable, and
  temporary local logs.
- Retained: ignored ML-worker virtual environment with TensorFlow `2.20.0`.

## Milestone 10B - Raspberry Pi Hardware Validation Stage One

Status: Blocked - raw Modbus and laptop inbound backend access

Laptop EMS checks:

- Passed: Docker PostgreSQL running on host port `55432`.
- Passed: migrations and seed applied to `ems_thermal_lstm`.
- Passed: backend built and launched on `APP_PORT=8081`.
- Passed: `GET http://localhost:8081/api/v1/health` returned `success`.
- Passed: laptop self-check `GET http://192.168.18.9:8081/api/v1/health`
  returned `success`.
- Passed: frontend dev server available on `http://localhost:5173`.
- Blocked from Pi: `curl http://192.168.18.9:8081/api/v1/health` timed out.
- Blocked: non-admin shell could not add a Windows Firewall inbound rule for
  TCP `8081`.

Raspberry Pi checks:

- Passed: passwordless SSH to `gamaliel@192.168.18.33`.
- Passed: hostname `lmnop`.
- Passed: OS `Debian GNU/Linux 13 (trixie)`.
- Passed: `python3 --version` returned `Python 3.13.5`.
- Passed: `git --version` returned `git version 2.47.3`.
- Passed: `/dev/ttyUSB0` exists with group `dialout`.
- Passed: `gamaliel` belongs to `dialout`.
- Passed: `lsusb` identified FT232 / FTDI USB Serial Device.
- Passed with risk: `vcgencmd get_throttled` returned `throttled=0x50000`;
  kernel log included repeated `Undervoltage detected!` messages.
- Passed: gateway repo `/home/gamaliel/EMS/gateway-rpi` on commit `dfe966a`.
- Passed: gateway virtual environment and `python -m gateway.cli --help`.

Gateway diagnostics:

- Passed: `python -m gateway.cli diagnose ports` listed `/dev/ttyS0` and
  `/dev/ttyUSB0`.
- Failed: `python -m gateway.cli diagnose raw --slave-id 1 --address 0
  --count 2` returned `No response received after 3 retries`.
- Failed: `python -m gateway.cli diagnose raw --slave-id 1 --address 1
  --count 2` returned `No response received after 3 retries`.
- Failed: documented slave-ID check `python -m gateway.cli diagnose raw
  --slave-id 2 --address 0 --count 2` returned `No response received after 3
  retries`.
- Passed: no process was holding `/dev/ttyUSB0` after diagnostics.
- Failed: `python -m gateway.cli send-test` timed out on both HTTP POST
  attempts because Pi cannot reach laptop backend on `192.168.18.9:8081`.

Not run:

- Not run: `python -m gateway.cli diagnose sensor --sensor-code S1`; raw
  Modbus reads did not succeed.
- Not run: `python -m gateway.cli diagnose sensor --sensor-code S2`; only one
  XY-MD02 was connected and raw reads did not succeed.
- Not run: 3-5 minute gateway loop; prerequisites failed.
- Not run: backend latest readings, hardware SSE, dashboard realtime update,
  and database row-count evidence from real hardware.

Next validation fixes:

- Fix Raspberry Pi undervoltage before final evidence.
- Confirm sensor power, RS485 A/B polarity, actual slave ID, baudrate, and
  XY-MD02 register map.
- Allow inbound TCP `8081` to the laptop backend or document a temporary SSH
  tunnel workaround before gateway delivery validation.

## Milestone 10B - Raspberry Pi Hardware Validation Stage Two

Status: Partial - S1 hardware validated, S2 pending

Code validation:

- Passed: local gateway `python -m compileall -q src tests`.
- Passed: local gateway `python -m unittest discover -s tests -v`; 13 tests
  passed.
- Passed: Raspberry Pi gateway `python -m compileall -q src tests`.
- Passed: Raspberry Pi gateway `python -m unittest discover -s tests -v`; 13
  tests passed.
- Passed: backend `go build ./cmd/server` for runtime validation.

Laptop backend validation:

- Passed: Docker PostgreSQL running on host port `55432`.
- Passed: migrations and seed applied to `ems_thermal_lstm`.
- Passed: backend listening on `0.0.0.0:8081` and `[::]:8081`.
- Passed: `GET http://localhost:8081/api/v1/health`.
- Passed: Pi `curl http://192.168.18.9:8081/api/v1/health` returned HTTP
  `200`.
- Passed: frontend dev server responded with HTTP `200`.

Modbus diagnostics:

- Passed: `python -m gateway.cli diagnose ports` listed `/dev/ttyS0` and
  `/dev/ttyUSB0`.
- Passed: `python -m gateway.cli diagnose raw --slave-id 1 --address 1
  --count 2` used `register_type=input` and returned `raw=[352, 547]`.
- Passed: configured S1 diagnostic returned temperature `35.1` and humidity
  `54.6`.

Delivery and realtime validation:

- Passed: `python -m gateway.cli send-test` returned backend success with
  `received_count=2` and `stored_count=2`.
- Passed: `timeout -s INT 190 python -m gateway.cli run` ran about 3 minutes
  and stopped safely with `Gateway stopped`.
- Passed: gateway loop posted repeated `/readings` requests with HTTP `201`.
- Passed: gateway loop posted `/gateway/status` heartbeat requests with HTTP
  `201`.
- Passed: database source count showed `19` hardware rows and `2` simulator
  rows.
- Passed: latest hardware S1 rows ranged around `35.0-35.1 C` and
  `54.5-54.6 %`.
- Passed: gateway status was `active`.
- Passed: sensor state showed S1 `normal`.
- Passed: `GET /api/v1/readings/latest` showed S1 `source=hardware`.
- Passed: `GET /api/v1/dashboard/summary` showed S1 hardware data and gateway
  active status.
- Passed: SSE capture contained repeated `reading.latest` and `gateway.status`
  events.

Limitations:

- Partial only: S2 was disabled in ignored Pi local config because only one
  XY-MD02 sensor was connected.
- Partial only: latest S2 API value came from simulator `send-test`, not
  hardware.
- Manual remaining: final dashboard screenshot with real S1/S2 hardware values.
- Risk: Raspberry Pi undervoltage still present with `throttled=0x50000`.
- Risk: `pymodbus` logged receive-buffer cleanup warnings during the run loop,
  although reads and backend delivery succeeded.

## Milestone 10B - Raspberry Pi Hardware Validation Stage Three

Status: Partial - two-sensor one-shot validated, loop blocked

Network and backend:

- Passed: laptop IP confirmed as `192.168.10.112`.
- Passed: Raspberry Pi IP confirmed as `192.168.10.108`.
- Passed: passwordless SSH to `gamaliel@192.168.10.108`.
- Deviation: `POSTGRES_PORT=55432` and `55433` could not be used because
  Windows excluded TCP range `55365-55464`; used `POSTGRES_PORT=15432` for this
  run.
- Passed: migrations and seed applied to `ems_thermal_lstm`.
- Passed: backend built and launched on `APP_PORT=8081`.
- Passed: backend listened on `0.0.0.0:8081` and `[::]:8081`.
- Passed: `GET http://localhost:8081/api/v1/health`.
- Passed: Pi `curl http://192.168.10.112:8081/api/v1/health` returned HTTP
  `200`.

Two-sensor diagnostics:

- Passed: Pi serial port `/dev/ttyUSB0` detected.
- Passed: `python -m gateway.cli diagnose ports` listed `/dev/ttyS0` and
  `/dev/ttyUSB0`.
- Passed: S1 raw input-register read returned `raw=[256, 425]`.
- Passed: S2 raw input-register read returned `raw=[253, 440]`.
- Passed: S1 configured diagnostic returned temperature `25.5` and humidity
  `42.4`.
- Passed: S2 configured diagnostic returned temperature `25.2` and humidity
  `44`.

Delivery:

- Passed: one `GatewayRuntime.run_once()` sent `/readings` and
  `/gateway/status` with HTTP `201`.
- Passed: database contained one new S1 hardware row and one new S2 hardware
  row at `2026-06-03 05:39:31+00`.
- Passed: `GET /api/v1/readings/latest` returned S1 and S2 as
  `source=hardware`.
- Passed: `GET /api/v1/dashboard/summary` returned S1 and S2 hardware values.

Loop blocker:

- Failed: canonical `timeout -s INT 190 python -m gateway.cli run` stalled and
  did not insert repeated two-sensor rows.
- Failed: bounded retry diagnostics also stalled on raw S1 after serial buffer
  cleanup.
- Evidence: `pymodbus` logged large `Cleanup recv buffer before send` payloads
  containing ASCII-like sensor text before hanging in RTU frame decoding.
- Not committed: a defensive serial-buffer flush patch was tried, failed
  hardware retry, and was reverted locally and on the Pi.
- Risk persists: Raspberry Pi undervoltage now reports `throttled=0x50005`.

Result:

- M10B remains Partial, not Done.
- Hardware/backend path is proven for one cycle with both sensors.
- Final evidence still requires stable 3-5 minute loop with repeated S1 and S2
  hardware rows.

## Milestone 10B - Raspberry Pi Hardware Validation Stabilization

Status: Done

Code validation:

- Passed: local gateway `python -m compileall -q src tests`.
- Passed: local gateway `python -m unittest discover -s tests -v`; 13 tests
  passed.
- Passed: Raspberry Pi gateway `python -m compileall -q src tests`.
- Passed: Raspberry Pi gateway `python -m unittest discover -s tests -v`; 13
  tests passed.

Network and backend:

- Passed: backend launched on `APP_PORT=8081` and listened on `0.0.0.0:8081`
  and `[::]:8081`.
- Passed: laptop `GET http://localhost:8081/api/v1/health`.
- Passed: Pi `curl http://192.168.10.112:8081/api/v1/health`.
- Note: PostgreSQL validation used host port `15432` because Windows excluded
  the requested `55432` range on this laptop.

Manual raw-read stability evidence:

- Passed: S1 raw input-register read succeeded `15/15` repeated attempts with
  values around `[253-255, 447-453]`.
- Passed: S2 raw input-register read succeeded `15/15` repeated attempts with
  values around `[253-255, 484-515]`.
- Passed: no timeout, CRC error, or no-response occurred during those repeated
  raw tests.

Post-patch gateway diagnostics:

- Passed: `python -m gateway.cli diagnose ports` listed `/dev/ttyS0` and
  `/dev/ttyUSB0`.
- Passed: S1 raw input-register read returned `raw=[255, 444]`.
- Passed: S2 raw input-register read returned `raw=[257, 449]`.
- Passed: configured S1 diagnostic returned temperature `25.6` and humidity
  `44.5`.
- Passed: configured S2 diagnostic returned temperature `25.7` and humidity
  `45.0`.

Gateway loop and backend evidence:

- Passed: `timeout -s INT 190 python -m gateway.cli run` ran the canonical
  loop with both S1 and S2 enabled until the timeout sent SIGINT.
- Passed: gateway stopped cleanly and emitted repeated HTTP `201` readings
  responses plus heartbeat/status responses.
- Passed: PostgreSQL showed hardware row totals: S1 `36`, S2 `17`; latest
  aligned two-sensor row was `2026-06-03 06:28:38.577324+00`.
- Passed: latest hardware rows showed S1 `25.60 C / 44.30 %` and S2
  `25.50 C / 45.30 %`.
- Passed: gateway state was `active`.
- Passed: sensors S1 and S2 were `normal`.
- Passed: `GET /api/v1/readings/latest` returned S1 and S2 as
  `source=hardware`, `quality_status=valid`.
- Passed: `GET /api/v1/dashboard/summary` returned gateway active plus S1 and
  S2 hardware values.

Limitations and risks:

- `pymodbus` receive-buffer cleanup warnings still appeared, but they no
  longer blocked repeated two-sensor loop delivery during this run.
- Raspberry Pi `vcgencmd get_throttled` returned `0x50000`; treat as
  historical undervoltage/throttling risk since boot, not a blocker for this
  stabilization. Reboot and recheck before long final evidence capture.
- A separate one-shot SSE capture attempt timed out and was not used as M10B
  pass evidence; backend inserts and latest/dashboard API evidence passed.

## Milestone 10B - XY-MD02 Auto-Report Disable Attempt

Status: Blocked - automatic reporting persists

Serial STOP attempts:

- Passed: confirmed local backend health on `http://localhost:8081/api/v1/health`.
- Passed: confirmed no intended `python -m gateway.cli run` process remained
  active before starting the STOP attempt.
- Ran from Raspberry Pi venv using `pyserial` on `/dev/ttyUSB0`, 9600 baud,
  8 data bits, no parity, 1 stop bit.
- Failed: sending `STOP\r\n`, `STOP\n`, and `STOP` did not stop automatic ASCII
  temperature/humidity output.
- Failed: a repeated STOP burst using `STOP\r`, `STOP\r\n`, `STOP\n`, and
  `STOP` did not quiet the bus.
- Evidence: after a 10-second quiet wait, `ser.in_waiting` still reported
  `4080` bytes and the sample payload still contained repeated ASCII
  temperature/humidity strings.

Raw-read validation:

- Blocked: requested S1 `20` raw-read attempts did not complete because the
  first raw diagnostic hung on the noisy serial stream.
- Not run: S2 `20` raw-read attempts, 10-minute gateway loop, 2-hour collection,
  dashboard long-run validation, and final ML dataset validation.
- Passed: leftover `gateway.cli` diagnostic process was stopped; no intended
  gateway collection loop remained active.

Result:

- M10B final dataset collection remains blocked by XY-MD02 ordinary
  UART/common-protocol automatic reporting on the RS485 bus.
- No code was changed and no software ASCII-ignore mitigation was accepted as a
  final fix.

## Milestone 10E - Best-Effort Hardware Collection

Status: Completed - zero new rows

Runtime checks:

- Passed: Docker PostgreSQL was already running on host port `15432`.
- Passed: backend was listening on `0.0.0.0:8081` and `[::]:8081`.
- Passed: frontend was listening on `localhost:5173`.
- Passed: `GET http://localhost:8081/api/v1/health`.
- Passed: Raspberry Pi `curl http://192.168.18.9:8081/api/v1/health`.
- Passed: Raspberry Pi gateway config check showed backend URL
  `http://192.168.18.9:8081/api/v1`, `/dev/ttyUSB0`,
  `register_type=input`, `inter_read_delay_ms=500`, S1 slave `1`, and S2 slave
  `2`.

Collection monitor:

- Started gateway in background with Python PID `950` and log
  `logs/best_effort_20260603T122434Z.log`.
- Ran local monitor from `2026-06-03T19:27:05+07:00` to
  `2026-06-03T21:22:51+07:00`.
- Monitor samples: `24`.
- Restart count: `0`; gateway process remained alive in all samples.
- Start counts: S1 `273`, S2 `253`.
- End counts: S1 `273`, S2 `253`.
- New hardware-valid rows: S1 `0`, S2 `0`.
- Latest hardware readings remained S1 id `528` and S2 id `527` at
  `2026-06-03T14:42:26.761374+07:00`.

Observed failures:

- Repeated `POST /readings failed after 2 attempt(s): timed out`.
- Repeated `POST /gateway/status failed after 2 attempt(s): timed out`.
- Repeated `Cleanup recv buffer before send` containing ASCII
  temperature/humidity bytes from the XY-MD02 auto-report issue.

Result:

- The best-effort run collected no additional valid hardware rows.
- The data remains preliminary/noisy only and is not final thesis dataset
  evidence.
- Gateway was left running at the end by request.

## Milestone 10F - Hardware LSTM Candidate Training

Status: Passed as preliminary/final-candidate training evidence only

Environment checks:

- Passed: `GET http://localhost:8081/api/v1/health`.
- Passed: ML Worker syntax check with `python -m compileall -q src tests`.
- Passed: ML Worker unit tests with `python -m unittest discover -s tests -v`
  (`10` tests).
- Passed: TensorFlow import, version `2.20.0`.

Hardware dataset checks:

- Passed: hardware-valid counts before training were S1 `1,025` and S2
  `1,005`, latest timestamp `2026-06-03 20:02:36.200559+00`.
- Passed: paired minute buckets existed (`176` before training).
- Passed: ML dry check loaded `2,070` raw hardware rows and produced `218`
  usable one-minute rows.
- Passed: chronological split produced train `127`, validation `42`, and test
  `44` rows.
- Passed: window counts were train `97`, validation `12`, and test `14`.

Training command:

```powershell
$env:ML_ALLOWED_SOURCES = "hardware"
$env:ML_ALLOWED_QUALITY_STATUSES = "valid"
$env:ML_EPOCHS = "30"
$env:ML_BATCH_SIZE = "32"
$env:ML_MINIMUM_RESAMPLED_ROWS = "120"
$env:ML_TRAIN_RATIO = "0.60"
$env:ML_VALIDATION_RATIO = "0.20"
$env:ML_TEST_RATIO = "0.20"
./.venv/Scripts/python.exe -m ml_worker.cli train --activate
```

Training result:

- Passed: model `v20260603_200711` trained and activated.
- Passed: artifacts generated locally: Keras model, feature scaler, target
  scaler, metadata, and training report.
- Passed: LSTM training metrics were RMSE `0.1450`, MAE `0.1131`, MAPE
  `0.3506%`.
- Passed: persistence baseline metrics were RMSE `0.1390`, MAE `0.1095`, MAPE
  `0.3397%`.
- Passed: moving-average baseline metrics were RMSE `0.1346`, MAE `0.1088`,
  MAPE `0.3374%`.

Evaluate and infer:

- Passed: `python -m ml_worker.cli evaluate`.
- Evaluation LSTM metrics: RMSE `0.1887`, MAE `0.1430`, MAPE `0.4422%`.
- Evaluation persistence baseline: RMSE `0.1712`, MAE `0.1256`, MAPE
  `0.3887%`.
- Evaluation moving-average baseline: RMSE `0.1696`, MAE `0.1277`, MAPE
  `0.3951%`.
- Passed: `python -m ml_worker.cli infer` submitted through the backend bridge.
- Passed: backend stored prediction id `1`, predicted S2 `32.1194 C`,
  `thermal_status=anomali`, `final_status=anomali`, `is_stale=false`.

Backend verification:

- Passed: `GET /api/v1/predictions/latest`.
- Passed: `GET /api/v1/model-metrics/latest`.
- Passed: `GET /api/v1/model-comparison/latest`.
- Passed: `GET /api/v1/model-versions`.
- Passed: PostgreSQL showed one active model, one model-metrics row, two
  baseline rows, and one prediction row.

Limitations:

- Dataset is still short and preliminary.
- Validation/test windows are small.
- Baselines outperform the LSTM in both train-result and evaluate-result
  metrics.
- This is not final thesis model quality evidence.
