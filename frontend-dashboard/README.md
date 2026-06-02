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

## Implemented Surface

The application shell uses the locked six-menu sidebar:

```text
Dashboard
Sensors & Readings
Prediction & LSTM
Layout
Events & Logs
Settings
```

The Dashboard page reads `GET /api/v1/dashboard/summary` and bounded
`GET /api/v1/readings/history` data. It shows current S1/S2 measurements,
gateway state, last-update time, readings count, and temperature/humidity
history charts.

The Sensors & Readings page reads `GET /api/v1/sensors`,
`GET /api/v1/readings/latest`, and `GET /api/v1/readings/history`. It provides
live sensor cards, metadata, Chart.js history charts, responsive history
table/card views, manual refresh, and filters for:

```text
sensor_code
from
to
quality_status
limit
```

The frontend listens to `GET /api/v1/events` and refreshes active data when
`reading.latest`, `gateway.status`, `sensor.trouble`, `prediction.latest`,
`anomaly.created`, `notification.sent`, or `system.log` arrives.
Loading, empty, unavailable, and SSE-disconnected states remain safe.

The Prediction & LSTM page reads prediction history, model versions, active
metrics, and baseline comparison APIs. It shows explicit model-not-ready and
no-prediction states. Model activation is enabled only when a local
`VITE_ADMIN_TOKEN` is configured. Layout and full settings pages remain
deferred.
