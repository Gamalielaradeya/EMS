# AGENTS.md — EMS Thermal LSTM

## Project Identity

Project: **EMS Thermal LSTM**  
Type: Informatics thesis engineering prototype  
Mode: **hardware-first**, Raspberry Pi + XY-MD02 sensors  
Primary goal: build an Environment Monitoring System that reads real temperature/humidity data, predicts S2 temperature 5 minutes ahead with LSTM, classifies thermal status, displays dashboard, and sends Telegram alerts.

## Required Reading Order

Before coding, read these files in `Dokumentasi/`:

1. `00_Project_Direction_Final.md`
2. `01_System_Scope_and_Features_Final.md`
3. `02_Hardware_and_Gateway_Final.md`
4. `03_System_Architecture_Final.md`
5. `04_Database_Design_Final.md`
6. `05_Backend_API_Final.md`
7. `06_ML_Worker_LSTM_Final.md`
8. `07_Frontend_Dashboard_Final.md`
9. `08_Alert_and_Telegram_Final.md`
10. `09_Test_Plan_Final.md`
11. `10_Codex_Implementation_Runbook.md`

If a task conflicts with these documents, stop and ask before changing scope.

## Locked Scope

Build only:

- `backend-go/`: Go REST API + SSE + Telegram + PostgreSQL integration.
- `frontend-dashboard/`: React + Vite + TypeScript + Tailwind + shadcn/ui + Chart.js.
- `gateway-rpi/`: Python Raspberry Pi gateway for Modbus RTU over RS485.
- `ml-worker/`: Python LSTM training, evaluation, artifact generation, and inference.
- `Dokumentasi/`: project documentation.
- `scripts/`: local dev helper scripts.

Do **not** add:

- PUE calculation.
- Energy optimization.
- Fan/AC/relay control.
- Automatic cooling control.
- Enterprise monitoring stack.
- Kubernetes, Kafka, RabbitMQ, or unnecessary microservices.
- Mobile app.
- Complex auth/RBAC unless explicitly requested.
- LSTM training on Raspberry Pi.

## Final Sidebar

Frontend sidebar must stay:

```text
Dashboard
Sensors & Readings
Prediction & LSTM
Layout
Events & Logs
Settings
```

Do not split these into many extra sidebar menus.

## Architecture Rules

- S1 = ambient/reference sensor.
- S2 = hotspot/exhaust sensor and LSTM prediction target.
- Raw gateway interval = 10 seconds.
- ML resampling interval = 60 seconds.
- LSTM window size = 30 resampled points.
- LSTM horizon = 5 minutes.
- Thermal status defaults:
  - normal: predicted S2 < 30°C
  - waspada: 30°C <= predicted S2 <= 32°C
  - anomali: predicted S2 > 32°C
  - trouble: sensor/gateway/system issue
- Status priority: `trouble > anomali > waspada > normal`.
- Status model:
  - `sensor_health_status`: `normal`, `trouble`, `inactive`
  - `thermal_status`: `normal`, `waspada`, `anomali`
  - `final_status`: assembled with priority `trouble > anomali > waspada > normal`
- Gateway heartbeat interval = 60 seconds.
- Backend offline checker interval = 30 seconds.
- Sensor/gateway trouble timeout = more than 5 minutes without data.
- Prediction stale TTL = 10 minutes. Stale predictions remain in history but cannot drive dashboard active status or Telegram alerts.

## Repository Layout

Expected root layout:

```text
ems-thermal-lstm/
├── AGENTS.md
├── README.md
├── docker-compose.yml
├── .env.example
├── Dokumentasi/
├── backend-go/
├── frontend-dashboard/
├── gateway-rpi/
├── ml-worker/
└── scripts/
```

Keep component code inside its own folder. Do not mix frontend/backend/gateway/ML logic.

## Milestone Workflow

Work one milestone at a time from `Dokumentasi/10_Codex_Implementation_Runbook.md`.

Milestone `-1` Documentation Lock must be complete before Milestone `0` starts.

Before implementation:

1. Summarize the milestone goal.
2. List files expected to change.
3. List commands that will verify completion.
4. Ask if there is an ambiguity.

After implementation, report only:

1. Files changed.
2. Commands run.
3. Test/build result.
4. Remaining blockers.
5. Next recommended milestone.

## Communication Mode

Use compact reporting by default.

Avoid long explanations unless asked. Prefer this format:

```text
Done:
- ...

Changed:
- path/file

Verified:
- command: result

Next:
- ...
```

If using the Caveman skill, use it only for progress reports and reviews. Do not make source code, documentation, commit messages, or user-facing UI text sound like caveman.

## UI Quality Rules

When editing `frontend-dashboard/`, use Hallmark-style design discipline:

- Avoid generic AI-looking SaaS templates.
- Use strong hierarchy, spacing, and clear monitoring-first layout.
- Keep sidebar clean with the six final menus.
- Use professional EMS/dashboard visual language.
- Status badges must show text, not only color.
- Dashboard must have loading, empty, and error states.
- UI must read real API data, not hardcoded production dummy data.
- Keep design thesis-friendly: clean, explainable, not overly animated.

If Hallmark skill is installed, apply it for frontend layout/design work. If not installed, follow the rules above manually.

## Backend Rules

- Use Go.
- Keep handler/service/repository separation.
- Validate all input.
- Use consistent JSON response format.
- Gateway endpoints must require Bearer token.
- Telegram failure must not crash backend.
- SSE disconnect must not crash backend.
- Do not query the whole readings table for dashboard charts; use limits/time filters.

Required core endpoints:

```text
GET  /api/v1/health
GET  /api/v1/events
POST /api/v1/readings
POST /api/v1/gateway/status
POST /api/v1/ml/predictions
GET  /api/v1/dashboard/summary
GET  /api/v1/sensors
PUT  /api/v1/sensors/{sensorCode}
GET  /api/v1/readings/latest
GET  /api/v1/readings/history
GET  /api/v1/predictions/latest
GET  /api/v1/predictions/history
GET  /api/v1/model-versions
PUT  /api/v1/model-versions/{id}/activate
GET  /api/v1/layout
POST /api/v1/layout/image
PUT  /api/v1/layout/devices/{sensorCode}
GET  /api/v1/anomaly-events
GET  /api/v1/notification-logs
GET  /api/v1/system-logs
GET  /api/v1/settings
PUT  /api/v1/settings/{key}
POST /api/v1/notifications/test
```

## Database Rules

- Default DB: PostgreSQL.
- TimescaleDB optional only.
- Use `TIMESTAMPTZ` for timestamps.
- Provide migrations and seed data.
- Seed gateway `raspi-gateway-01`.
- Seed sensors S1 and S2.
- Deduplicate readings with `(gateway_id, sensor_id, recorded_at)`.
- Bootstrap gateway token from `.env`, then store and validate hashed values in `api_tokens`.
- Store layout marker positions as 0–1 ratios.
- Do not add PUE/energy tables.

## Gateway Rules

- Gateway is hardware-first.
- Use Python.
- Use YAML config plus env override.
- Do not hardcode Modbus slave IDs, registers, backend URL, or token.
- Required diagnostic commands:

```bash
python -m gateway.cli diagnose ports
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
python -m gateway.cli diagnose sensor --sensor-code S1
python -m gateway.cli send-test
python -m gateway.cli run
```

- Send retry: 1 retry only.
- Failed send: write to bounded local JSONL buffer.
- Replay buffer slowly; latest realtime payload has priority.
- Gateway must not crash if one sensor fails.
- Gateway heartbeat must be sent every 60 seconds.

## ML Worker Rules

- Use Python.
- Load sensor data from PostgreSQL.
- Merge S1/S2 by timestamp.
- Resample to 1 minute for ML.
- Use chronological split, not random split.
- Feature columns:

```text
temperature_s1
humidity_s1
temperature_s2
humidity_s2
```

- Target: future S2 temperature.
- ML Worker reads training and inference inputs directly from PostgreSQL.
- ML Worker submits final inference output to protected `POST /api/v1/ml/predictions`.
- Backend owns final status classification, anomaly events, SSE, and Telegram decisions.
- Required artifacts:

```text
model.keras
feature_scaler.pkl
target_scaler.pkl
model_metadata.json
```

- Required metrics: RMSE, MAE, MAPE.
- Required baselines: persistence and moving average.
- Training is CLI/script-first. Dashboard training trigger is optional.
- Canonical CLI commands:

```bash
python -m ml_worker.cli train
python -m ml_worker.cli infer
python -m ml_worker.cli evaluate
```

## Verification Rules

Run relevant checks before saying done.

Expected checks by component:

```bash
# Backend
cd backend-go && go test ./...
cd backend-go && go build ./cmd/server

# Frontend
cd frontend-dashboard && npm install
cd frontend-dashboard && npm run build

# Gateway
cd gateway-rpi && python -m compileall src

# ML Worker
cd ml-worker && python -m compileall src
```

If a command cannot run because dependencies or environment are missing, report that clearly and do not pretend it passed.

## Security Rules

- Never commit real `.env` values.
- Never hardcode Telegram bot token.
- Never hardcode gateway token.
- Protect sensitive write endpoints with simple admin/internal token authentication.
- Mask sensitive settings in API responses.
- Do not print full tokens in logs.
- Keep `.env.example` safe and dummy.

## Git Rules

- Make small milestone commits.
- Do not rewrite history unless asked.
- Do not delete existing work without explicit approval.
- Before large changes, state what will be replaced.

## Definition of Done

A milestone is done only when:

1. The code matches `Dokumentasi/` scope.
2. Build/compile/test checks were run or clearly blocked.
3. No new out-of-scope feature was added.
4. No production dummy data is used.
5. Errors are handled safely.
6. README or runbook is updated if commands changed.
