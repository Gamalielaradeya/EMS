# EMS Thermal LSTM Decision Log

## Locked Decisions

Approved during Milestone `-1` Documentation Lock.

| ID | Decision |
|---|---|
| DEC-001 | Canonical documentation path is `Dokumentasi/`. |
| DEC-002 | `Dokumentasi/10_Codex_Implementation_Runbook.md` is mandatory operational runbook. |
| DEC-003 | ML Worker reads PostgreSQL directly, but submits final inference results through protected `POST /api/v1/ml/predictions`. Backend owns final status classification, anomaly events, SSE, and Telegram decisions. |
| DEC-004 | Status is separated into `sensor_health_status`, `thermal_status`, and assembled `final_status`. Priority: `trouble > anomali > waspada > normal`. |
| DEC-005 | Reading dedupe key is `(gateway_id, sensor_id, recorded_at)`. |
| DEC-006 | Gateway token is bootstrapped from `.env`, then stored and validated as hash in `api_tokens`. Full token is never displayed in UI. |
| DEC-007 | Sensitive write endpoints use simple admin/internal token protection: settings updates, model activation, layout upload/update, Telegram test, and ML prediction submission. |
| DEC-008 | Gateway heartbeat interval is 60 seconds. Backend offline checker interval is 30 seconds. Sensor/gateway becomes trouble after more than 5 minutes without data. |
| DEC-009 | Prediction stale TTL is 10 minutes. Stale predictions remain in history but cannot drive active dashboard status or Telegram alerts. |
| DEC-010 | Actual S2 temperature is matched to nearest reading around `predicted_for` with tolerance `+/-60 seconds`. If no reading exists, keep `actual_temperature = null`. |
| DEC-011 | Canonical gateway CLI uses `python -m gateway.cli ...`. Canonical ML CLI uses `python -m ml_worker.cli train`, `infer`, and `evaluate`. |
| DEC-012 | Simulator is development helper only. Thesis evidence prioritizes `source = 'hardware'` and `quality_status = 'valid'`. |

## Scope Guard

Do not add PUE, energy optimization, automatic cooling, fan/AC/relay control, enterprise monitoring stack, complex RBAC, mobile app, or Raspberry Pi LSTM training.
