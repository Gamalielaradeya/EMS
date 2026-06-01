BEGIN;

CREATE TABLE IF NOT EXISTS gateways (
    id BIGSERIAL PRIMARY KEY,
    gateway_code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    ip_address INET,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    expected_interval_seconds INT NOT NULL DEFAULT 10,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_gateway_status CHECK (status IN ('active', 'offline', 'trouble', 'maintenance'))
);

CREATE INDEX IF NOT EXISTS idx_gateways_status ON gateways(status);
CREATE INDEX IF NOT EXISTS idx_gateways_last_seen ON gateways(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS api_tokens (
    id BIGSERIAL PRIMARY KEY,
    gateway_id BIGINT NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    name VARCHAR(150),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_gateway_active
    ON api_tokens(gateway_id, is_active);

COMMIT;
