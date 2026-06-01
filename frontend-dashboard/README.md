# Frontend Dashboard

React, Vite, and TypeScript dashboard foundation for EMS Thermal LSTM.

## Setup

```powershell
cd frontend-dashboard
Copy-Item .env.example .env.local
npm install
npm run dev
```

The frontend defaults to `http://localhost:8080/api/v1`. Override the API and
SSE URLs locally when the backend uses another port:

```dotenv
VITE_API_BASE_URL=http://localhost:8081/api/v1
VITE_SSE_URL=http://localhost:8081/api/v1/events
```

Do not commit `.env.local`.

## Commands

```powershell
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Milestone 4 Surface

The application shell uses the locked six-menu sidebar:

```text
Dashboard
Sensors & Readings
Prediction & LSTM
Layout
Events & Logs
Settings
```

The Dashboard page reads `GET /api/v1/dashboard/summary`, listens to
`GET /api/v1/events`, and refreshes when backend SSE events arrive. It includes
loading, empty, and unavailable states so a stopped backend does not break the
shell.

The remaining pages are intentional Milestone `4` placeholders. Realtime sensor
tables and charts belong to Milestone `5`; prediction, layout, Telegram, and ML
worker detail remain deferred to their planned milestones.
