# 03 System Architecture Final — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini menjelaskan arsitektur final sistem **EMS Thermal LSTM**. Dokumen ini menjadi pegangan Codex untuk membangun project dari awal secara modular, hardware-first, dan siap digunakan sebagai dasar Bab 4 Implementasi dan Pengujian.

Dokumen ini mengunci:

1. Komponen utama sistem.
2. Struktur repository.
3. Alur data sensor dari Raspberry Pi ke dashboard.
4. Alur preprocessing dan prediksi LSTM.
5. Alur status termal dan alert Telegram.
6. Arsitektur deployment lokal.
7. Batas tanggung jawab setiap komponen.
8. Event realtime yang digunakan dashboard.
9. Prinsip error handling dan observability.

---

## 2. Prinsip Arsitektur

Arsitektur EMS Thermal LSTM mengikuti prinsip berikut:

1. **Hardware-first**  
   Alur utama sistem berasal dari sensor fisik XY-MD02 melalui Raspberry Pi gateway.

2. **Modular**  
   Backend, frontend, gateway, database, dan ML Worker dipisahkan agar mudah dikembangkan dan diuji.

3. **Time-series oriented**  
   Data sensor disimpan berdasarkan timestamp dan dapat diolah menjadi dataset time-series.

4. **Predictive monitoring**  
   Sistem tidak hanya menampilkan data aktual, tetapi juga prediksi suhu S2 5 menit ke depan.

5. **Thesis explainable**  
   Arsitektur harus cukup kuat tetapi tetap mudah dijelaskan dalam Bab 4 skripsi.

6. **Local-first deployment**  
   Implementasi awal berjalan di laptop development, sedangkan Raspberry Pi mengirim data melalui LAN atau ZeroTier.

7. **Safe failure**  
   Kegagalan sensor, gateway, Telegram, ML Worker, atau SSE tidak boleh membuat seluruh sistem crash.

8. **No overengineering**  
   Tidak menggunakan Kafka, Kubernetes, microservice kompleks, atau stack enterprise yang tidak dibutuhkan untuk skripsi.

### 2.1 Documentation Lock Decisions

1. ML Worker boleh membaca PostgreSQL langsung.
2. Hasil inference final wajib dikirim ke protected endpoint `POST /api/v1/ml/predictions`.
3. Backend memiliki final status classification, anomaly event creation, SSE event, dan Telegram notification.
4. Status dipisahkan menjadi:

```text
sensor_health_status: normal | trouble | inactive
thermal_status      : normal | waspada | anomali
final_status        : trouble > anomali > waspada > normal
```

5. Gateway heartbeat setiap 60 detik.
6. Backend offline checker setiap 30 detik.
7. Sensor atau gateway trouble jika tidak ada data lebih dari 5 menit.
8. Prediction stale setelah 10 menit dan tidak boleh menjadi active dashboard status atau Telegram trigger.
9. `anomaly_events.event_type` membedakan `actual_threshold`, `prediction_threshold`, `sensor_trouble`, dan `gateway_trouble`; kategori UI-nya adalah Alarm, Pre-Alarm, Trouble, atau Recovery.
10. Event disimpan hanya pada transisi status/eskalasi. Reading mentah tetap disimpan setiap 10 detik.
11. Alarm aktual berlaku untuk S1 dan S2. Pre-Alarm hanya berlaku untuk prediksi target S2 yang tidak stale.
12. Status perangkat pada Dashboard, Sensors & Readings, dan Layout memakai health trouble sebagai prioritas; bila health normal, status mengikuti threshold suhu aktual. Pre-Alarm tidak mengubah status atau warna perangkat.

---

## 3. Komponen Utama Sistem

```text
+----------------------+        +--------------------------+
| Sensor XY-MD02 S1    |        | Sensor XY-MD02 S2        |
| Ambient / Reference  |        | Hotspot / Exhaust        |
+----------+-----------+        +------------+-------------+
           |                                 |
           | RS485 A/B                       | RS485 A/B
           +---------------+-----------------+
                           |
                           v
                 +------------------+
                 | USB RS485 Adapter|
                 +--------+---------+
                          |
                          | USB Serial
                          v
                 +------------------+
                 | Raspberry Pi 3   |
                 | Gateway Python   |
                 +--------+---------+
                          |
                          | HTTP REST JSON
                          v
+--------------------------------------------------------------+
| EMS Central Platform - Laptop Development                    |
|                                                              |
|  +----------------+       +-------------------------------+  |
|  | Go Backend API | <---> | PostgreSQL Database           |  |
|  | REST + SSE     |       | Time-series + ML Result       |  |
|  +-------+--------+       +-------------------------------+  |
|          |                                                   |
|          | REST + SSE                                       |
|          v                                                   |
|  +----------------+                                          |
|  | React Dashboard|                                          |
|  +----------------+                                          |
|                                                              |
|  +----------------+                                          |
|  | Python ML Worker| <---- reads/writes database             |
|  +----------------+                                          |
|                                                              |
|  +----------------+                                          |
|  | Telegram Bot   |                                          |
|  +----------------+                                          |
+--------------------------------------------------------------+
```

---

## 4. Deployment View

### 4.1 Deployment Awal

Deployment awal dilakukan secara lokal pada laptop development.

```text
Laptop Development
├── PostgreSQL
├── Go Backend API
├── React Dashboard
├── Python ML Worker
└── Docker Compose optional

Raspberry Pi 3
└── Python Gateway Service

Network
└── LAN lokal atau ZeroTier
```

### 4.2 Alasan Laptop-First

1. Lebih cepat untuk debugging.
2. Tidak perlu konfigurasi firewall VPS di awal.
3. Lebih mudah melakukan build frontend/backend.
4. Lebih mudah memantau database dan log.
5. Lebih cocok untuk pengembangan awal dan pengujian Bab 4.

### 4.3 VPS

VPS Ubuntu 24.04 bersifat opsional setelah sistem lokal stabil.

VPS tidak menjadi deployment utama pada tahap awal agar tidak menambah masalah:

1. Firewall.
2. Port expose.
3. SSL/domain.
4. Database remote.
5. Latency gateway.
6. Pengelolaan environment tambahan.

---

## 5. Struktur Repository Final

Nama repository disarankan:

```text
ems-thermal-lstm
```

Struktur repository:

```text
ems-thermal-lstm/
├── README.md
├── docker-compose.yml
├── .env.example
├── Dokumentasi/
│   ├── 00_Project_Direction_Final.md
│   ├── 01_System_Scope_and_Features_Final.md
│   ├── 02_Hardware_and_Gateway_Final.md
│   ├── 03_System_Architecture_Final.md
│   ├── 04_Database_Design_Final.md
│   ├── 05_Backend_API_Final.md
│   ├── 06_ML_Worker_LSTM_Final.md
│   ├── 07_Frontend_Dashboard_Final.md
│   ├── 08_Alert_and_Telegram_Final.md
│   ├── 09_Test_Plan_Final.md
│   └── 10_Codex_Implementation_Runbook.md
│
├── backend-go/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── database/
│   │   ├── handler/
│   │   ├── middleware/
│   │   ├── model/
│   │   ├── repository/
│   │   ├── service/
│   │   ├── sse/
│   │   ├── telegram/
│   │   ├── validator/
│   │   └── logger/
│   ├── migrations/
│   ├── go.mod
│   ├── go.sum
│   └── README.md
│
├── frontend-dashboard/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── components.json
│   ├── .env.example
│   └── README.md
│
├── gateway-rpi/
│   ├── src/
│   │   └── gateway/
│   │       └── cli.py
│   ├── config.example.yaml
│   ├── .env.example
│   ├── requirements.txt
│   ├── README.md
│   ├── logs/
│   └── data/
│
├── ml-worker/
│   ├── src/
│   │   └── ml_worker/
│   │       ├── config.py
│   │       ├── db.py
│   │       ├── dataset_loader.py
│   │       ├── preprocessing.py
│   │       ├── windowing.py
│   │       ├── baseline.py
│   │       ├── model.py
│   │       ├── train.py
│   │       ├── evaluate.py
│   │       ├── inference.py
│   │       ├── writer.py
│   │       ├── status.py
│   │       └── cli.py
│   ├── models/
│   ├── reports/
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
└── scripts/
    ├── dev-start.sh
    ├── dev-stop.sh
    ├── run-migrations.sh
    └── seed.sh
```

---

## 6. Component Responsibility Matrix

| Komponen | Tanggung Jawab | Tidak Boleh Melakukan |
|---|---|---|
| Gateway Raspberry Pi | Baca sensor, validasi awal, kirim payload, buffer lokal, diagnostic | Training LSTM, dashboard utama, database utama |
| Backend Go | API, validasi, database, SSE, settings, alert, Telegram | Training model, membaca sensor langsung |
| PostgreSQL | Penyimpanan data sensor, prediksi, metrics, logs | Logic aplikasi kompleks |
| ML Worker | Preprocessing, training, baseline, evaluation, inference | Membaca sensor langsung, UI dashboard |
| React Dashboard | Visualisasi, layout, settings, monitoring | Business logic berat, training langsung sebagai proses blocking |
| Telegram Service | Mengirim alert | Mengontrol perangkat fisik |

---

## 7. Data Flow Sensor Realtime

```text
XY-MD02 S1/S2
    ↓
Raspberry Pi Gateway
    ↓
Read Modbus RTU
    ↓
Validate reading
    ↓
Build JSON payload
    ↓
HTTP POST /api/v1/readings
    ↓
Go Backend validates payload
    ↓
Save to PostgreSQL sensor_readings
    ↓
Emit SSE event reading.latest
    ↓
React Dashboard updates cards/charts
```

### 7.1 Raw Sensor Interval

```text
Gateway read/send interval: 10 seconds
```

Data mentah disimpan ke database sesuai interval ini.

### 7.2 Dashboard Realtime

Dashboard menerima update melalui SSE. Realtime dalam sistem ini berarti dashboard memperbarui tampilan saat data baru masuk, bukan harus membaca sensor tiap 1 detik.

---

## 8. ML Data Flow

```text
sensor_readings table
    ↓
ML Worker loads data
    ↓
Merge S1 and S2 by timestamp
    ↓
Resample to 1-minute interval
    ↓
Handle missing/invalid values
    ↓
Create target: S2 temperature at t+5 minutes
    ↓
Scale features and target
    ↓
Build window data
    ↓
Chronological split
    ↓
Train baseline models
    ↓
Train LSTM
    ↓
Evaluate RMSE, MAE, MAPE
    ↓
Save model artifacts
    ↓
Save model version and metrics
```

### 8.1 ML Interval

```text
ML resampling interval: 60 seconds
```

Walaupun raw readings masuk setiap 10 detik, dataset LSTM menggunakan hasil resampling 1 menit agar window 30 tetap berarti 30 menit histori.

### 8.2 Target Prediction

```text
Target: temperature_s2 at t+5 minutes
```

---

## 9. Inference Flow

```text
Inference scheduler / CLI
    ↓
Load active model version
    ↓
Load model.keras
    ↓
Load feature_scaler.pkl
    ↓
Load target_scaler.pkl
    ↓
Load latest sensor data
    ↓
Resample to 1-minute interval
    ↓
Build latest 30-step window
    ↓
Predict future S2 temperature
    ↓
Inverse scale prediction
    ↓
Submit POST /api/v1/ml/predictions
    ↓
Backend classifies and saves prediction
    ↓
Backend creates anomaly event if needed
    ↓
Backend/dashboard displays prediction
    ↓
Telegram alert if rule matched
```

### 9.1 Inference Trigger

Inference dapat dijalankan dengan salah satu cara berikut:

1. CLI manual.
2. Scheduled process setiap 1 menit.
3. Worker loop sederhana.

Untuk versi skripsi, worker loop sederhana atau CLI terjadwal sudah cukup. Tidak perlu job queue kompleks.

---

## 10. Status Classification Flow

```text
Prediction created
    ↓
Get predicted_temperature_s2
    ↓
Check sensor/gateway trouble first
    ↓
If trouble exists: status = trouble
    ↓
Else if predicted < 30: status = normal
    ↓
Else if predicted <= 32: status = waspada
    ↓
Else: status = anomali
    ↓
Save status
    ↓
Emit SSE event prediction.latest / anomaly.created
    ↓
Send Telegram if needed
```

Status priority:

```text
trouble > anomali > waspada > normal
```

---

## 11. Alert and Telegram Flow

```text
Prediction/status event
    ↓
Status is waspada/anomali/trouble?
    ↓
Check previous status
    ↓
Check cooldown
    ↓
Telegram enabled?
    ↓
Send Telegram message
    ↓
Save notification_logs
    ↓
Emit SSE notification event
```

Telegram failure must not crash backend.

If Telegram is disabled:

1. Do not send request to Telegram API.
2. Save notification log with status `skipped` if relevant.
3. Show Telegram disabled state in dashboard.

---

## 12. SSE Realtime Architecture

Backend menyediakan endpoint:

```http
GET /api/v1/events
```

Dashboard menggunakan EventSource untuk menerima event realtime.

### 12.1 Event Types

| Event | Source | Fungsi |
|---|---|---|
| `reading.latest` | Backend setelah insert reading | Update card/grafik sensor |
| `gateway.status` | Backend setelah status gateway masuk | Update gateway status |
| `sensor.trouble` | Backend/gateway | Update sensor trouble |
| `prediction.latest` | ML/backend | Update prediksi terbaru |
| `anomaly.created` | Backend/ML | Update recent events |
| `notification.sent` | Backend Telegram | Update notification logs |
| `system.log` | Backend | Update logs jika diperlukan |

### 12.2 SSE Failure Handling

Jika SSE disconnect:

1. Dashboard menampilkan status disconnected.
2. Dashboard tidak crash.
3. User bisa refresh manual.
4. Frontend boleh reconnect otomatis.
5. Data tetap bisa diambil melalui REST API.

---

## 13. Backend Layer Architecture

Backend Go menggunakan arsitektur berlapis:

```text
HTTP Router
    ↓
Middleware
    ↓
Handler
    ↓
Validator
    ↓
Service
    ↓
Repository
    ↓
Database
```

### 13.1 Handler Layer

Tanggung jawab:

1. Parse request.
2. Memanggil validator.
3. Memanggil service.
4. Mengembalikan response JSON.

Handler tidak boleh berisi query SQL kompleks.

### 13.2 Service Layer

Tanggung jawab:

1. Business logic.
2. Status classification.
3. Alert rule.
4. Notification decision.
5. Orkestrasi antar repository.

### 13.3 Repository Layer

Tanggung jawab:

1. Query database.
2. Insert/update/select data.
3. Mapping row ke model.

Repository tidak boleh berisi business logic berat.

---

## 14. Frontend Architecture

Frontend menggunakan React + Vite + TypeScript + Tailwind + shadcn/ui + Chart.js.

```text
frontend-dashboard/src/
├── app/
│   └── App.tsx
├── components/
│   ├── layout/
│   ├── dashboard/
│   ├── charts/
│   ├── tables/
│   ├── status/
│   └── ui/
├── pages/
│   ├── DashboardPage.tsx
│   ├── SensorsReadingsPage.tsx
│   ├── PredictionLSTMPage.tsx
│   ├── LayoutPage.tsx
│   ├── EventsLogsPage.tsx
│   └── SettingsPage.tsx
├── hooks/
├── lib/
│   ├── api.ts
│   ├── sse.ts
│   ├── status.ts
│   └── utils.ts
├── types/
└── main.tsx
```

### 14.1 Frontend Rules

1. API base URL harus dari env.
2. Tidak boleh hardcode data produksi.
3. Semua halaman harus punya loading, empty, dan error state.
4. Status badge harus menampilkan teks dan warna.
5. SSE harus reconnect atau minimal menampilkan disconnected state.
6. Chart harus bisa menangani data kosong.

---

## 15. Gateway Architecture

Gateway menggunakan arsitektur ringan:

```text
CLI / main
    ↓
Config Loader
    ↓
Modbus Client
    ↓
Sensor Reader
    ↓
Validator
    ↓
Payload Builder
    ↓
HTTP Sender
    ↓
Buffer Manager
    ↓
Logger
```

### 15.1 Gateway Runtime Modes

| Mode | Fungsi |
|---|---|
| `diagnose ports` | Menampilkan serial port |
| `diagnose raw` | Membaca raw register |
| `diagnose sensor` | Membaca sensor berdasarkan config |
| `send-test` | Mengirim payload test ke backend |
| `run` | Menjalankan gateway service utama |

Gateway simulator bukan mode utama. Jika dibuat, tempatkan sebagai alat bantu development terpisah.

Development-only realtime simulator:

```bash
python -m gateway.cli simulate --scenario random-smooth --duration 30m --interval 10
python -m gateway.cli simulate --scenario random-smooth --duration forever --interval 10
```

Aturan:

1. Simulator mengirim payload readings dengan `source=simulator`.
2. Simulator tidak membaca Modbus dan tidak menggantikan mode hardware.
3. Jangan menjalankan simulator bersamaan dengan gateway hardware untuk S1/S2 yang sama.
4. Scenario minimal: normal stabil, heat-cycle, random-smooth, dan drop sensor untuk uji trouble timeout.
5. Data simulator hanya untuk uji dashboard, backend, SSE, event, Telegram, dan eksperimen augmentasi training.
6. Data simulator tidak boleh menjadi bukti hardware skripsi atau validation/test ML final.

---

## 16. Database Architecture Overview

Database PostgreSQL menyimpan:

1. Gateways.
2. Sensors.
3. Sensor readings.
4. Prediction runs.
5. Predictions.
6. Model versions.
7. Model metrics.
8. Baseline results.
9. Status event history pada tabel internal `anomaly_events`.
10. Notification logs.
11. Layouts.
12. Layout devices.
13. Settings.
14. System logs.
15. API tokens.

TimescaleDB optional. Jika TimescaleDB tidak tersedia, sistem tetap berjalan dengan index timestamp di PostgreSQL.

---

## 17. Communication Contracts

### 17.1 Gateway → Backend

Protocol:

```text
HTTP REST JSON
```

Endpoints:

```text
GET  /api/v1/health
POST /api/v1/readings
POST /api/v1/gateway/status
```

Authentication:

```text
Authorization: Bearer <gateway_token>
```

### 17.2 Dashboard → Backend

Protocol:

```text
HTTP REST JSON + SSE
```

Dashboard development tidak wajib login pada versi awal.

### 17.3 ML Worker → Database

Protocol:

```text
PostgreSQL connection
```

ML Worker boleh menulis langsung ke database untuk metadata training:

1. Model versions.
2. Model metrics.
3. Baseline results.
4. Training prediction runs.
5. System logs.

Hasil inference final tidak ditulis langsung ke tabel `predictions`. ML Worker mengirim hasil inference ke:

```text
POST /api/v1/ml/predictions
Authorization: Bearer <INTERNAL_TOKEN>
```

Backend kemudian menyimpan prediction, menyusun `thermal_status` dan `final_status`, membuat anomaly event jika perlu, mengirim SSE, dan menjalankan keputusan Telegram.

### 17.4 Backend → Telegram

Protocol:

```text
Telegram Bot API HTTPS
```

Telegram failure harus dicatat, bukan membuat sistem crash.

---

## 18. Error Handling Architecture

### 18.1 Gateway Error Handling

| Error | Aksi |
|---|---|
| Sensor timeout | Log error, kirim status trouble |
| Satu sensor gagal | Sensor lain tetap diproses |
| Backend offline | Retry 1x, buffer payload |
| Buffer penuh | Drop payload tertua, log warning |
| Config invalid | Tampilkan error jelas dan stop |

### 18.2 Backend Error Handling

| Error | Aksi |
|---|---|
| Payload invalid | Return 422 |
| Token invalid | Return 401 |
| Database down | Return 503 |
| Telegram failed | Save failed log, backend tetap jalan |
| SSE client disconnect | Remove client, backend tetap jalan |

### 18.3 ML Worker Error Handling

| Error | Aksi |
|---|---|
| Data kurang | Save system log, stop training/inference gracefully |
| Model tidak ditemukan | Save system log, status model not ready |
| Scaler tidak ditemukan | Save system log |
| Training gagal | Save failed prediction_run |
| Inference gagal | Save system log |

### 18.4 Frontend Error Handling

| Error | Aksi |
|---|---|
| API error | Tampilkan alert |
| Data kosong | Tampilkan empty state |
| SSE disconnected | Tampilkan status disconnected |
| Model not ready | Tampilkan warning |
| Layout belum ada | Tampilkan upload prompt |

---

## 19. Observability dan Logging

Setiap komponen harus memiliki logging.

| Komponen | Log Minimal |
|---|---|
| Gateway | start, read success/fail, send success/fail, buffer, replay |
| Backend | request error, validation error, DB error, Telegram error, SSE event |
| ML Worker | load data, preprocessing, training, metrics, artifact saved, inference |
| Frontend | UI tidak wajib simpan log, tetapi harus menampilkan error state |

System logs penting untuk Bab 4 karena menunjukkan sistem dapat menangani kondisi error.

---

## 20. Security Architecture Ringkas

1. Gateway menggunakan Bearer token.
2. Token tidak boleh hardcoded.
3. Telegram bot token tidak boleh hardcoded.
4. `.env` asli tidak boleh di-commit.
5. Settings sensitif harus disamarkan di UI.
6. Dashboard development boleh tanpa login untuk versi skripsi.
7. CORS hanya mengizinkan origin frontend development yang dikonfigurasi.

---

## 21. Milestone Arsitektur Implementasi

### Milestone A — Foundation

1. Buat repo structure.
2. Buat docker-compose PostgreSQL.
3. Buat backend skeleton.
4. Buat frontend skeleton.
5. Buat gateway skeleton.
6. Buat ML Worker skeleton.

### Milestone B — Database and Backend Core

1. Migration database.
2. Seed gateway dan sensor.
3. Health endpoint.
4. POST readings.
5. Latest/history readings.

### Milestone C — Gateway Data Flow

1. Gateway config.
2. Diagnostic ports/raw/sensor.
3. Send readings.
4. Retry/buffer.

### Milestone D — Dashboard Monitoring

1. App layout.
2. Dashboard cards.
3. Sensors & Readings.
4. Chart.
5. SSE update.

### Milestone E — ML Worker

1. Load data.
2. Preprocess.
3. Train baseline.
4. Train LSTM.
5. Save artifact.
6. Inference.

### Milestone F — Prediction and Alert

1. Prediction APIs.
2. Model version UI.
3. Status classification.
4. Status event history pada tabel internal `anomaly_events`.
5. Telegram.

### Milestone G — Layout and Final Testing

1. Layout upload.
2. Sensor marker.
3. Events & Logs.
4. Settings.
5. Integration test.
6. Bab 4 evidence capture.

---

## 22. Architecture Acceptance Criteria

| Kode | Kriteria |
|---|---|
| ARCH-001 | Repo memiliki struktur modular sesuai dokumen |
| ARCH-002 | Gateway, backend, frontend, ML Worker dapat dikembangkan terpisah |
| ARCH-003 | Data sensor dapat mengalir dari gateway ke database |
| ARCH-004 | Dashboard mengambil data dari backend |
| ARCH-005 | SSE mengirim update realtime |
| ARCH-006 | ML Worker membaca data database dan menyimpan hasil prediksi |
| ARCH-007 | Status termal dihitung berdasarkan prediksi S2 |
| ARCH-008 | Telegram alert tidak membuat sistem crash saat gagal |
| ARCH-009 | Layout dapat membaca status sensor dari backend |
| ARCH-010 | Sistem tetap berjalan meskipun satu komponen non-kritis gagal |

---

## 23. Instruksi untuk Codex

Saat membangun arsitektur ini, Codex harus:

1. Membuat repo baru dari nol.
2. Menjaga folder sesuai struktur final.
3. Tidak menggabungkan semua logic ke satu file besar.
4. Tidak membuat simulator sebagai jalur utama.
5. Tidak membuat PUE atau kontrol pendingin.
6. Tidak menambahkan microservice atau message broker tanpa kebutuhan.
7. Menjaga konfigurasi melalui `.env` dan config file.
8. Menyediakan README per komponen.
9. Menjalankan build/test setelah milestone.
10. Melaporkan file yang dibuat dan command yang dijalankan.
