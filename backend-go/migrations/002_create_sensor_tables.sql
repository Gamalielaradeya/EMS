BEGIN;

CREATE TABLE IF NOT EXISTS sensors (
    id BIGSERIAL PRIMARY KEY,
    gateway_id BIGINT REFERENCES gateways(id) ON DELETE SET NULL,
    sensor_code VARCHAR(20) NOT NULL,
    sensor_role VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'XY-MD02',
    location VARCHAR(255),
    modbus_slave_id INT,
    sensor_health_status VARCHAR(30) NOT NULL DEFAULT 'normal',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_sensor_code CHECK (sensor_code IN ('S1', 'S2')),
    CONSTRAINT chk_sensor_role CHECK (sensor_role IN ('ambient', 'hotspot')),
    CONSTRAINT chk_sensor_health_status CHECK (sensor_health_status IN ('normal', 'trouble', 'inactive')),
    CONSTRAINT uq_gateway_sensor_code UNIQUE (gateway_id, sensor_code)
);

CREATE INDEX IF NOT EXISTS idx_sensors_code ON sensors(sensor_code);
CREATE INDEX IF NOT EXISTS idx_sensors_health_status ON sensors(sensor_health_status);
CREATE INDEX IF NOT EXISTS idx_sensors_last_seen ON sensors(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id BIGSERIAL PRIMARY KEY,
    gateway_id BIGINT NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
    sensor_id BIGINT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    temperature NUMERIC(6,2) NOT NULL,
    humidity NUMERIC(6,2) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    quality_status VARCHAR(30) NOT NULL DEFAULT 'valid',
    source VARCHAR(30) NOT NULL DEFAULT 'hardware',
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_temperature_range CHECK (temperature >= 0 AND temperature <= 80),
    CONSTRAINT chk_humidity_range CHECK (humidity >= 0 AND humidity <= 100),
    CONSTRAINT chk_quality_status CHECK (quality_status IN ('valid', 'invalid', 'timeout', 'simulated')),
    CONSTRAINT chk_reading_source CHECK (source IN ('hardware', 'simulator', 'replay')),
    CONSTRAINT uq_sensor_reading_dedupe UNIQUE (gateway_id, sensor_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at
    ON sensor_readings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_recorded
    ON sensor_readings(sensor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_gateway_recorded
    ON sensor_readings(gateway_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_quality
    ON sensor_readings(quality_status);

CREATE TABLE IF NOT EXISTS gateway_status_logs (
    id BIGSERIAL PRIMARY KEY,
    gateway_id BIGINT REFERENCES gateways(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL,
    message TEXT,
    payload JSONB,
    reported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_gateway_status_log_status CHECK (status IN ('active', 'offline', 'trouble', 'maintenance'))
);

CREATE INDEX IF NOT EXISTS idx_gateway_status_logs_gateway_time
    ON gateway_status_logs(gateway_id, reported_at DESC);

COMMIT;
