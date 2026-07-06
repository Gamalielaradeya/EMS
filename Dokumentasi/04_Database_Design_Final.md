# 04 Database Design Final — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini menjelaskan rancangan database final untuk project **EMS Thermal LSTM**. Database menjadi pusat penyimpanan data sensor, gateway, hasil prediksi LSTM, evaluasi model, layout sensor, notifikasi Telegram, settings, dan system logs.

Dokumen ini menjadi pegangan Codex untuk membuat migration, seed data, query repository, dan integrasi backend/ML Worker.

---

## 2. Database Engine

Database utama:

```text
PostgreSQL
```

TimescaleDB bersifat opsional.

Aturan:

1. Sistem wajib berjalan dengan PostgreSQL biasa.
2. TimescaleDB boleh diaktifkan jika tersedia.
3. Jika TimescaleDB tidak tersedia, gunakan index timestamp pada tabel time-series.
4. Jangan membuat sistem bergantung mutlak pada TimescaleDB.

---

## 3. Prinsip Desain Database

1. **Time-series oriented** — data sensor disimpan berdasarkan timestamp `recorded_at`.
2. **Hardware traceable** — setiap reading dapat dilacak ke gateway dan sensor sumber.
3. **ML traceable** — setiap prediksi dapat dilacak ke model version dan prediction run.
4. **Dashboard-ready** — query harus mendukung dashboard summary, grafik, layout, dan event table.
5. **Configurable threshold** — threshold normal/anomali disimpan di `settings`.
6. **Safe logging** — error backend, gateway, ML Worker, dan Telegram dicatat dalam `system_logs`.
7. **Simple enough for thesis** — schema lengkap, tetapi tidak dibuat enterprise.

---

## 4. Naming Convention

| Item | Convention | Contoh |
|---|---|---|
| Table | snake_case plural | `sensor_readings` |
| Primary key | `id` | `id BIGSERIAL PRIMARY KEY` |
| Foreign key | `<entity>_id` | `sensor_id` |
| Timestamp event | `<event>_at` | `recorded_at`, `detected_at` |
| Created time | `created_at` | `created_at TIMESTAMPTZ` |
| Updated time | `updated_at` | `updated_at TIMESTAMPTZ` |
| Status value | lowercase string | `normal`, `waspada`, `anomali` |

---

## 5. Entity Overview

| Tabel | Fungsi |
|---|---|
| `gateways` | Menyimpan identitas Raspberry Pi gateway |
| `api_tokens` | Token autentikasi gateway |
| `sensors` | Menyimpan identitas sensor S1/S2 |
| `sensor_readings` | Menyimpan data suhu/kelembaban time-series |
| `gateway_status_logs` | Menyimpan heartbeat/status gateway dan sensor |
| `model_versions` | Menyimpan versi model LSTM dan artifact |
| `prediction_runs` | Menyimpan proses training/inference |
| `model_metrics` | Menyimpan RMSE, MAE, MAPE LSTM |
| `baseline_results` | Menyimpan hasil baseline persistence/moving average |
| `predictions` | Menyimpan hasil prediksi suhu S2 |
| `anomaly_events` | Menyimpan event normal/waspada/anomali/trouble |
| `notification_logs` | Menyimpan riwayat Telegram notification |
| `layouts` | Menyimpan layout/denah aktif |
| `layout_devices` | Menyimpan posisi marker sensor di layout |
| `settings` | Menyimpan konfigurasi threshold, Telegram, ML, gateway |
| `system_logs` | Menyimpan log sistem lintas komponen |

---

## 6. ERD Ringkas

```text
gateways 1 ────< sensors
gateways 1 ────< sensor_readings
gateways 1 ────< gateway_status_logs
gateways 1 ────< api_tokens

sensors 1 ────< sensor_readings
sensors 1 ────< predictions
sensors 1 ────< anomaly_events
sensors 1 ────< layout_devices

model_versions 1 ────< prediction_runs
model_versions 1 ────< model_metrics
model_versions 1 ────< baseline_results
model_versions 1 ────< predictions

prediction_runs 1 ────< predictions
predictions 1 ────< anomaly_events
anomaly_events 1 ────< notification_logs
layouts 1 ────< layout_devices
```

---

## 7. Status Values

Gunakan `VARCHAR` dengan `CHECK` constraint agar fleksibel saat development.

| Status Group | Values |
|---|---|
| Sensor code | `S1`, `S2` |
| Sensor role | `ambient`, `hotspot` |
| Sensor health status | `normal`, `trouble`, `inactive` |
| Thermal status | `normal`, `waspada`, `anomali` |
| Final status | `normal`, `waspada`, `anomali`, `trouble` |
| Gateway status | `active`, `offline`, `trouble`, `maintenance` |
| Data quality | `valid`, `invalid`, `timeout`, `simulated` |
| Run type | `training`, `inference`, `batch_inference` |
| Run status | `running`, `success`, `failed`, `skipped` |
| Notification status | `pending`, `sent`, `failed`, `skipped` |
| Log level | `info`, `warning`, `error`, `critical` |

---

## 8. Table Design Detail

### 8.1 `gateways`

```sql
CREATE TABLE gateways (
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
CREATE INDEX idx_gateways_status ON gateways(status);
CREATE INDEX idx_gateways_last_seen ON gateways(last_seen_at DESC);
```

### 8.2 `api_tokens`

```sql
CREATE TABLE api_tokens (
    id BIGSERIAL PRIMARY KEY,
    gateway_id BIGINT NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    name VARCHAR(150),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
```

Catatan: token awal di-bootstrap dari `.env`. Backend menyimpan dan memvalidasi hash token pada tabel ini. Full token tidak boleh disimpan sebagai plaintext atau ditampilkan di UI.

### 8.3 `sensors`

```sql
CREATE TABLE sensors (
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
CREATE INDEX idx_sensors_code ON sensors(sensor_code);
CREATE INDEX idx_sensors_health_status ON sensors(sensor_health_status);
CREATE INDEX idx_sensors_last_seen ON sensors(last_seen_at DESC);
```

Seed awal:

| sensor_code | sensor_role | name | modbus_slave_id |
|---|---|---|---:|
| S1 | ambient | S1 Ambient Sensor | 1 |
| S2 | hotspot | S2 Hotspot Sensor | 2 |

### 8.4 `sensor_readings`

Tabel time-series utama.

```sql
CREATE TABLE sensor_readings (
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
CREATE INDEX idx_sensor_readings_recorded_at ON sensor_readings(recorded_at DESC);
CREATE INDEX idx_sensor_readings_sensor_recorded ON sensor_readings(sensor_id, recorded_at DESC);
CREATE INDEX idx_sensor_readings_gateway_recorded ON sensor_readings(gateway_id, recorded_at DESC);
CREATE INDEX idx_sensor_readings_quality ON sensor_readings(quality_status);
```

Optional TimescaleDB:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
SELECT create_hypertable('sensor_readings', 'recorded_at', if_not_exists => TRUE);
```

Aturan:

1. Data raw 10 detik disimpan di tabel ini.
2. ML Worker melakukan resample 1 menit dari tabel ini.
3. Query chart wajib memakai filter waktu.

### 8.5 `gateway_status_logs`

```sql
CREATE TABLE gateway_status_logs (
    id BIGSERIAL PRIMARY KEY,
    gateway_id BIGINT REFERENCES gateways(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL,
    message TEXT,
    payload JSONB,
    reported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_gateway_status_log_status CHECK (status IN ('active', 'offline', 'trouble', 'maintenance'))
);
CREATE INDEX idx_gateway_status_logs_gateway_time ON gateway_status_logs(gateway_id, reported_at DESC);
```

### 8.6 `model_versions`

```sql
CREATE TABLE model_versions (
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
CREATE INDEX idx_model_versions_active ON model_versions(is_active);
CREATE INDEX idx_model_versions_trained_at ON model_versions(trained_at DESC);
CREATE UNIQUE INDEX uq_model_versions_one_active ON model_versions(is_active) WHERE is_active = TRUE;
```

Aturan: hanya satu model aktif. Aktivasi model harus dilakukan dengan transaksi.

### 8.7 `prediction_runs`

```sql
CREATE TABLE prediction_runs (
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
CREATE INDEX idx_prediction_runs_model_time ON prediction_runs(model_version_id, started_at DESC);
CREATE INDEX idx_prediction_runs_type_status ON prediction_runs(run_type, status);
```

### 8.8 `model_metrics`

```sql
CREATE TABLE model_metrics (
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
CREATE INDEX idx_model_metrics_model_created ON model_metrics(model_version_id, created_at DESC);
```

### 8.9 `baseline_results`

```sql
CREATE TABLE baseline_results (
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
CREATE INDEX idx_baseline_results_model_type ON baseline_results(model_version_id, baseline_type);
```

### 8.10 `predictions`

```sql
CREATE TABLE predictions (
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
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX idx_predictions_predicted_for ON predictions(predicted_for DESC);
CREATE INDEX idx_predictions_final_status ON predictions(final_status);
CREATE INDEX idx_predictions_model_time ON predictions(model_version_id, created_at DESC);
```

### 8.11 `anomaly_events`

```sql
CREATE TABLE anomaly_events (
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
CREATE INDEX idx_anomaly_events_detected_at ON anomaly_events(detected_at DESC);
CREATE INDEX idx_anomaly_events_status ON anomaly_events(status);
CREATE INDEX idx_anomaly_events_sensor_time ON anomaly_events(sensor_id, detected_at DESC);
```

Aturan: `waspada`, `anomali`, dan `trouble` wajib disimpan. Recovery `normal` boleh diaktifkan untuk histori lengkap.

### 8.12 `notification_logs`

```sql
CREATE TABLE notification_logs (
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
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
```

### 8.13 `layouts`

```sql
CREATE TABLE layouts (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    image_path TEXT NOT NULL,
    image_width INT,
    image_height INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_layouts_active ON layouts(is_active);
CREATE UNIQUE INDEX uq_layouts_one_active ON layouts(is_active) WHERE is_active = TRUE;
```

Versi awal cukup mendukung satu layout aktif.

### 8.14 `layout_devices`

```sql
CREATE TABLE layout_devices (
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
```

`position_x` dan `position_y` disimpan sebagai rasio 0–1 agar responsif terhadap ukuran gambar.

### 8.15 `settings`

```sql
CREATE TABLE settings (
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
```

Seed settings awal:

| key | value | type | sensitive |
|---|---|---|---|
| `threshold_normal_max` | `30.0` | number | false |
| `threshold_anomaly_min` | `32.0` | number | false |
| `sensor_timeout_minutes` | `5` | number | false |
| `gateway_heartbeat_interval_seconds` | `60` | number | false |
| `backend_offline_check_interval_seconds` | `30` | number | false |
| `prediction_stale_ttl_minutes` | `10` | number | false |
| `telegram_enabled` | `false` | boolean | false |
| `telegram_bot_token` | `` | string | true |
| `telegram_chat_id` | `` | string | true |
| `telegram_cooldown_minutes` | `5` | number | false |
| `raw_sampling_interval_seconds` | `10` | number | false |
| `ml_resample_interval_seconds` | `60` | number | false |
| `lstm_window_size` | `30` | number | false |
| `prediction_horizon_minutes` | `5` | number | false |
| `active_gateway_code` | `raspi-gateway-01` | string | false |
| `actual_temperature_match_tolerance_seconds` | `60` | number | false |

### 8.16 `system_logs`

```sql
CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    level VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_system_log_level CHECK (level IN ('info', 'warning', 'error', 'critical'))
);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX idx_system_logs_source_level ON system_logs(source, level);
```

Source yang digunakan:

```text
backend
gateway
ml-worker
telegram
database
frontend
```

---

## 9. Seed Data Awal

### 9.1 Gateway

```text
gateway_code: raspi-gateway-01
name: Raspberry Pi Gateway 01
location: Server Testbed
status: active
expected_interval_seconds: 10
```

### 9.2 Sensors

```text
S1 / ambient / S1 Ambient Sensor / slave_id 1
S2 / hotspot / S2 Hotspot Sensor / slave_id 2
```

### 9.3 Settings

Masukkan settings sesuai daftar pada bagian `settings`.

### 9.4 API Token

Buat token development melalui env atau seed. Jangan commit token production.

---

## 10. Query Pattern yang Harus Didukung

### 10.1 Latest Readings per Sensor

```sql
SELECT DISTINCT ON (s.sensor_code)
    s.sensor_code,
    s.sensor_role,
    sr.temperature,
    sr.humidity,
    sr.quality_status,
    sr.recorded_at,
    s.sensor_health_status
FROM sensor_readings sr
JOIN sensors s ON s.id = sr.sensor_id
ORDER BY s.sensor_code, sr.recorded_at DESC;
```

### 10.2 History Readings

Filter:

1. Sensor code.
2. From.
3. To.
4. Quality status.
5. Limit.

### 10.3 Dashboard Summary

Dashboard summary membutuhkan:

1. Latest readings S1/S2.
2. Latest prediction.
3. Active model.
4. Latest metrics.
5. Recent status events.
6. Gateway status.
7. Telegram enabled.
8. Today total readings/events.

### 10.4 ML Dataset Loader

```sql
SELECT
    s.sensor_code,
    sr.temperature,
    sr.humidity,
    sr.recorded_at
FROM sensor_readings sr
JOIN sensors s ON s.id = sr.sensor_id
WHERE sr.quality_status IN ('valid', 'simulated')
  AND sr.recorded_at BETWEEN $1 AND $2
ORDER BY sr.recorded_at ASC;
```

Untuk hasil skripsi hardware, prioritaskan `quality_status = 'valid'` dan `source = 'hardware'`.

---

## 11. Transaction Rules

### 11.1 Insert Reading

Saat backend menerima reading:

1. Validasi gateway token.
2. Ambil/buat gateway.
3. Ambil sensor berdasarkan gateway dan sensor code.
4. Insert sensor readings.
5. Update gateway `last_seen_at`.
6. Update sensor `last_seen_at`.
7. Emit SSE event.

Gunakan transaksi jika memungkinkan.

### 11.2 Activate Model

Saat activate model:

1. Set semua model `is_active = false`.
2. Set model target `is_active = true`.
3. Simpan system log.

Wajib dalam transaksi agar hanya satu model aktif.

### 11.3 Create Prediction and Event

Saat backend menerima hasil inference melalui `POST /api/v1/ml/predictions`:

1. Tentukan `thermal_status`.
2. Ambil `sensor_health_status`.
3. Susun `final_status` dengan prioritas `trouble > anomali > waspada > normal`.
4. Tentukan `is_stale` berdasarkan TTL 10 menit.
5. Insert prediction.
6. Jika final status waspada/anomali/trouble dan prediction tidak stale, insert anomaly event.
7. Trigger notification logic hanya jika prediction tidak stale.
8. Emit SSE event.

### 11.4 Actual Temperature Matching

Isi `actual_temperature` menggunakan reading S2 terdekat dengan `predicted_for` dalam tolerance `+/-60 detik`. Jika tidak ada reading pada tolerance tersebut, biarkan `actual_temperature` bernilai `NULL`.

---

## 12. Migration Strategy

Gunakan migration SQL berurutan.

```text
backend-go/migrations/
├── 001_create_gateways.sql
├── 002_create_sensors.sql
├── 003_create_sensor_readings.sql
├── 004_create_ml_tables.sql
├── 005_create_events_notifications.sql
├── 006_create_layouts.sql
├── 007_create_settings_logs.sql
└── 008_seed_initial_data.sql
```

Aturan:

1. Migration harus dapat dijalankan dari repo baru.
2. Jangan mengandalkan database manual.
3. Seed data awal wajib ada.
4. Migration harus idempotent jika memungkinkan.

---

## 13. Database Environment

`.env.example` backend:

```env
DATABASE_URL=postgres://ems_user:ems_password@localhost:5432/ems_thermal_lstm?sslmode=disable
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ems_thermal_lstm
DB_USER=ems_user
DB_PASSWORD=ems_password
```

Docker Compose PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: ems_thermal_lstm_postgres
    environment:
      POSTGRES_DB: ems_thermal_lstm
      POSTGRES_USER: ems_user
      POSTGRES_PASSWORD: ems_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

TimescaleDB optional dapat memakai image:

```text
timescale/timescaledb:latest-pg16
```

Default tetap PostgreSQL biasa.

---

## 14. Database Acceptance Criteria

| Kode | Kriteria |
|---|---|
| DB-001 | PostgreSQL dapat dijalankan secara lokal |
| DB-002 | Migration berhasil membuat semua tabel |
| DB-003 | Seed gateway dan sensor berhasil dibuat |
| DB-004 | Sensor readings dapat disimpan |
| DB-005 | Latest readings S1/S2 dapat di-query |
| DB-006 | History readings dapat difilter waktu dan sensor |
| DB-007 | Model version dan metrics dapat disimpan |
| DB-008 | Prediction dapat disimpan dan dilacak ke model |
| DB-009 | Status events dapat disimpan pada tabel internal `anomaly_events` |
| DB-010 | Notification logs dapat disimpan |
| DB-011 | Layout dan marker sensor dapat disimpan |
| DB-012 | Settings dapat dibaca dan diubah |
| DB-013 | System logs dapat disimpan |
| DB-014 | Model activation hanya menghasilkan satu active model |
| DB-015 | Query dashboard summary dapat dibuat tanpa mengambil seluruh database |

---

## 15. Instruksi untuk Codex

Saat membuat database, Codex harus:

1. Membuat migration SQL lengkap.
2. Membuat seed data awal.
3. Menggunakan PostgreSQL sebagai default.
4. Membuat TimescaleDB optional, bukan wajib.
5. Membuat index untuk query time-series.
6. Menggunakan `TIMESTAMPTZ` untuk semua timestamp event.
7. Menggunakan constraint untuk status penting.
8. Menyimpan posisi layout sebagai rasio 0–1.
9. Menyediakan query repository yang efisien.
10. Tidak membuat tabel PUE atau energy optimization.
11. Tidak membuat schema enterprise multi-tenant.
12. Menjaga database tetap mudah dijelaskan dalam Bab 4.
## Alert Category Documentation Lock Addendum

`anomaly_events` tetap menjadi tabel event tunggal. Nilai canonical `event_type`:

```text
actual_threshold     -> Alarm aktual S1/S2
prediction_threshold -> Pre-Alarm prediksi S2
sensor_trouble       -> Trouble sensor
gateway_trouble      -> Trouble gateway
```

Status tetap `normal`, `waspada`, `anomali`, atau `trouble`. Baris `normal` setelah event non-normal merepresentasikan Recovery. Event baru hanya dibuat jika status terakhir untuk kombinasi entity dan `event_type` berubah; status berulang tidak membuat baris baru.
