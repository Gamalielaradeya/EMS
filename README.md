# EMS Thermal LSTM

Hardware-first thesis engineering prototype for an **Early Warning System pada EMS Server** using LSTM-based S2 temperature forecasting five minutes ahead.

Main flow:

```text
XY-MD02 S1/S2 -> Raspberry Pi gateway -> Go backend -> PostgreSQL -> React dashboard
PostgreSQL -> Python ML worker -> protected backend prediction endpoint -> early warning + Telegram
```

## Documentation

Canonical project documentation lives in [`Dokumentasi/`](Dokumentasi/).

Read in order:

1. `Dokumentasi/00_Project_Direction_Final.md`
2. `Dokumentasi/01_System_Scope_and_Features_Final.md`
3. `Dokumentasi/02_Hardware_and_Gateway_Final.md`
4. `Dokumentasi/03_System_Architecture_Final.md`
5. `Dokumentasi/04_Database_Design_Final.md`
6. `Dokumentasi/05_Backend_API_Final.md`
7. `Dokumentasi/06_ML_Worker_LSTM_Final.md`
8. `Dokumentasi/07_Frontend_Dashboard_Final.md`
9. `Dokumentasi/08_Alert_and_Telegram_Final.md`
10. `Dokumentasi/09_Test_Plan_Final.md`
11. `Dokumentasi/10_Codex_Implementation_Runbook.md`

Project control:

- `DECISIONS.md`
- `MILESTONES.md`
- `IMPLEMENTATION_LOG.md`
- `TEST_LOG.md`
- `Dokumentasi/M10_EVIDENCE_CHECKLIST.md`

Milestone `-1` Documentation Lock is complete.

## Repository Structure

```text
backend-go/          Go backend
frontend-dashboard/ React dashboard
gateway-rpi/         Raspberry Pi Python gateway
ml-worker/           Python LSTM worker
scripts/             Local development helpers
Dokumentasi/         Canonical project documentation
```

## PostgreSQL Database

PostgreSQL is the default database. TimescaleDB remains optional and is not required.

Create a local environment file from `.env.example`, start PostgreSQL, and apply migrations:

```powershell
Copy-Item .env.example .env
docker compose config --quiet
docker compose up -d postgres
./scripts/run-migrations-docker.ps1
```

The values in `.env.example` are dummy development placeholders. Do not commit real tokens or passwords.

The migration runner applies the seed file after the schema files. To rerun seed data only:

```powershell
./scripts/seed-docker.ps1
```

If port `5432` is already used locally, set `POSTGRES_PORT` in the local `.env` file to another host port such as `55432`.

## Milestone Status

Milestones `-1` through `9` and local integration Milestone `10A` are complete.
Milestone `10B` remains pending for Raspberry Pi hardware validation, real
TensorFlow training evidence, enabled Telegram evidence, and final Bab 4
capture. Current model evidence must remain honest: the LSTM pipeline works,
but persistence and moving-average baselines may outperform LSTM on the current
dataset.
