# 06 ML Worker LSTM Final — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini menjelaskan rancangan final **Python ML Worker** untuk project **EMS Thermal LSTM**.

ML Worker bertugas untuk:

1. Mengambil data sensor dari PostgreSQL.
2. Mengubah data raw 10 detik menjadi dataset time-series 1 menit.
3. Menggabungkan data sensor S1 dan S2 berdasarkan timestamp.
4. Melakukan preprocessing data.
5. Membentuk window supervised learning.
6. Melatih baseline persistence dan moving average.
7. Melatih model LSTM.
8. Mengevaluasi model menggunakan RMSE, MAE, dan MAPE.
9. Menyimpan model artifact.
10. Menyimpan model version dan metrics ke database.
11. Melakukan inference suhu S2 5 menit ke depan.
12. Mengirim hasil inference final ke backend untuk disimpan dan diklasifikasikan.

ML Worker **bukan** gateway sensor dan **tidak berjalan di Raspberry Pi**.

---

## 2. Prinsip ML Worker

ML Worker harus mengikuti prinsip berikut:

1. **Database-driven**  
   Data utama training dan inference berasal dari tabel `sensor_readings`.

2. **S2 as prediction target**  
   Target prediksi adalah suhu S2 pada 5 menit ke depan.

3. **S1 as contextual feature**  
   Data S1 digunakan sebagai fitur referensi/ambient.

4. **Raw data boleh 10 detik, ML data tetap 1 menit**  
   Gateway menyimpan raw readings setiap 10 detik, tetapi ML Worker melakukan resampling ke 1 menit.

5. **Chronological split only**  
   Data time-series tidak boleh di-split random.

6. **Baseline wajib**  
   LSTM harus dibandingkan dengan persistence dan moving average.

7. **Traceable model version**  
   Setiap model hasil training harus punya metadata dan tercatat di database.

8. **Safe inference**  
   Jika model, scaler, atau data tidak cukup, inference harus gagal dengan aman dan mencatat system log.

9. **No PUE, no energy optimization**  
   ML Worker hanya untuk prediksi suhu S2 dan status termal.

### 2.1 Documentation Lock Decisions

1. ML Worker membaca PostgreSQL langsung untuk dataset training dan input inference.
2. ML Worker tidak menulis hasil inference final langsung ke tabel `predictions`.
3. Hasil inference final dikirim ke protected endpoint `POST /api/v1/ml/predictions`.
4. Backend memiliki final status classification, anomaly event creation, SSE event, dan Telegram notification.
5. Simulator hanya helper development. Evidence skripsi memprioritaskan `source = 'hardware'` dan `quality_status = 'valid'`.
6. Canonical CLI:

```bash
python -m ml_worker.cli train
python -m ml_worker.cli infer
python -m ml_worker.cli evaluate
```

---

## 3. Stack ML Worker

| Komponen | Teknologi |
|---|---|
| Bahasa | Python |
| Deep Learning | TensorFlow / Keras |
| Data Processing | Pandas, NumPy |
| Scaling | Scikit-learn |
| Database | SQLAlchemy atau psycopg |
| Artifact | `.keras`, `.pkl`, `.json` |
| Config | `.env` atau YAML |
| CLI | argparse atau typer |

Rekomendasi: gunakan stack sederhana agar mudah dijalankan di laptop development.

---

## 4. Posisi ML Worker dalam Sistem

```text
PostgreSQL sensor_readings
    ↓
ML Worker Data Loader
    ↓
Preprocessing + Resampling
    ↓
Windowing
    ↓
Baseline + LSTM Training
    ↓
Evaluation Metrics
    ↓
Model Artifact + Database Metadata
    ↓
Inference
    ↓
Submit inference result to backend
    ↓
Dashboard + Telegram Alert
```

---

## 5. Struktur Folder ML Worker

```text
ml-worker/
├── src/
│   └── ml_worker/
│       ├── __init__.py
│       ├── config.py
│       ├── db.py
│       ├── dataset_loader.py
│       ├── preprocessing.py
│       ├── windowing.py
│       ├── baseline.py
│       ├── model.py
│       ├── train.py
│       ├── evaluate.py
│       ├── inference.py
│       ├── writer.py
│       ├── status.py
│       ├── metrics.py
│       └── cli.py
├── models/
│   └── .gitkeep
├── reports/
│   └── .gitkeep
├── requirements.txt
├── .env.example
└── README.md
```

---

## 6. Environment Variables

`.env.example`:

```env
DATABASE_URL=postgresql://ems_user:ems_password@localhost:5432/ems_thermal_lstm
BACKEND_BASE_URL=http://localhost:8080/api/v1
INTERNAL_ML_TOKEN=replace_with_internal_ml_token

ML_MODEL_NAME=ems_s2_lstm
ML_ARTIFACT_DIR=./models
ML_REPORT_DIR=./reports

RAW_SAMPLING_INTERVAL_SECONDS=10
ML_RESAMPLE_INTERVAL_SECONDS=60
WINDOW_SIZE=30
HORIZON_MINUTES=5

TRAIN_RATIO=0.70
VALIDATION_RATIO=0.15
TEST_RATIO=0.15

EPOCHS=50
BATCH_SIZE=32
LEARNING_RATE=0.001
EARLY_STOPPING_PATIENCE=8

THRESHOLD_NORMAL_MAX=30.0
THRESHOLD_ANOMALY_MIN=32.0
```

---

## 7. Dataset Source

Data ML berasal dari tabel:

```text
sensor_readings
sensors
gateways
```

Query dasar:

```sql
SELECT
    s.sensor_code,
    s.sensor_role,
    sr.temperature,
    sr.humidity,
    sr.quality_status,
    sr.source,
    sr.recorded_at
FROM sensor_readings sr
JOIN sensors s ON s.id = sr.sensor_id
WHERE sr.quality_status = 'valid'
  AND sr.source = 'hardware'
  AND sr.recorded_at BETWEEN :start_at AND :end_at
ORDER BY sr.recorded_at ASC;
```

Untuk development awal, `source = 'simulator'` boleh digunakan jika hardware belum menghasilkan data cukup, tetapi hasil akhir skripsi sebaiknya memprioritaskan data hardware.

---

## 8. Bentuk Data Raw

Data raw dari database berbentuk long format:

| recorded_at | sensor_code | temperature | humidity |
|---|---|---:|---:|
| 2026-01-17 14:00:00 | S1 | 27.1 | 63.2 |
| 2026-01-17 14:00:00 | S2 | 28.4 | 58.1 |
| 2026-01-17 14:00:10 | S1 | 27.2 | 63.0 |
| 2026-01-17 14:00:10 | S2 | 28.6 | 58.0 |

---

## 9. Bentuk Dataset ML

Setelah pivot dan resampling 1 menit, dataset harus menjadi wide format:

| timestamp | temperature_s1 | humidity_s1 | temperature_s2 | humidity_s2 |
|---|---:|---:|---:|---:|
| 2026-01-17 14:00:00 | 27.1 | 63.2 | 28.4 | 58.1 |
| 2026-01-17 14:01:00 | 27.2 | 63.0 | 28.6 | 58.0 |
| 2026-01-17 14:02:00 | 27.2 | 62.9 | 29.1 | 57.8 |

Feature columns final:

```text
temperature_s1
humidity_s1
temperature_s2
humidity_s2
```

Target column final:

```text
target_temperature_s2
```

---

## 10. Resampling Strategy

Gateway mengirim raw readings setiap 10 detik. ML Worker harus meresample data menjadi 1 menit.

Aturan:

1. Kelompokkan data per sensor.
2. Resample ke 1 menit.
3. Gunakan rata-rata untuk temperature dan humidity dalam satu menit.
4. Pivot S1 dan S2 menjadi satu baris per timestamp.
5. Jika data dalam satu menit tidak lengkap, gunakan missing value handling.

Rekomendasi Pandas:

```python
# Long format: timestamp, sensor_code, temperature, humidity
# Set timestamp sebagai index

# Resample per sensor
resampled = (
    df.set_index("timestamp")
      .groupby("sensor_code")
      .resample("1min")[["temperature", "humidity"]]
      .mean()
      .reset_index()
)

# Pivot ke wide format
pivot = resampled.pivot_table(
    index="timestamp",
    columns="sensor_code",
    values=["temperature", "humidity"]
)
```

---

## 11. Preprocessing Pipeline

Pipeline final:

```text
Load data from database
    ↓
Validate raw columns
    ↓
Sort by timestamp
    ↓
Filter valid hardware readings
    ↓
Resample to 1-minute interval
    ↓
Pivot S1 and S2
    ↓
Rename columns
    ↓
Handle missing values
    ↓
Filter invalid ranges
    ↓
Create future target S2
    ↓
Drop rows without target
    ↓
Scale features and target
    ↓
Build windows
    ↓
Chronological split
```

---

## 12. Missing Value Handling

Missing data dapat terjadi karena:

1. Sensor timeout.
2. Gateway gagal membaca salah satu sensor.
3. Backend offline.
4. Data raw tidak lengkap dalam interval tertentu.

Strategi:

| Kondisi | Aksi |
|---|---|
| Missing kecil | Interpolation time-based |
| Missing pendek | Forward fill terbatas |
| Missing panjang | Drop window terkait |
| Missing target | Drop row |
| Missing terlalu banyak | Stop training dan catat system log |

Rekomendasi:

```python
df = df.interpolate(method="time", limit=3)
df = df.ffill(limit=3)
df = df.dropna()
```

Catatan:

1. Jangan menginterpolasi missing yang terlalu panjang.
2. Jumlah missing sebelum dan sesudah preprocessing harus dicatat di report.
3. Jika data terlalu sedikit, training harus dihentikan dengan pesan jelas.

---

## 13. Invalid / Outlier Handling

Rentang valid:

| Parameter | Minimum | Maximum |
|---|---:|---:|
| Temperature | 0°C | 80°C |
| Humidity | 0% | 100% |

Aturan:

1. Nilai di luar rentang dianggap invalid.
2. Jangan gunakan data invalid untuk training.
3. Suhu > 32°C bukan invalid, karena itu dapat menjadi kondisi anomali.
4. Outlier ekstrem akibat error sensor harus dicatat.

---

## 14. Target Shifting

Target adalah suhu S2 5 menit ke depan.

Dengan resampling 1 menit:

```text
horizon_minutes = 5
horizon_steps = 5
```

Pseudocode:

```python
df["target_temperature_s2"] = df["temperature_s2"].shift(-5)
df = df.dropna(subset=["target_temperature_s2"])
```

Artinya input sampai waktu `t` digunakan untuk memprediksi suhu S2 pada `t+5 menit`.

---

## 15. Scaling Strategy

Gunakan dua scaler terpisah:

1. `feature_scaler.pkl` untuk input features.
2. `target_scaler.pkl` untuk target suhu S2.

Rekomendasi scaler:

```text
MinMaxScaler
```

Aturan penting:

1. Fit scaler hanya pada data training.
2. Validation dan test hanya transform menggunakan scaler training.
3. Saat evaluasi, prediksi harus dikembalikan ke satuan Celsius.
4. Saat inference, input di-transform dengan feature scaler aktif.
5. Output inference di-inverse transform dengan target scaler aktif.

---

## 16. Windowing

LSTM membutuhkan input 3 dimensi:

```text
(samples, timesteps, features)
```

Konfigurasi final:

| Parameter | Nilai |
|---|---:|
| Window size | 30 |
| Feature count | 4 |
| Target count | 1 |

Shape:

```text
X shape = (n_samples, 30, 4)
y shape = (n_samples, 1)
```

Pseudocode:

```python
def build_windows(features, target, window_size):
    X = []
    y = []

    for i in range(window_size, len(features)):
        X.append(features[i-window_size:i])
        y.append(target[i])

    return np.array(X), np.array(y)
```

---

## 17. Data Split

Split data harus kronologis.

| Bagian | Rasio |
|---|---:|
| Train | 70% |
| Validation | 15% |
| Test | 15% |

Tidak boleh random split karena dapat menyebabkan data leakage pada time-series.

Pseudocode:

```python
n = len(X)
train_end = int(n * 0.70)
val_end = int(n * 0.85)

X_train, y_train = X[:train_end], y[:train_end]
X_val, y_val = X[train_end:val_end], y[train_end:val_end]
X_test, y_test = X[val_end:], y[val_end:]
```

---

## 18. Minimum Data Requirement

Minimal completed input data untuk inference:

```text
window_size = 30 menit data hasil resample
```

Untuk membentuk satu sample training berlabel diperlukan `window_size + horizon_steps = 35 menit`.

Minimal data untuk training development:

```text
>= 300 data resample 1 menit
```

Lebih baik:

```text
>= 1000 data resample 1 menit
```

Jika raw interval 10 detik:

```text
300 data 1 menit ≈ 300 menit ≈ 5 jam data
1000 data 1 menit ≈ 1000 menit ≈ 16,7 jam data
```

Jika data belum cukup, ML Worker harus menolak training dengan pesan jelas dan mencatat system log.

---

## 19. Baseline Models

Baseline wajib dibuat agar LSTM tidak dinilai sendirian.

### 19.1 Persistence Baseline

Prediksi masa depan sama dengan nilai S2 terakhir pada window.

```text
prediction(t+5) = temperature_s2(t)
```

Pseudocode:

```python
y_pred_persistence = X_test[:, -1, feature_index_temperature_s2]
```

### 19.2 Moving Average Baseline

Prediksi menggunakan rata-rata beberapa nilai S2 terakhir.

Default:

```text
moving_average_window = 5
```

Pseudocode:

```python
y_pred_ma = X_test[:, -5:, feature_index_temperature_s2].mean(axis=1)
```

Baseline dihitung pada data test dan disimpan ke `baseline_results`.

---

## 20. LSTM Model Architecture

Arsitektur awal yang direkomendasikan:

```text
Input shape: (30, 4)
LSTM 64 units, return_sequences=True
Dropout 0.2
LSTM 32 units
Dropout 0.2
Dense 16, activation='relu'
Dense 1
```

Keras example:

```python
model = Sequential([
    Input(shape=(window_size, feature_count)),
    LSTM(64, return_sequences=True),
    Dropout(0.2),
    LSTM(32),
    Dropout(0.2),
    Dense(16, activation="relu"),
    Dense(1)
])

model.compile(
    optimizer=Adam(learning_rate=learning_rate),
    loss="mse"
)
```

Arsitektur boleh disesuaikan jika overfitting/underfitting, tetapi tetap harus sederhana dan dapat dijelaskan.

---

## 21. Training Configuration

Default:

| Parameter | Nilai |
|---|---:|
| Epochs | 50 |
| Batch size | 32 |
| Optimizer | Adam |
| Learning rate | 0.001 |
| Loss | MSE |
| Early stopping | enabled |
| Early stopping patience | 8 |
| Restore best weights | true |

Callbacks:

1. EarlyStopping.
2. ModelCheckpoint optional.
3. CSVLogger optional.

---

## 22. Evaluation Metrics

Metrik wajib:

### 22.1 RMSE

```text
RMSE = sqrt(mean((y_actual - y_pred)^2))
```

### 22.2 MAE

```text
MAE = mean(abs(y_actual - y_pred))
```

### 22.3 MAPE

```text
MAPE = mean(abs((y_actual - y_pred) / y_actual)) * 100
```

Catatan MAPE:

1. Karena suhu dalam Celsius tidak mendekati 0 pada kasus ini, MAPE masih dapat digunakan.
2. Tetap tambahkan epsilon kecil untuk menghindari division by zero.

Metrics harus dihitung dalam satuan asli Celsius setelah inverse scaling.

---

## 23. Model Artifact

Setiap training sukses menghasilkan folder model version:

```text
ml-worker/models/ems_s2_lstm_vYYYYMMDD_HHMMSS/
├── model.keras
├── feature_scaler.pkl
├── target_scaler.pkl
├── model_metadata.json
└── training_report.json
```

### 23.1 `model.keras`

Berisi model LSTM.

### 23.2 `feature_scaler.pkl`

Scaler untuk feature input.

### 23.3 `target_scaler.pkl`

Scaler untuk target suhu S2.

### 23.4 `model_metadata.json`

Contoh:

```json
{
  "model_name": "ems_s2_lstm",
  "version": "v20260117_143000",
  "algorithm": "Long Short-Term Memory",
  "feature_columns": [
    "temperature_s1",
    "humidity_s1",
    "temperature_s2",
    "humidity_s2"
  ],
  "target_column": "target_temperature_s2",
  "window_size": 30,
  "horizon_minutes": 5,
  "raw_sampling_interval_seconds": 10,
  "resample_interval_seconds": 60,
  "train_ratio": 0.70,
  "validation_ratio": 0.15,
  "test_ratio": 0.15,
  "metrics": {
    "rmse": 0.84,
    "mae": 0.62,
    "mape": 2.15
  },
  "baseline_results": [
    {
      "baseline_type": "persistence",
      "rmse": 1.12,
      "mae": 0.91,
      "mape": 3.24
    },
    {
      "baseline_type": "moving_average",
      "rmse": 1.04,
      "mae": 0.85,
      "mape": 3.01
    }
  ],
  "trained_at": "2026-01-17T14:30:00+07:00"
}
```

---

## 24. Database Writes After Training

Setelah training sukses, ML Worker harus menulis ke database:

1. `model_versions`
2. `prediction_runs`
3. `model_metrics`
4. `baseline_results`
5. `system_logs`

Aturan:

1. Model baru tidak otomatis harus aktif, kecuali flag CLI `--activate` digunakan.
2. Jika `--activate` digunakan, set model lain `is_active = false`.
3. Simpan artifact path relatif terhadap project.
4. Simpan metrics dalam satuan Celsius.

---

## 25. Training CLI

Command yang harus tersedia:

```bash
python -m ml_worker.cli train --start-at 2026-01-17T00:00:00+07:00 --end-at 2026-01-17T23:59:59+07:00
```

Dengan activate:

```bash
python -m ml_worker.cli train --start-at 2026-01-17T00:00:00+07:00 --end-at 2026-01-17T23:59:59+07:00 --activate
```

Dengan default range:

```bash
python -m ml_worker.cli train --last-hours 24 --activate
```

Output minimal:

```text
Loading data...
Rows raw: 8640
Rows resampled: 1440
Windows: 1405
Training LSTM...
Evaluation:
RMSE: 0.84
MAE : 0.62
MAPE: 2.15
Artifact saved: ./models/ems_s2_lstm_v20260117_143000
Model version saved to database.
```

---

## 26. Inference Strategy

Inference menggunakan model aktif.

Flow:

1. Ambil model aktif dari `model_versions`.
2. Load `model.keras`.
3. Load `feature_scaler.pkl`.
4. Load `target_scaler.pkl`.
5. Ambil data sensor terbaru dari database.
6. Resample ke 1 menit.
7. Ambil 30 data terakhir.
8. Transform feature.
9. Predict.
10. Inverse transform.
11. Tentukan `predicted_for = latest_timestamp + 5 minutes`.
12. Kirim hasil inference ke protected `POST /api/v1/ml/predictions`.
13. Backend mengklasifikasikan status final.
14. Backend menyimpan `predictions`, membuat `anomaly_events` jika perlu, mengirim SSE, dan menjalankan keputusan Telegram.
15. Catat `prediction_runs`.

---

## 27. Inference CLI

Command:

```bash
python -m ml_worker.cli infer
```

Dengan loop:

```bash
python -m ml_worker.cli infer --loop --interval-seconds 60
```

Dengan model tertentu:

```bash
python -m ml_worker.cli infer --model-version-id 1
```

Jika tidak ada model aktif:

```text
ERROR: No active model version found.
```

Jika data kurang:

```text
ERROR: Not enough resampled data for inference. Required=30, available=18.
```

Semua error harus dicatat di `system_logs`.

---

## 28. Status Classification

`thermal_status` ditentukan berdasarkan prediksi suhu S2. Backend menjadi source of truth untuk status final.

Default:

| Status | Kondisi |
|---|---|
| normal | predicted_temperature_s2 < 30.0 |
| waspada | 30.0 <= predicted_temperature_s2 <= 32.0 |
| anomali | predicted_temperature_s2 > 32.0 |
| trouble | sensor/gateway/model bermasalah |

Function:

```python
def classify_status(predicted_temperature, normal_max=30.0, anomaly_min=32.0):
    if predicted_temperature < normal_max:
        return "normal"
    if predicted_temperature <= anomaly_min:
        return "waspada"
    return "anomali"
```

Threshold harus diambil dari tabel `settings` jika tersedia.

---

## 29. Prediction Writes

Insert ke tabel `predictions`:

```text
prediction_run_id
model_version_id
target_sensor_id
predicted_temperature
actual_temperature nullable
input_window_start_at
input_window_end_at
predicted_for
thermal_status
final_status
threshold_normal_max
threshold_anomaly_min
is_stale ditentukan backend
created_at
```

ML Worker mengirim payload inference ke backend. Backend membuat `anomaly_events` jika `final_status` adalah `waspada`, `anomali`, atau `trouble` dan prediction tidak stale.

Jika `thermal_status` normal, backend tetap menyimpan prediction. Recovery normal dapat dibuat sebagai event opsional.

---

## 30. Updating Actual Temperature

Setelah waktu `predicted_for` sudah lewat dan data aktual tersedia, sistem boleh mengisi `actual_temperature`.

Actual matching dijalankan backend sebagai proses periodik sederhana. Ini bukan tanggung jawab CLI inference ML Worker.

Aturan:

1. Cari predictions dengan `actual_temperature IS NULL`.
2. Cari reading S2 terdekat dengan `predicted_for` dalam tolerance `+/-60 detik`.
3. Isi actual temperature jika reading ditemukan; jika tidak, pertahankan `NULL`.
4. Ini membantu grafik actual vs predicted.

Fitur ini direkomendasikan, tetapi tidak boleh menghambat training/inference utama.

---

## 31. Training Report

ML Worker harus menghasilkan report JSON:

```text
ml-worker/reports/training_report_vYYYYMMDD_HHMMSS.json
```

Isi minimal:

1. Dataset start/end.
2. Raw row count.
3. Resampled row count.
4. Missing count sebelum/sesudah.
5. Invalid count.
6. Train/validation/test size.
7. Model parameter.
8. Metrics LSTM.
9. Metrics baseline.
10. Artifact paths.
11. Training duration.

Report ini berguna untuk Bab 4.

---

## 32. Logging ML Worker

ML Worker wajib mencatat log ke console dan database `system_logs` untuk event penting.

Log minimal:

1. Training started.
2. Data loaded.
3. Data insufficient.
4. Preprocessing completed.
5. Baseline evaluated.
6. LSTM training completed.
7. Metrics saved.
8. Artifact saved.
9. Inference started.
10. Prediction saved.
11. Error occurred.

---

## 33. Error Handling

| Error | Aksi |
|---|---|
| Database tidak terhubung | Stop dan tampilkan error jelas |
| Data kosong | Stop training/inference dan tulis system log |
| Data kurang | Stop dan tampilkan jumlah data yang dibutuhkan |
| Model aktif tidak ada | Inference gagal aman |
| File model hilang | System log error |
| Scaler hilang | System log error |
| Training gagal | prediction_run status failed |
| Inference gagal | prediction_run status failed |

---

## 34. ML Worker Acceptance Criteria

| Kode | Kriteria |
|---|---|
| ML-FINAL-001 | ML Worker dapat membaca konfigurasi |
| ML-FINAL-002 | ML Worker dapat konek ke PostgreSQL |
| ML-FINAL-003 | Data sensor dapat di-load dari database |
| ML-FINAL-004 | Data raw 10 detik dapat diresample ke 1 menit |
| ML-FINAL-005 | Dataset S1/S2 berhasil dipivot menjadi wide format |
| ML-FINAL-006 | Missing value handling berjalan |
| ML-FINAL-007 | Target S2 t+5 berhasil dibuat |
| ML-FINAL-008 | Window shape sesuai `(samples, 30, 4)` |
| ML-FINAL-009 | Split kronologis berjalan |
| ML-FINAL-010 | Baseline persistence dihitung |
| ML-FINAL-011 | Baseline moving average dihitung |
| ML-FINAL-012 | LSTM berhasil training |
| ML-FINAL-013 | RMSE, MAE, MAPE dihitung dalam Celsius |
| ML-FINAL-014 | Artifact model tersimpan |
| ML-FINAL-015 | Model version tersimpan ke database |
| ML-FINAL-016 | Model dapat diaktifkan |
| ML-FINAL-017 | Inference menghasilkan prediksi S2 |
| ML-FINAL-018 | Prediction disubmit ke backend dan tersimpan ke database |
| ML-FINAL-019 | Backend membuat anomaly event untuk final status waspada/anomali yang tidak stale |
| ML-FINAL-020 | Error data/model ditangani tanpa crash liar |

---

## 35. Instruksi untuk Codex

Saat membuat ML Worker, Codex harus:

1. Mengikuti pipeline dalam dokumen ini.
2. Tidak melakukan random split.
3. Tidak membuat PUE prediction.
4. Tidak membuat model utama selain LSTM.
5. Tetap membuat baseline persistence dan moving average.
6. Menyimpan artifact lengkap.
7. Menyimpan metrics ke database.
8. Menulis README ML Worker.
9. Menyediakan command training dan inference yang jelas.
10. Menangani error data kurang dengan baik.
11. Tidak menjalankan training di Raspberry Pi.
12. Menjaga kode modular dan mudah diuji.
## Alert Category Documentation Lock Addendum

ML Worker tetap hanya mengirim hasil inference ke backend. Backend mengklasifikasikan prediksi S2 non-stale sebagai Pre-Alarm (`event_type = prediction_threshold`) dan memiliki seluruh keputusan event, SSE, serta Telegram. ML Worker tidak membuat Alarm aktual atau Trouble.

---

## 36. Audit Model Aktif dan Kesiapan Early Warning

### 36.1 Snapshot diagnosis 7 Juli 2026

Audit dilakukan terhadap model aktif `v20260624_115955` ketika S2 dipindahkan mendekati sumber panas.

| Item | Hasil observasi |
|---|---|
| S2 aktual terbaru | `31.0°C` (`waspada`) |
| Akhir input window | 7 Juli 2026 12:38 WIB |
| Target prediksi | 7 Juli 2026 12:43 WIB (`t+5`) |
| Prediksi LSTM | `29.42°C` (`normal`) |
| Selisih terhadap aktual di sekitar target | sekitar `-1.58°C` |
| Status infer-loop | aktif, interval sekitar 60 detik |

Input inference telah mengikuti data terbaru. Karena itu, kasus ini bukan bukti data macet atau worker berhenti. Model menghasilkan prediksi yang terlalu rendah saat terjadi kenaikan suhu cepat.

Replay operasional pukul 11:20–13:30 WIB menghasilkan 121 prediction-actual matches, 4 episode threshold, 2 episode terdeteksi lebih awal, dan 2 episode terlewat. Threshold episode recall adalah `50%`, MAE operasional `1.086°C`, dan MAE pada titik threshold `1.292°C`. Nilai ini adalah snapshot satu periode eksperimen, bukan estimasi performa final; jumlah episode harus ditambah sebelum menarik kesimpulan statistik skripsi.

Metrik test model saat training:

| Metode | RMSE (°C) | MAE (°C) | MAPE (%) |
|---|---:|---:|---:|
| LSTM aktif | 0.1053 | 0.0854 | 0.3065 |
| Persistence | 0.0479 | 0.0365 | 0.1310 |
| Moving average | 0.0496 | 0.0357 | 0.1282 |

Pada test set tersebut, LSTM kalah dari kedua baseline. Model dapat memiliki metrik global yang terlihat kecil karena dataset didominasi periode stabil, tetapi tetap gagal pada transisi yang penting bagi early warning.

Dataset training model aktif mencakup 3 Juni–24 Juni 2026, memiliki 37.396 raw rows dan 3.267 usable resampled rows. Metadata juga mencatat missing value dalam jumlah besar. Angka ini harus diaudit lebih lanjut; angka missing saja belum cukup untuk menyimpulkan akar masalah tanpa melihat distribusi gap dan episode kenaikan suhu.

### 36.2 Arti horizon yang digunakan

Satu inference menghasilkan satu nilai untuk `t+5 menit`. Sistem menjalankan inference setiap menit, sehingga terbentuk deret target bergerak:

```text
12:38 membuat prediksi untuk 12:43
12:39 membuat prediksi untuk 12:44
12:40 membuat prediksi untuk 12:45
```

Implementasi saat ini bukan model multi-output yang sekaligus menghasilkan `t+1`, `t+2`, `t+3`, `t+4`, dan `t+5`.

### 36.3 Kriteria aktivasi model

Model tidak boleh dianggap layak hanya karena training selesai dan RMSE/MAE terlihat kecil. Sebelum diaktifkan untuk Pre-Alarm, model harus memenuhi seluruh kriteria berikut:

1. Dievaluasi dengan chronological test set yang tidak dipakai training.
2. Dibandingkan dengan persistence dan moving average pada test set yang sama.
3. Tidak lebih buruk secara material dari baseline utama pada MAE/RMSE global.
4. Lulus pengujian khusus episode transisi normal → waspada dan waspada → anomali.
5. Memiliki tingkat deteksi threshold, missed warning, false warning, dan lead time yang dilaporkan.
6. Lulus replay data historis sebelum aktivasi produksi.

LSTM tetap model utama sesuai scope skripsi. Baseline berfungsi sebagai pembanding, quality gate, dan kandidat fallback aman; baseline tidak mengganti fokus penelitian LSTM.

### 36.4 Evaluasi transition-aware

Selain RMSE, MAE, dan MAPE global, laporan evaluasi harus mencatat:

| Metrik | Makna |
|---|---|
| Threshold recall | Persentase episode aktual waspada/anomali yang diperingatkan sebelumnya |
| Missed-warning count | Episode threshold aktual tanpa Pre-Alarm yang benar |
| False-warning count | Pre-Alarm tetapi target aktual tetap normal |
| Median lead time | Jarak waktu peringatan terhadap threshold aktual |
| Transition MAE | MAE pada window sekitar kenaikan/pendinginan, bukan seluruh periode stabil |

Episode tidak dihitung dari setiap reading. Satu episode dimulai saat status berubah dari normal ke waspada/anomali dan berakhir setelah recovery ke normal.

### 36.5 Rencana perbaikan bertahap

Urutan wajib agar perubahan dapat dipertanggungjawabkan:

1. Buat laporan audit/replay model aktif tanpa mengubah model produksi.
2. Tambahkan evaluasi transition-aware dan model-promotion gate.
3. Kumpulkan episode pemanasan dan pendinginan fisik yang terkontrol.
4. Audit gap data, distribusi suhu, dan cakupan episode threshold.
5. Retrain LSTM menggunakan dataset yang telah diperbaiki.
6. Bandingkan model baru dengan model aktif serta kedua baseline.
7. Aktifkan hanya model yang lolos quality gate.
8. Setelah evaluasi memadai, pertimbangkan fallback konservatif berbasis baseline/tren ketika output LSTM tidak kredibel.

Fitur turunan tren, misalnya perubahan suhu 1, 3, dan 5 menit, adalah kandidat eksperimen. Penambahannya harus dicatat sebagai perubahan feature schema, menghasilkan artifact/scaler baru, dan diuji melalui ablation; tidak boleh disisipkan ke artifact lama.

### 36.6 Guardrail operasional

Alarm aktual tetap ditentukan oleh pembacaan sensor dan tidak boleh diturunkan menjadi normal hanya karena prediksi LSTM normal. Pre-Alarm adalah informasi masa depan, bukan pengganti Alarm aktual. Trouble tetap khusus kesehatan sensor/gateway/system.
