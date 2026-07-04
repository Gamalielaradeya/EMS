BEGIN;

INSERT INTO gateways (
    gateway_code,
    name,
    location,
    status,
    expected_interval_seconds
)
VALUES (
    'raspi-gateway-01',
    'Raspberry Pi Gateway 01',
    'Server Testbed',
    'active',
    10
)
ON CONFLICT (gateway_code) DO NOTHING;

INSERT INTO sensors (
    gateway_id,
    sensor_code,
    sensor_role,
    name,
    type,
    modbus_slave_id,
    sensor_health_status
)
SELECT
    gateways.id,
    seed.sensor_code,
    seed.sensor_role,
    seed.name,
    'XY-MD02',
    seed.modbus_slave_id,
    'normal'
FROM gateways
CROSS JOIN (
    VALUES
        ('S1', 'ambient', 'S1 Ambient Sensor', 1),
        ('S2', 'hotspot', 'S2 Hotspot Sensor', 2)
) AS seed(sensor_code, sensor_role, name, modbus_slave_id)
WHERE gateways.gateway_code = 'raspi-gateway-01'
ON CONFLICT (gateway_id, sensor_code) DO NOTHING;

INSERT INTO settings (key, value, value_type, description, is_sensitive)
VALUES
    ('threshold_normal_max', '30.0', 'number', 'Predicted S2 temperature below this value is normal.', FALSE),
    ('threshold_anomaly_min', '32.0', 'number', 'Predicted S2 temperature above this value is anomaly.', FALSE),
    ('sensor_timeout_minutes', '5', 'number', 'Sensor or gateway trouble timeout in minutes.', FALSE),
    ('gateway_heartbeat_interval_seconds', '60', 'number', 'Gateway heartbeat interval in seconds.', FALSE),
    ('backend_offline_check_interval_seconds', '30', 'number', 'Backend offline checker interval in seconds.', FALSE),
    ('prediction_stale_ttl_minutes', '10', 'number', 'Prediction stale TTL in minutes.', FALSE),
    ('telegram_enabled', 'false', 'boolean', 'Enable Telegram notifications.', FALSE),
    ('telegram_bot_token', '', 'string', 'Telegram bot token. API responses must mask this value.', TRUE),
    ('telegram_chat_id', '', 'string', 'Telegram chat ID. API responses must mask this value.', TRUE),
    ('telegram_cooldown_minutes', '5', 'number', 'Telegram notification cooldown in minutes.', FALSE),
    ('raw_sampling_interval_seconds', '10', 'number', 'Gateway raw sensor sampling interval in seconds.', FALSE),
    ('ml_resample_interval_seconds', '60', 'number', 'ML resampling interval in seconds.', FALSE),
    ('lstm_window_size', '30', 'number', 'LSTM input window size in one-minute points.', FALSE),
    ('prediction_horizon_minutes', '5', 'number', 'Future S2 prediction horizon in minutes.', FALSE),
    ('active_gateway_code', 'raspi-gateway-01', 'string', 'Primary gateway code.', FALSE),
    ('actual_temperature_match_tolerance_seconds', '60', 'number', 'Nearest actual S2 reading tolerance in seconds.', FALSE)
ON CONFLICT (key) DO NOTHING;

-- Gateway token hashes are bootstrapped by the backend from GATEWAY_TOKEN.
-- Never seed or commit plaintext tokens.

COMMIT;
