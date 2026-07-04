# Scripts

Local development helper scripts live in this folder.

Database helpers:

| Script | Purpose |
|---|---|
| `run-migrations-docker.ps1` | Apply all SQL migrations through the Compose PostgreSQL container |
| `seed-docker.ps1` | Reapply idempotent seed data through the Compose container |
| `run-migrations.ps1` | Apply all SQL migrations with a locally installed `psql` |
| `seed.ps1` | Reapply seed data with a locally installed `psql` |
| `run-migrations.sh` | Bash equivalent for local `psql` |
| `seed.sh` | Bash seed equivalent for local `psql` |

Docker PowerShell usage from the repository root:

```powershell
docker compose up -d postgres
./scripts/run-migrations-docker.ps1
```
