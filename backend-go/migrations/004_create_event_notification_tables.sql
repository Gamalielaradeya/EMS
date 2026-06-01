BEGIN;

CREATE TABLE IF NOT EXISTS anomaly_events (
    id BIGSERIAL PRIMARY KEY,
    prediction_id BIGINT REFERENCES predictions(id) ON DELETE SET NULL,
    sensor_id BIGINT REFERENCES sensors(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL DEFAULT 'thermal_status',
    status VARCHAR(30) NOT NULL,
    severity VARCHAR(30) NOT NULL,
    predicted_temperature NUMERIC(6,2),
    actual_temperature NUMERIC(6,2),
    threshold_normal_max NUMERIC(6,2),
    threshold_anomaly_min NUMERIC(6,2),
    description TEXT,
    detected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_anomaly_event_status CHECK (status IN ('normal', 'waspada', 'anomali', 'trouble')),
    CONSTRAINT chk_anomaly_event_severity CHECK (severity IN ('info', 'warning', 'critical', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_anomaly_events_detected_at
    ON anomaly_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_status
    ON anomaly_events(status);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_sensor_time
    ON anomaly_events(sensor_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS notification_logs (
    id BIGSERIAL PRIMARY KEY,
    anomaly_event_id BIGINT REFERENCES anomaly_events(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'telegram',
    recipient VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notification_status CHECK (status IN ('pending', 'sent', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at
    ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status
    ON notification_logs(status);

COMMIT;
