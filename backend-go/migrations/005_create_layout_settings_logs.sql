BEGIN;

CREATE TABLE IF NOT EXISTS layouts (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    image_path TEXT NOT NULL,
    image_width INT,
    image_height INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_layouts_active ON layouts(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_layouts_one_active
    ON layouts(is_active)
    WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS layout_devices (
    id BIGSERIAL PRIMARY KEY,
    layout_id BIGINT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
    sensor_id BIGINT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    label VARCHAR(150),
    position_x NUMERIC(6,4) NOT NULL,
    position_y NUMERIC(6,4) NOT NULL,
    icon VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_layout_sensor UNIQUE (layout_id, sensor_id),
    CONSTRAINT chk_position_x CHECK (position_x >= 0 AND position_x <= 1),
    CONSTRAINT chk_position_y CHECK (position_y >= 0 AND position_y <= 1)
);

CREATE TABLE IF NOT EXISTS settings (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    value_type VARCHAR(30) NOT NULL DEFAULT 'string',
    description TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_setting_value_type CHECK (value_type IN ('string', 'number', 'boolean', 'json'))
);

CREATE TABLE IF NOT EXISTS system_logs (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    level VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_system_log_level CHECK (level IN ('info', 'warning', 'error', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at
    ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_source_level
    ON system_logs(source, level);

COMMIT;
