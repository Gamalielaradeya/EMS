BEGIN;

CREATE TABLE IF NOT EXISTS model_versions (
    id BIGSERIAL PRIMARY KEY,
    model_name VARCHAR(150) NOT NULL,
    model_type VARCHAR(50) NOT NULL DEFAULT 'LSTM',
    version VARCHAR(50) NOT NULL,
    algorithm VARCHAR(100) NOT NULL DEFAULT 'Long Short-Term Memory',
    feature_columns JSONB NOT NULL,
    target_column VARCHAR(100) NOT NULL DEFAULT 'temperature_s2_future',
    window_size INT NOT NULL DEFAULT 30,
    horizon_minutes INT NOT NULL DEFAULT 5,
    raw_sampling_interval_seconds INT NOT NULL DEFAULT 10,
    resample_interval_seconds INT NOT NULL DEFAULT 60,
    model_path TEXT NOT NULL,
    feature_scaler_path TEXT NOT NULL,
    target_scaler_path TEXT NOT NULL,
    metadata_path TEXT,
    parameters JSONB,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    trained_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_model_version UNIQUE (model_name, version)
);

CREATE INDEX IF NOT EXISTS idx_model_versions_active
    ON model_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_model_versions_trained_at
    ON model_versions(trained_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_model_versions_one_active
    ON model_versions(is_active)
    WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS prediction_runs (
    id BIGSERIAL PRIMARY KEY,
    model_version_id BIGINT REFERENCES model_versions(id) ON DELETE SET NULL,
    run_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    message TEXT,
    metadata JSONB,
    CONSTRAINT chk_prediction_run_type CHECK (run_type IN ('training', 'inference', 'batch_inference')),
    CONSTRAINT chk_prediction_run_status CHECK (status IN ('running', 'success', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_prediction_runs_model_time
    ON prediction_runs(model_version_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_type_status
    ON prediction_runs(run_type, status);

CREATE TABLE IF NOT EXISTS model_metrics (
    id BIGSERIAL PRIMARY KEY,
    model_version_id BIGINT NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
    dataset_start_at TIMESTAMPTZ,
    dataset_end_at TIMESTAMPTZ,
    train_size INT,
    validation_size INT,
    test_size INT,
    rmse NUMERIC(10,4) NOT NULL,
    mae NUMERIC(10,4) NOT NULL,
    mape NUMERIC(10,4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_metrics_model_created
    ON model_metrics(model_version_id, created_at DESC);

CREATE TABLE IF NOT EXISTS baseline_results (
    id BIGSERIAL PRIMARY KEY,
    model_version_id BIGINT REFERENCES model_versions(id) ON DELETE CASCADE,
    baseline_type VARCHAR(50) NOT NULL,
    rmse NUMERIC(10,4) NOT NULL,
    mae NUMERIC(10,4) NOT NULL,
    mape NUMERIC(10,4) NOT NULL,
    parameters JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_baseline_type CHECK (baseline_type IN ('persistence', 'moving_average'))
);

CREATE INDEX IF NOT EXISTS idx_baseline_results_model_type
    ON baseline_results(model_version_id, baseline_type);

CREATE TABLE IF NOT EXISTS predictions (
    id BIGSERIAL PRIMARY KEY,
    prediction_run_id BIGINT REFERENCES prediction_runs(id) ON DELETE SET NULL,
    model_version_id BIGINT REFERENCES model_versions(id) ON DELETE SET NULL,
    target_sensor_id BIGINT REFERENCES sensors(id) ON DELETE SET NULL,
    predicted_temperature NUMERIC(6,2) NOT NULL,
    actual_temperature NUMERIC(6,2),
    input_window_start_at TIMESTAMPTZ,
    input_window_end_at TIMESTAMPTZ,
    predicted_for TIMESTAMPTZ NOT NULL,
    thermal_status VARCHAR(30) NOT NULL,
    final_status VARCHAR(30) NOT NULL,
    threshold_normal_max NUMERIC(6,2) NOT NULL DEFAULT 30.0,
    threshold_anomaly_min NUMERIC(6,2) NOT NULL DEFAULT 32.0,
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_prediction_thermal_status CHECK (thermal_status IN ('normal', 'waspada', 'anomali')),
    CONSTRAINT chk_prediction_final_status CHECK (final_status IN ('normal', 'waspada', 'anomali', 'trouble'))
);

CREATE INDEX IF NOT EXISTS idx_predictions_created_at
    ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_predicted_for
    ON predictions(predicted_for DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_final_status
    ON predictions(final_status);
CREATE INDEX IF NOT EXISTS idx_predictions_model_time
    ON predictions(model_version_id, created_at DESC);

COMMIT;
