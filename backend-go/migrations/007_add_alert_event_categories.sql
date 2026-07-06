BEGIN;

UPDATE anomaly_events
SET event_type = 'prediction_threshold'
WHERE event_type = 'thermal_status';

CREATE INDEX IF NOT EXISTS idx_anomaly_events_transition_lookup
    ON anomaly_events(event_type, sensor_id, detected_at DESC, id DESC);

COMMIT;
