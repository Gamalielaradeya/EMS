# EMS Thermal LSTM Milestones

Canonical plan source: `Dokumentasi/10_Codex_Implementation_Runbook.md`.

| Milestone | Name | Status |
|---|---|---|
| `-1` | Documentation Lock | Done |
| `0` | Repository Foundation | Done |
| `1` | Database Migrations and Seed | Done |
| `2` | Backend Core API | Not started |
| `3` | Gateway Diagnostic and Delivery | Not started |
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

Milestone `2` requires explicit user approval.
