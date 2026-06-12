# 09 Test Plan Final — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini menjelaskan rencana pengujian final untuk project **EMS Thermal LSTM**. Test plan ini disusun agar hasil implementasi dapat dibuktikan secara teknis dan dapat digunakan sebagai dasar penulisan **Bab 4 Implementasi dan Pengujian**.

Pengujian difokuskan pada sistem hardware-first:

```text
Sensor XY-MD02 → Raspberry Pi Gateway → Go Backend → PostgreSQL → React Dashboard → ML Worker LSTM → Status Termal → Telegram Alert
```

Dokumen ini menjadi pegangan Codex untuk memastikan setiap milestone tidak hanya menghasilkan kode, tetapi juga dapat diuji dan dibuktikan.

---

## 2. Prinsip Pengujian

Pengujian sistem mengikuti prinsip berikut:

1. **Hardware-first validation**  
   Jalur utama pengujian menggunakan Raspberry Pi dan sensor XY-MD02 asli.

2. **No fake production data**  
   Dashboard produksi tidak boleh mengandalkan data dummy hardcoded.

3. **Milestone-based testing**  
   Setiap milestone harus diuji sebelum lanjut ke milestone berikutnya.

4. **Evidence-ready**  
   Setiap hasil test penting harus menghasilkan bukti untuk Bab 4, seperti screenshot, log, response API, isi tabel database, atau output terminal.

5. **Graceful failure**  
   Sistem harus tetap aman ketika sensor gagal, backend offline, Telegram gagal, model belum siap, atau data belum cukup.

6. **ML reproducibility**  
   Training LSTM harus bisa diulang dari data database dan menghasilkan artifact serta metrics.

7. **Scope locked**  
   Pengujian tidak mencakup PUE, kontrol kipas, AC, relay, optimasi energi, atau sistem enterprise.

---

## 3. Scope Pengujian

### 3.1 In Scope

| Area | Pengujian |
|---|---|
| Database | Migration, seed, relasi, query latest/history |
| Backend API | Health, auth, readings, dashboard, sensors, predictions, layout, settings, logs |
| SSE Realtime | Event reading, prediction, anomaly, gateway status |
| Gateway Raspberry Pi | Config, serial port, Modbus raw read, sensor read, send payload, retry, buffer |
| Sensor Hardware | XY-MD02 S1/S2 terbaca, slave ID, register, nilai suhu/kelembaban masuk akal |
| Frontend Dashboard | Sidebar, pages, cards, charts, tables, layout marker, loading/empty/error state |
| ML Worker | Data loader, resampling, preprocessing, windowing, baseline, LSTM, metrics, inference |
| Alert Rules | Normal, waspada, anomali, trouble, cooldown |
| Telegram | Test notification, alert notification, disabled/skipped, failure handling |
| Integration | Gateway → Backend → DB → Dashboard → ML → Alert |
| Bab 4 Evidence | Screenshot dashboard, API response, DB rows, ML metrics, log gateway/backend |

### 3.2 Out of Scope

| Area | Alasan |
|---|---|
| PUE calculation | Tidak termasuk scope final skripsi |
| Energy optimization | Tidak termasuk scope final |
| Fan/AC/relay control | Sistem hanya monitoring dan alert |
| Mobile app | Dashboard web cukup |
| Multi-user complex auth | Tidak menjadi fokus penelitian |
| Load test enterprise | Tidak relevan dengan server testbed |
| Kubernetes/microservice test | Tidak digunakan dalam arsitektur final |
| Training di Raspberry Pi | ML Worker berjalan di laptop/server |

---

## 4. Test Environment

### 4.1 Development Environment

| Komponen | Spesifikasi Awal |
|---|---|
| Laptop development | Menjalankan backend, database, dashboard, ML Worker |
| OS laptop | Windows/Linux/macOS, mengikuti kondisi developer |
| Database | PostgreSQL lokal atau Docker Compose |
| Backend | Go/Golang |
| Frontend | React + Vite + TypeScript |
| ML Worker | Python + TensorFlow/Keras |
| API testing | curl, Postman, Thunder Client |
| Browser | Chrome/Edge/Firefox |

### 4.2 Hardware Environment

| Komponen | Keterangan |
|---|---|
| Raspberry Pi 3 | Gateway sensor |
| Raspberry Pi OS | Ubuntu/Debian CLI |
| SSH | Sudah tersedia |
| USB RS485 Adapter | Penghubung sensor ke Raspberry Pi |
| Sensor S1 | XY-MD02 ambient/reference |
| Sensor S2 | XY-MD02 hotspot/exhaust |
| Network | LAN lokal atau ZeroTier |

### 4.3 Environment Variable Minimum

Backend:

```env
APP_PORT=8080
DATABASE_URL=postgres://ems_user:ems_password@localhost:5432/ems_thermal_lstm?sslmode=disable
GATEWAY_TOKEN=change-me
ADMIN_TOKEN=change-admin-token
INTERNAL_ML_TOKEN=change-internal-ml-token
FRONTEND_ORIGIN=http://localhost:5173
TELEGRAM_ENABLED=false
```

Gateway:

```env
GATEWAY_CONFIG=./config.yaml
BACKEND_BASE_URL=http://<laptop-ip>:8080/api/v1
BACKEND_TOKEN=change-me
MODBUS_PORT=/dev/ttyUSB0
```

ML Worker:

```env
DATABASE_URL=postgres://ems_user:ems_password@localhost:5432/ems_thermal_lstm?sslmode=disable
MODEL_DIR=./models
WINDOW_SIZE=30
HORIZON_MINUTES=5
RESAMPLE_INTERVAL_SECONDS=60
```

Frontend:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

---

## 5. Entry Criteria

Pengujian dapat dimulai jika:

```text
[ ] Repo baru sudah dibuat
[ ] Struktur folder final tersedia
[ ] PostgreSQL dapat dijalankan
[ ] Backend dapat dijalankan minimal health check
[ ] Migration tersedia
[ ] Seed gateway dan sensor tersedia
[ ] Frontend dapat dijalankan
[ ] Gateway code tersedia di Raspberry Pi atau dapat disalin ke Raspberry Pi
[ ] ML Worker dependencies dapat diinstall
[ ] .env.example tersedia untuk setiap komponen
```

---

## 6. Exit Criteria

Pengujian final dianggap selesai jika:

```text
[ ] Database migration berhasil
[ ] Backend menerima data sensor dari gateway
[ ] Data sensor tersimpan di database
[ ] Dashboard menampilkan data sensor asli dari API
[ ] SSE realtime update berjalan
[ ] Gateway diagnostic berhasil membaca sensor atau menghasilkan error hardware yang jelas
[ ] ML Worker dapat training dari data database
[ ] Model artifact tersimpan
[ ] RMSE, MAE, MAPE tersimpan
[ ] Inference menghasilkan prediksi suhu S2
[ ] Status normal/waspada/anomali/trouble dapat diuji
[ ] Telegram test/alert berhasil atau failure tercatat aman
[ ] Layout sensor dapat menampilkan marker S1/S2
[ ] Events & Logs menampilkan anomaly/notification/system logs
[ ] Hasil pengujian cukup untuk ditulis ke Bab 4
```

---

## 7. Test Evidence untuk Bab 4

Setiap pengujian penting sebaiknya menghasilkan bukti berikut:

| Bukti | Contoh |
|---|---|
| Screenshot | Dashboard, layout sensor, prediction page, events page |
| Terminal output | Gateway diagnostic, backend run, ML training |
| API response | curl/Postman response untuk endpoint utama |
| Database query | Isi tabel sensor_readings, predictions, model_metrics |
| Log file | gateway.log, backend log, ML Worker log |
| Artifact file | model.keras, feature_scaler.pkl, target_scaler.pkl, metadata.json |
| Tabel hasil test | ID test, skenario, expected result, actual result, status |

---

# 8. Test Case Database

## 8.1 DB-001 — PostgreSQL Startup

| Field | Detail |
|---|---|
| Tujuan | Memastikan PostgreSQL berjalan |
| Langkah | Jalankan `docker compose up -d postgres` |
| Expected | Container PostgreSQL running dan port 5432 terbuka |
| Evidence | Screenshot terminal `docker ps` |
| Status | Pending |

## 8.2 DB-002 — Migration

| Field | Detail |
|---|---|
| Tujuan | Memastikan semua tabel dibuat |
| Langkah | Jalankan migration backend |
| Expected | Semua tabel final terbentuk tanpa error |
| Evidence | Output migration dan query list table |
| Status | Pending |

Checklist tabel:

```text
[ ] gateways
[ ] api_tokens
[ ] sensors
[ ] sensor_readings
[ ] gateway_status_logs
[ ] model_versions
[ ] prediction_runs
[ ] model_metrics
[ ] baseline_results
[ ] predictions
[ ] anomaly_events
[ ] notification_logs
[ ] layouts
[ ] layout_devices
[ ] settings
[ ] system_logs
```

## 8.3 DB-003 — Seed Data

| Field | Detail |
|---|---|
| Tujuan | Memastikan data awal gateway, sensor, settings tersedia |
| Langkah | Jalankan seed script |
| Expected | Gateway raspi-gateway-01, sensor S1/S2, settings default tersedia |
| Evidence | Query database |
| Status | Pending |

Expected seed:

```text
S1 = ambient, slave_id 1
S2 = hotspot, slave_id 2
threshold_normal_max = 30.0
threshold_anomaly_min = 32.0
```

## 8.4 DB-004 — Insert Sensor Reading

| Field | Detail |
|---|---|
| Tujuan | Memastikan data sensor dapat disimpan |
| Langkah | Insert via backend POST /readings |
| Expected | Dua baris tersimpan di sensor_readings |
| Evidence | Query SELECT dari sensor_readings |
| Status | Pending |

## 8.5 DB-005 — Latest Reading Query

| Field | Detail |
|---|---|
| Tujuan | Memastikan query latest S1/S2 berjalan |
| Langkah | Panggil GET /readings/latest |
| Expected | Data terbaru S1 dan S2 tampil |
| Evidence | API response |
| Status | Pending |

## 8.6 DB-006 — Model Activation Constraint

| Field | Detail |
|---|---|
| Tujuan | Memastikan hanya satu model aktif |
| Langkah | Insert dua model, activate model kedua |
| Expected | Model kedua aktif, model pertama inactive |
| Evidence | Query model_versions |
| Status | Pending |

## 8.7 DB-007 - Reading Dedupe Constraint

| Field | Detail |
|---|---|
| Tujuan | Memastikan replay tidak membuat reading duplikat |
| Langkah | Kirim dua payload dengan gateway, sensor, dan `recorded_at` sama |
| Expected | Hanya satu reading tersimpan atau duplicate ditangani idempotent |
| Evidence | API response dan query `sensor_readings` |
| Status | Pending |

---

# 9. Test Case Backend API

## 9.1 API-001 — Health Check

| Field | Detail |
|---|---|
| Endpoint | `GET /api/v1/health` |
| Langkah | Jalankan curl ke health endpoint |
| Expected | HTTP 200, database connected |
| Evidence | curl response |
| Status | Pending |

Command:

```bash
curl http://localhost:8080/api/v1/health
```

## 9.2 API-002 — POST Readings Tanpa Token

| Field | Detail |
|---|---|
| Endpoint | `POST /api/v1/readings` |
| Langkah | Kirim payload tanpa Authorization |
| Expected | HTTP 401 |
| Evidence | curl response |
| Status | Pending |

## 9.3 API-003 — POST Readings Token Salah

| Field | Detail |
|---|---|
| Endpoint | `POST /api/v1/readings` |
| Langkah | Kirim payload dengan token salah |
| Expected | HTTP 401 |
| Evidence | curl response |
| Status | Pending |

## 9.4 API-004 — POST Readings Valid

| Field | Detail |
|---|---|
| Endpoint | `POST /api/v1/readings` |
| Langkah | Kirim payload S1/S2 valid |
| Expected | HTTP 201, stored_count = 2 |
| Evidence | curl response dan query database |
| Status | Pending |

Payload:

```json
{
  "gateway_id": "raspi-gateway-01",
  "recorded_at": "2026-01-17T14:30:00+07:00",
  "source": "hardware",
  "readings": [
    {
      "sensor_code": "S1",
      "sensor_role": "ambient",
      "temperature": 27.4,
      "humidity": 63.2
    },
    {
      "sensor_code": "S2",
      "sensor_role": "hotspot",
      "temperature": 30.8,
      "humidity": 58.5
    }
  ]
}
```

## 9.5 API-005 — POST Readings Temperature Invalid

| Field | Detail |
|---|---|
| Endpoint | `POST /api/v1/readings` |
| Input | temperature = 90 |
| Expected | HTTP 422 |
| Evidence | API response validation error |
| Status | Pending |

## 9.6 API-006 — POST Readings Humidity Invalid

| Field | Detail |
|---|---|
| Endpoint | `POST /api/v1/readings` |
| Input | humidity = 120 |
| Expected | HTTP 422 |
| Evidence | API response validation error |
| Status | Pending |

## 9.7 API-007 — Sensor Role Salah

| Field | Detail |
|---|---|
| Input | S1 dengan role hotspot |
| Expected | HTTP 422 |
| Evidence | API response |
| Status | Pending |

## 9.8 API-008 — Gateway Status Normal

| Field | Detail |
|---|---|
| Endpoint | `POST /api/v1/gateway/status` |
| Langkah | Kirim status active dan sensor normal |
| Expected | HTTP 200, gateway last_seen/status update |
| Evidence | API response dan query database |
| Status | Pending |

## 9.9 API-009 — Gateway Status Trouble

| Field | Detail |
|---|---|
| Endpoint | `POST /api/v1/gateway/status` |
| Langkah | Kirim status S2 trouble |
| Expected | Sensor S2 status trouble, system log tersimpan |
| Evidence | API response, query sensors, system_logs |
| Status | Pending |

## 9.10 API-010 — Dashboard Summary Data Ada

| Field | Detail |
|---|---|
| Endpoint | `GET /api/v1/dashboard/summary` |
| Kondisi | Data sensor sudah masuk |
| Expected | Summary latest readings, gateway, prediction/model state |
| Evidence | API response |
| Status | Pending |

## 9.11 API-011 — Dashboard Summary Data Kosong

| Field | Detail |
|---|---|
| Kondisi | Database belum punya readings |
| Expected | Response success, data kosong/null aman |
| Evidence | API response |
| Status | Pending |

## 9.12 API-012 — Readings History Filter

| Field | Detail |
|---|---|
| Endpoint | `GET /api/v1/readings/history?sensor_code=S2&limit=100` |
| Expected | Hanya data S2, maksimal 100 baris |
| Evidence | API response |
| Status | Pending |

## 9.13 API-013 — Model Activate

| Field | Detail |
|---|---|
| Endpoint | `PUT /api/v1/model-versions/{id}/activate` |
| Expected | Model target aktif, model lain inactive |
| Evidence | API response dan query database |
| Status | Pending |

## 9.14 API-014 — Settings Update Threshold

| Field | Detail |
|---|---|
| Endpoint | `PUT /api/v1/settings/threshold_normal_max` |
| Input | value = 30.5 |
| Expected | Setting berubah dan system log tercatat |
| Evidence | API response dan query settings |
| Status | Pending |

## 9.15 API-015 — Test Telegram Disabled

| Field | Detail |
|---|---|
| Endpoint | `POST /api/v1/notifications/test` |
| Kondisi | telegram_enabled = false |
| Expected | status skipped, backend tidak error |
| Evidence | API response dan notification_logs |
| Status | Pending |

## 9.16 API-016 - Internal ML Prediction Protected

| Field | Detail |
|---|---|
| Endpoint | `POST /api/v1/ml/predictions` |
| Langkah | Kirim payload tanpa internal token, lalu dengan token valid |
| Expected | Tanpa token ditolak; token valid menyimpan prediction dan menyusun final status |
| Evidence | API response dan query `predictions` |
| Status | Pending |

## 9.17 API-017 - Sensitive Write Protected

| Field | Detail |
|---|---|
| Endpoint | `PUT /api/v1/settings/{key}` |
| Langkah | Kirim update tanpa admin token |
| Expected | HTTP 401 atau 403 |
| Evidence | API response |
| Status | Pending |

## 9.18 API-018 - Stale Prediction

| Field | Detail |
|---|---|
| Kondisi | Prediction berusia lebih dari 10 menit |
| Expected | Tetap ada di history, tidak menjadi active dashboard status, tidak memicu Telegram |
| Evidence | API summary, prediction history, notification logs |
| Status | Pending |

## 9.19 API-019 - Offline Checker

| Field | Detail |
|---|---|
| Kondisi | Gateway tidak mengirim heartbeat atau reading lebih dari 5 menit |
| Expected | Checker 30 detik mengubah gateway menjadi trouble/offline dan mencatat event |
| Evidence | Query gateways, system logs, SSE |
| Status | Pending |

## 9.20 API-020 - Actual Temperature Matching

| Field | Detail |
|---|---|
| Kondisi | Reading S2 tersedia dekat `predicted_for` |
| Expected | Nearest reading dalam tolerance `+/-60 detik` mengisi `actual_temperature`; di luar tolerance tetap `NULL` |
| Evidence | Query predictions dan sensor_readings |
| Status | Pending |

---

# 10. Test Case SSE Realtime

## 10.1 SSE-001 — Connect Event Stream

| Field | Detail |
|---|---|
| Endpoint | `GET /api/v1/events` |
| Langkah | Buka EventSource dari frontend atau curl |
| Expected | Koneksi tetap terbuka |
| Evidence | Browser devtools atau terminal |
| Status | Pending |

## 10.2 SSE-002 — reading.latest Event

| Field | Detail |
|---|---|
| Langkah | Buka SSE, lalu POST readings valid |
| Expected | Event `reading.latest` diterima |
| Evidence | Browser console atau log frontend |
| Status | Pending |

## 10.3 SSE-003 — gateway.status Event

| Field | Detail |
|---|---|
| Langkah | POST gateway/status |
| Expected | Event `gateway.status` diterima |
| Evidence | Browser console |
| Status | Pending |

## 10.4 SSE-004 — sensor.trouble Event

| Field | Detail |
|---|---|
| Langkah | POST gateway/status dengan S2 trouble |
| Expected | Event `sensor.trouble` diterima |
| Evidence | Browser console |
| Status | Pending |

## 10.5 SSE-005 — Disconnect Handling

| Field | Detail |
|---|---|
| Langkah | Stop backend saat dashboard terbuka |
| Expected | Frontend tampilkan SSE disconnected, tidak crash |
| Evidence | Screenshot dashboard |
| Status | Pending |

---

# 11. Test Case Gateway Raspberry Pi

## 11.1 GW-001 — SSH Access

| Field | Detail |
|---|---|
| Tujuan | Memastikan Raspberry Pi dapat diakses |
| Langkah | SSH ke Raspberry Pi |
| Expected | Login berhasil |
| Evidence | Screenshot terminal |
| Status | Pending |

## 11.2 GW-002 — Python Environment

| Field | Detail |
|---|---|
| Langkah | Jalankan `python3 --version` dan install requirements |
| Expected | Python tersedia dan dependency gateway terinstall |
| Evidence | Terminal output |
| Status | Pending |

## 11.3 GW-003 — USB RS485 Detected

| Field | Detail |
|---|---|
| Langkah | Jalankan `ls /dev/ttyUSB*` |
| Expected | `/dev/ttyUSB0` atau port serupa muncul |
| Evidence | Terminal output |
| Status | Pending |

## 11.4 GW-004 — Diagnostic Ports

| Field | Detail |
|---|---|
| Command | `python -m gateway.cli diagnose ports` |
| Expected | Serial port list tampil |
| Evidence | Terminal output |
| Status | Pending |

## 11.5 GW-005 — Raw Register S1

| Field | Detail |
|---|---|
| Command | `python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2` |
| Expected | Raw register terbaca atau error jelas |
| Evidence | Terminal output |
| Status | Pending |

## 11.6 GW-006 — Raw Register S2

| Field | Detail |
|---|---|
| Command | `python -m gateway.cli diagnose raw --slave-id 2 --address 1 --count 2` |
| Expected | Raw register terbaca atau error jelas |
| Evidence | Terminal output |
| Status | Pending |

## 11.7 GW-007 — Sensor Read S1

| Field | Detail |
|---|---|
| Command | `python -m gateway.cli diagnose sensor --sensor-code S1` |
| Expected | Temperature dan humidity S1 tampil masuk akal |
| Evidence | Terminal output |
| Status | Pending |

## 11.8 GW-008 — Sensor Read S2

| Field | Detail |
|---|---|
| Command | `python -m gateway.cli diagnose sensor --sensor-code S2` |
| Expected | Temperature dan humidity S2 tampil masuk akal |
| Evidence | Terminal output |
| Status | Pending |

## 11.9 GW-009 — Send Test to Backend

| Field | Detail |
|---|---|
| Command | `python -m gateway.cli send-test` |
| Expected | Backend response success, data tersimpan |
| Evidence | Terminal output dan DB query |
| Status | Pending |

## 11.10 GW-010 — Run Gateway Loop

| Field | Detail |
|---|---|
| Command | `python -m gateway.cli run --config ./config.yaml` |
| Expected | Gateway membaca dan mengirim data tiap 10 detik |
| Evidence | gateway.log, DB rows bertambah |
| Status | Pending |

## 11.11 GW-011 — Backend Offline Buffer

| Field | Detail |
|---|---|
| Langkah | Matikan backend, jalankan gateway |
| Expected | Payload gagal disimpan ke `failed_payloads.jsonl` |
| Evidence | gateway.log dan file buffer |
| Status | Pending |

## 11.12 GW-012 — Replay Buffer

| Field | Detail |
|---|---|
| Langkah | Hidupkan backend setelah buffer terisi |
| Expected | Buffer dikirim ulang bertahap |
| Evidence | gateway.log, DB rows |
| Status | Pending |

## 11.13 GW-013 — One Sensor Failure

| Field | Detail |
|---|---|
| Langkah | Simulasikan S2 tidak terbaca atau salah slave ID |
| Expected | S1 tetap diproses, S2 trouble dikirim |
| Evidence | gateway.log, backend system log |
| Status | Pending |

---

# 12. Test Case Frontend Dashboard

## 12.1 FE-001 — Frontend Build

| Field | Detail |
|---|---|
| Command | `npm run build` |
| Expected | Build sukses tanpa error |
| Evidence | Terminal output |
| Status | Pending |

## 12.2 FE-002 — Sidebar Navigation

| Field | Detail |
|---|---|
| Langkah | Buka semua menu sidebar |
| Expected | Dashboard, Sensors & Readings, Prediction & LSTM, Layout, Events & Logs, Settings dapat dibuka |
| Evidence | Screenshot |
| Status | Pending |

## 12.3 FE-003 — Dashboard Cards

| Field | Detail |
|---|---|
| Kondisi | Data sensor tersedia |
| Expected | Card S1/S2 menampilkan suhu, kelembaban, status, last update |
| Evidence | Screenshot dashboard |
| Status | Pending |

## 12.4 FE-004 — Dashboard Empty State

| Field | Detail |
|---|---|
| Kondisi | Database kosong |
| Expected | UI menampilkan data belum tersedia, tidak crash |
| Evidence | Screenshot |
| Status | Pending |

## 12.5 FE-005 — Realtime Update via SSE

| Field | Detail |
|---|---|
| Langkah | Dashboard terbuka, gateway mengirim data baru |
| Expected | Card/chart update tanpa refresh manual |
| Evidence | Screen recording/screenshot |
| Status | Pending |

## 12.6 FE-006 — Sensors & Readings Page

| Field | Detail |
|---|---|
| Expected | Tabel readings, filter sensor, chart suhu/kelembaban tampil |
| Evidence | Screenshot |
| Status | Pending |

## 12.7 FE-007 — Prediction & LSTM Page Model Not Ready

| Field | Detail |
|---|---|
| Kondisi | Belum ada model aktif |
| Expected | Warning model not ready tampil |
| Evidence | Screenshot |
| Status | Pending |

## 12.8 FE-008 — Prediction & LSTM Page Model Ready

| Field | Detail |
|---|---|
| Kondisi | Model dan prediksi tersedia |
| Expected | Latest prediction, metrics, baseline comparison, model version tampil |
| Evidence | Screenshot |
| Status | Pending |

## 12.9 FE-009 — Layout Upload

| Field | Detail |
|---|---|
| Langkah | Upload gambar denah |
| Expected | Layout tersimpan dan tampil |
| Evidence | Screenshot dan API response |
| Status | Pending |

## 12.10 FE-010 — Layout Marker

| Field | Detail |
|---|---|
| Langkah | Tambah/drag marker S1/S2 |
| Expected | Posisi tersimpan dan tampil kembali setelah refresh |
| Evidence | Screenshot dan DB query |
| Status | Pending |

## 12.11 FE-011 — Events & Logs

| Field | Detail |
|---|---|
| Expected | Tab status events, notifications, system logs tampil |
| Evidence | Screenshot |
| Status | Pending |

## 12.12 FE-012 — Settings

| Field | Detail |
|---|---|
| Expected | Threshold, Telegram, gateway summary, ML parameter info tampil |
| Evidence | Screenshot |
| Status | Pending |

---

# 13. Test Case ML Worker

## 13.1 ML-001 — Install Dependencies

| Field | Detail |
|---|---|
| Command | `pip install -r requirements.txt` |
| Expected | Dependency terinstall |
| Evidence | Terminal output |
| Status | Pending |

## 13.2 ML-002 — Database Connection

| Field | Detail |
|---|---|
| Command | `python -m ml_worker.cli evaluate` |
| Expected | ML Worker dapat konek ke PostgreSQL |
| Evidence | Terminal output |
| Status | Pending |

## 13.3 ML-003 — Load Dataset

| Field | Detail |
|---|---|
| Command | `python -m ml_worker.cli train --dry-run` |
| Expected | Data S1/S2 dari database terbaca |
| Evidence | Dataset summary output |
| Status | Pending |

## 13.4 ML-004 — Resampling 1 Menit

| Field | Detail |
|---|---|
| Input | Raw readings 10 detik |
| Expected | Data hasil resample 1 menit terbentuk |
| Evidence | Output shape / sample dataframe |
| Status | Pending |

## 13.5 ML-005 — Missing Value Handling

| Field | Detail |
|---|---|
| Kondisi | Ada data bolong kecil |
| Expected | Interpolation/ffill terbatas, log jumlah missing |
| Evidence | Preprocessing report |
| Status | Pending |

## 13.6 ML-006 — Window Builder

| Field | Detail |
|---|---|
| Parameter | window_size=30, horizon=5 menit |
| Expected | X shape = (samples, 30, 4), y shape = (samples,) |
| Evidence | Terminal output |
| Status | Pending |

## 13.7 ML-007 — Baseline Persistence

| Field | Detail |
|---|---|
| Expected | RMSE, MAE, MAPE baseline persistence dihitung |
| Evidence | Terminal output dan DB baseline_results |
| Status | Pending |

## 13.8 ML-008 — Baseline Moving Average

| Field | Detail |
|---|---|
| Expected | RMSE, MAE, MAPE moving average dihitung |
| Evidence | Terminal output dan DB baseline_results |
| Status | Pending |

## 13.9 ML-009 — Train LSTM

| Field | Detail |
|---|---|
| Command | `python -m ml_worker.cli train` |
| Expected | Training selesai, metrics dihitung |
| Evidence | Terminal output, model_metrics DB |
| Status | Pending |

## 13.10 ML-010 — Artifact Created

| Field | Detail |
|---|---|
| Expected | `model.keras`, `feature_scaler.pkl`, `target_scaler.pkl`, `model_metadata.json` tersedia |
| Evidence | File listing |
| Status | Pending |

## 13.11 ML-011 — Model Version Saved

| Field | Detail |
|---|---|
| Expected | Record model_versions dibuat |
| Evidence | Query database |
| Status | Pending |

## 13.12 ML-012 — Inference Latest Window

| Field | Detail |
|---|---|
| Command | `python -m ml_worker.cli infer` |
| Expected | Prediksi suhu S2 5 menit ke depan dibuat |
| Evidence | Terminal output dan DB predictions |
| Status | Pending |

## 13.13 ML-013 — Data Not Enough

| Field | Detail |
|---|---|
| Kondisi | Data kurang dari 35 data per sensor hasil resample |
| Expected | Inference/training berhenti gracefully, system log dibuat |
| Evidence | Terminal output dan system_logs |
| Status | Pending |

---

# 14. Test Case Status dan Alert

## 14.1 ALERT-001 — Status Normal

| Field | Detail |
|---|---|
| Input | predicted_temperature_s2 = 29.5 |
| Expected | status = normal |
| Evidence | DB predictions |
| Status | Pending |

## 14.2 ALERT-002 — Status Waspada

| Field | Detail |
|---|---|
| Input | predicted_temperature_s2 = 31.0 |
| Expected | status = waspada, anomaly_event dibuat |
| Evidence | DB predictions dan anomaly_events |
| Status | Pending |

## 14.3 ALERT-003 — Status Anomali

| Field | Detail |
|---|---|
| Input | predicted_temperature_s2 = 33.2 |
| Expected | status = anomali, severity critical, anomaly_event dibuat |
| Evidence | DB predictions dan anomaly_events |
| Status | Pending |

## 14.4 ALERT-004 — Sensor Trouble Priority

| Field | Detail |
|---|---|
| Kondisi | S2 trouble, prediction normal |
| Expected | Status aktif dashboard = trouble |
| Evidence | Dashboard screenshot dan API summary |
| Status | Pending |

## 14.5 ALERT-005 — Telegram Disabled

| Field | Detail |
|---|---|
| Kondisi | telegram_enabled=false, status anomali |
| Expected | Tidak kirim Telegram, log skipped jika relevan |
| Evidence | notification_logs |
| Status | Pending |

## 14.6 ALERT-006 — Telegram Sent

| Field | Detail |
|---|---|
| Kondisi | telegram_enabled=true, status anomali |
| Expected | Pesan Telegram terkirim, notification_logs status sent |
| Evidence | Screenshot Telegram dan DB log |
| Status | Pending |

## 14.7 ALERT-007 — Telegram Failure

| Field | Detail |
|---|---|
| Kondisi | Token Telegram salah |
| Expected | Backend tidak crash, notification_logs status failed |
| Evidence | Backend log dan DB log |
| Status | Pending |

## 14.8 ALERT-008 — Cooldown

| Field | Detail |
|---|---|
| Kondisi | Status anomali sama berulang dalam cooldown |
| Expected | Notifikasi ulang skipped |
| Evidence | notification_logs |
| Status | Pending |

---

# 15. End-to-End Test Scenario

## 15.1 E2E-001 — Normal Monitoring Flow

| Field | Detail |
|---|---|
| Tujuan | Menguji alur normal dari sensor ke dashboard |
| Langkah | Jalankan DB, backend, frontend, gateway; sensor membaca suhu normal |
| Expected | Data S1/S2 masuk DB, dashboard update, status normal |
| Evidence | Dashboard screenshot, DB query, gateway log |
| Status | Pending |

## 15.2 E2E-002 — Prediction Flow

| Field | Detail |
|---|---|
| Tujuan | Menguji alur ML dari data sensor ke prediksi |
| Langkah | Kumpulkan data, jalankan training, activate model, jalankan inference |
| Expected | Model artifact dibuat, prediction tampil di dashboard |
| Evidence | ML log, model file, dashboard Prediction & LSTM |
| Status | Pending |

## 15.3 E2E-003 — Waspada Alert Flow

| Field | Detail |
|---|---|
| Tujuan | Menguji status waspada |
| Langkah | Hasilkan prediksi S2 30–32°C |
| Expected | Status waspada, event tersimpan, dashboard update |
| Evidence | DB anomaly_events, dashboard screenshot |
| Status | Pending |

## 15.4 E2E-004 — Anomali Alert Flow

| Field | Detail |
|---|---|
| Tujuan | Menguji status anomali dan Telegram |
| Langkah | Hasilkan prediksi S2 > 32°C |
| Expected | Status anomali, event critical, Telegram sesuai setting |
| Evidence | Telegram screenshot, notification_logs |
| Status | Pending |

## 15.5 E2E-005 — Sensor Trouble Flow

| Field | Detail |
|---|---|
| Tujuan | Menguji sensor trouble |
| Langkah | Cabut sensor atau gunakan slave ID salah |
| Expected | Gateway log error, backend menerima trouble, dashboard marker trouble |
| Evidence | gateway.log, dashboard layout, system_logs |
| Status | Pending |

## 15.6 E2E-006 — Backend Offline Flow

| Field | Detail |
|---|---|
| Tujuan | Menguji buffer gateway |
| Langkah | Matikan backend saat gateway berjalan |
| Expected | Gateway buffer payload, tidak crash, replay saat backend hidup |
| Evidence | failed_payloads.jsonl, gateway.log, DB rows setelah replay |
| Status | Pending |

---

# 16. Performance and Stability Test Ringkas

## 16.1 PERF-001 — Gateway 10 Detik Selama 30 Menit

| Field | Detail |
|---|---|
| Langkah | Jalankan gateway 30 menit |
| Expected | Data masuk periodik, tidak memory/error berlebihan |
| Evidence | Jumlah rows sensor_readings dan gateway.log |
| Status | Pending |

Expected approximate rows:

```text
30 menit × 60 detik / 10 detik = 180 cycle
2 sensor × 180 = 360 rows
```

## 16.2 PERF-002 — Dashboard Chart 1 Jam

| Field | Detail |
|---|---|
| Langkah | Ambil chart data 1 jam terakhir |
| Expected | Dashboard tetap responsif |
| Evidence | Screenshot dan browser devtools |
| Status | Pending |

## 16.3 PERF-003 — ML Training Minimum Dataset

| Field | Detail |
|---|---|
| Kondisi | Dataset minimal cukup untuk windowing |
| Expected | Training tidak crash; jika data kurang, pesan jelas |
| Evidence | ML output |
| Status | Pending |

---

# 17. Regression Checklist Setiap Milestone

Setelah Codex menyelesaikan milestone, jalankan checklist berikut:

```text
[ ] Backend masih bisa build
[ ] Frontend masih bisa build
[ ] Migration masih bisa dijalankan dari database kosong
[ ] Health endpoint masih OK
[ ] POST readings masih OK
[ ] Dashboard masih bisa dibuka
[ ] Tidak ada dummy data produksi baru
[ ] Tidak ada fitur PUE/energy/cooling control ditambahkan
[ ] README/runbook diperbarui jika ada command baru
```

---

# 18. Format Tabel Pengujian untuk Bab 4

Gunakan format berikut saat menulis Bab 4:

| ID | Skenario | Langkah Uji | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| API-004 | POST readings valid | Kirim payload S1/S2 valid | Data tersimpan | Data tersimpan 2 baris | Berhasil |

Status:

```text
Berhasil
Gagal
Sebagian Berhasil
Tidak Diuji
```

---

## 19. Risk dan Mitigasi Pengujian

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Sensor XY-MD02 belum terbaca | Gateway hardware tertunda | Gunakan diagnostic raw register dan cek wiring A/B |
| Slave ID tidak diketahui | Sensor tidak merespons | Test slave ID 1–10 secara hati-hati |
| Register salah | Nilai suhu/kelembaban tidak masuk akal | Buat register configurable |
| Data real kurang untuk LSTM | Training tidak stabil | Kumpulkan data lebih lama; jelaskan keterbatasan; gunakan baseline |
| Telegram gagal | Alert tidak terkirim | Simpan failed log; backend tetap jalan |
| VPS tidak siap | Deployment tertunda | Gunakan laptop-first deployment |
| Dashboard berat | UI lag | Batasi data chart default 1 jam/6 jam |
| Backend offline | Data hilang | Gateway bounded buffer dan replay |

---

## 20. Instruksi untuk Codex

Saat mengimplementasikan sistem, Codex harus:

1. Membuat testable milestone.
2. Menyediakan command test setelah membuat fitur.
3. Menjalankan build/test jika memungkinkan.
4. Tidak menganggap milestone selesai hanya karena file dibuat.
5. Menulis README/runbook command aktual.
6. Menyediakan curl example untuk endpoint API.
7. Menyediakan diagnostic command untuk gateway.
8. Menyediakan command training dan inference ML.
9. Tidak memasukkan dummy data ke jalur produksi.
10. Tidak menambahkan fitur di luar scope.

---

## 21. Final Acceptance Criteria

Sistem dianggap siap untuk masuk Bab 4 jika semua kondisi berikut terpenuhi:

```text
[ ] Sensor/gateway path berhasil diuji atau error hardware terdokumentasi jelas
[ ] Backend API utama berjalan
[ ] Database menyimpan readings, predictions, metrics, events, logs
[ ] Dashboard menampilkan data asli dari backend
[ ] ML Worker menghasilkan artifact dan metrics
[ ] Inference menghasilkan prediksi S2
[ ] Status normal/waspada/anomali/trouble dapat dibuktikan
[ ] Layout marker sensor berjalan
[ ] Telegram test/alert berjalan atau failure tercatat aman
[ ] Evidence screenshot/log/API/DB tersedia
[ ] Tidak ada PUE, energy optimization, atau cooling control
```
