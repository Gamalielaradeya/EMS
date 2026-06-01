# 10 Codex Implementation Runbook — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini adalah runbook implementasi untuk Codex saat membangun project **EMS Thermal LSTM** dari nol.

Runbook ini harus menjadi dokumen operasional utama ketika coding dimulai. Codex wajib membaca seluruh dokumen di `Dokumentasi/` sebelum membuat kode, lalu mengikuti milestone di dokumen ini secara berurutan.

Tujuan runbook:

1. Mengarahkan Codex agar tidak melebar dari scope skripsi.
2. Membagi pekerjaan ke milestone yang jelas.
3. Menentukan urutan coding yang aman.
4. Menentukan command build/test setiap milestone.
5. Menentukan definition of done setiap milestone.
6. Menjaga project tetap hardware-first.
7. Menghindari pengulangan kegagalan repo lama yang terlalu banyak patch tanpa arah.

---

## 2. Project Final

Nama project:

```text
EMS Thermal LSTM
```

Nama repository:

```text
ems-thermal-lstm
```

Mode utama:

```text
Hardware-first / real sensor mode
```

Deployment awal:

```text
Laptop development + Raspberry Pi gateway
```

Komponen utama:

```text
backend-go/
frontend-dashboard/
gateway-rpi/
ml-worker/
Dokumentasi/
scripts/
```

---

## 3. Dokumen yang Wajib Dibaca Codex

Sebelum coding, Codex wajib membaca dokumen berikut:

```text
Dokumentasi/00_Project_Direction_Final.md
Dokumentasi/01_System_Scope_and_Features_Final.md
Dokumentasi/02_Hardware_and_Gateway_Final.md
Dokumentasi/03_System_Architecture_Final.md
Dokumentasi/04_Database_Design_Final.md
Dokumentasi/05_Backend_API_Final.md
Dokumentasi/06_ML_Worker_LSTM_Final.md
Dokumentasi/07_Frontend_Dashboard_Final.md
Dokumentasi/08_Alert_and_Telegram_Final.md
Dokumentasi/09_Test_Plan_Final.md
Dokumentasi/10_Codex_Implementation_Runbook.md
```

Jika ada konflik antar dokumen, urutan prioritasnya:

```text
1. 10_Codex_Implementation_Runbook.md
2. 00_Project_Direction_Final.md
3. 01_System_Scope_and_Features_Final.md
4. Dokumen teknis spesifik sesuai modul
```

---

## 4. Aturan Utama untuk Codex

Codex harus mengikuti aturan berikut:

1. Jangan coding sebelum membaca dokumen final.
2. Jangan mengubah scope tanpa persetujuan user.
3. Jangan membuat PUE.
4. Jangan membuat efisiensi energi.
5. Jangan membuat kontrol kipas, AC, relay, atau auto-remediation.
6. Jangan membuat sistem enterprise data center.
7. Jangan menjadikan simulator sebagai jalur utama.
8. Jangan training LSTM di Raspberry Pi.
9. Jangan menambahkan message broker, Kubernetes, atau microservice kompleks.
10. Jangan membuat sidebar di luar sidebar final.
11. Jangan menggunakan dummy data pada jalur produksi dashboard.
12. Jangan hardcode token, database password, Telegram token, atau backend URL.
13. Setiap milestone wajib di-build/test sebelum lanjut.
14. Laporkan file yang dibuat atau diubah.
15. Laporkan command yang dijalankan dan hasilnya.
16. Jika test gagal, perbaiki sampai milestone valid.
17. Jika ada ambiguity, berhenti dan minta keputusan.

---

## 5. Sidebar Dashboard Final

Sidebar final tidak boleh diubah kecuali user meminta.

```text
Dashboard
Sensors & Readings
Prediction & LSTM
Layout
Events & Logs
Settings
```

Jangan membuat menu terpisah untuk:

```text
Sensor Management
Gateway Management
Model Versions
Model Evaluation
Notifications
Telegram
System Logs
```

Fitur tersebut harus digabung ke menu final yang sesuai.

---

## 6. Parameter Sistem yang Dikunci

| Parameter | Nilai Final |
|---|---:|
| Gateway raw read interval | 10 detik |
| Gateway send interval | 10 detik |
| Dashboard update | SSE saat data masuk |
| ML resample interval | 60 detik |
| LSTM window size | 30 data hasil resample |
| LSTM window duration | 30 menit |
| Prediction horizon | 5 menit |
| Target prediksi | Suhu S2 |
| S1 role | ambient/reference |
| S2 role | hotspot/exhaust |
| Normal threshold | `< 30°C` |
| Waspada threshold | `30°C sampai 32°C` |
| Anomali threshold | `> 32°C` |
| Sensor trouble timeout | 5 menit |
| Gateway heartbeat interval | 60 detik |
| Backend offline checker interval | 30 detik |
| Prediction stale TTL | 10 menit |
| Actual S2 match tolerance | `+/-60 detik` |
| Telegram cooldown | 5 menit |

---

## 7. Tech Stack Final

### 7.1 Backend

```text
Go / Golang
REST API
Server-Sent Events
PostgreSQL
Telegram Bot API
```

Router boleh menggunakan Chi atau Gin. Pilih satu dan konsisten.

### 7.2 Frontend

```text
React
Vite
TypeScript
Tailwind CSS
shadcn/ui
Chart.js
SSE EventSource
```

### 7.3 Gateway

```text
Python
pymodbus
pyserial
httpx atau requests
PyYAML
logging
```

### 7.4 ML Worker

```text
Python
TensorFlow/Keras
Pandas
NumPy
Scikit-learn
Joblib
SQLAlchemy atau psycopg
```

### 7.5 Database

```text
PostgreSQL
TimescaleDB optional only
```

---

## 8. Repository Structure Target

Codex harus membuat struktur berikut:

```text
ems-thermal-lstm/
├── README.md
├── docker-compose.yml
├── .env.example
├── Dokumentasi/
├── backend-go/
├── frontend-dashboard/
├── gateway-rpi/
├── ml-worker/
└── scripts/
```

Setiap komponen wajib memiliki README sendiri:

```text
backend-go/README.md
frontend-dashboard/README.md
gateway-rpi/README.md
ml-worker/README.md
```

---

## 9. Milestone Overview

Implementasi dibagi menjadi 12 milestone:

```text
M-1 Documentation Lock
M0  Repository foundation
M1  Database migrations and seed
M2  Backend core API
M3  Gateway diagnostic and delivery
M4  Frontend foundation and dashboard shell
M5  Sensors & readings realtime dashboard
M6  ML Worker training pipeline
M7  ML inference and prediction integration
M8  Alert, Telegram, and events logs
M9  Layout upload and sensor marker
M10 Final integration, testing, and Bab 4 evidence
```

Codex harus menyelesaikan milestone secara berurutan.

---

# M-1 - Documentation Lock

## 9.1 Tujuan

Mengunci dokumentasi sebelum implementasi.

## 9.2 Status

```text
Done
```

## 9.3 Decisions Locked

1. Canonical documentation path: `Dokumentasi/`.
2. ML inference result dikirim ke protected `POST /api/v1/ml/predictions`.
3. Backend memiliki final classification, anomaly events, SSE, dan Telegram.
4. Status dipisahkan menjadi `sensor_health_status`, `thermal_status`, dan `final_status`.
5. Reading dedupe key: `(gateway_id, sensor_id, recorded_at)`.
6. Gateway token bootstrap dari `.env`, lalu simpan dan validasi hash pada `api_tokens`.
7. Sensitive write endpoint memakai simple admin/internal token.
8. Gateway heartbeat 60 detik, backend offline checker 30 detik, trouble timeout lebih dari 5 menit.
9. Prediction stale setelah 10 menit.
10. Actual S2 matching memakai nearest reading tolerance `+/-60 detik`.
11. Canonical CLI memakai `python -m gateway.cli ...` dan `python -m ml_worker.cli ...`.
12. Simulator hanya helper development; evidence skripsi memprioritaskan data hardware valid.

Milestone M0 tidak boleh dimulai tanpa persetujuan eksplisit user.

---

# M0 — Repository Foundation

## 10. Tujuan

Membuat repo baru yang bersih dan siap dikembangkan.

## 10.1 Tasks

1. Buat struktur folder utama.
2. Buat root `README.md`.
3. Buat root `.env.example`.
4. Buat `docker-compose.yml` untuk PostgreSQL.
5. Pastikan dokumen final tersedia di folder `Dokumentasi/`.
6. Buat folder `scripts/`.
7. Buat placeholder README per komponen.
8. Buat `.gitignore`.

## 10.2 Files Expected

```text
README.md
.env.example
.gitignore
docker-compose.yml
backend-go/README.md
frontend-dashboard/README.md
gateway-rpi/README.md
ml-worker/README.md
scripts/README.md
```

## 10.3 Root `.gitignore`

Harus mengabaikan:

```text
.env
.env.*
!.env.example
config.yaml
*.log
__pycache__/
.venv/
node_modules/
dist/
build/
uploads/
backups/
*.keras
*.h5
*.pkl
*.joblib
failed_payloads.jsonl
.DS_Store
```

## 10.4 Test / Verification

```bash
ls
find . -maxdepth 2 -type d
```

## 10.5 Definition of Done

```text
[ ] Struktur folder sesuai dokumen
[ ] README root tersedia
[ ] .env.example tersedia
[ ] docker-compose.yml tersedia
[ ] .gitignore tersedia
[ ] Tidak ada file rahasia yang di-commit
```

---

# M1 — Database Migrations and Seed

## 11. Tujuan

Membuat schema PostgreSQL final sesuai `04_Database_Design_Final.md`.

## 11.1 Tasks

1. Buat migration SQL di `backend-go/migrations/`.
2. Buat tabel:
   - `gateways`
   - `api_tokens`
   - `sensors`
   - `sensor_readings`
   - `gateway_status_logs`
   - `model_versions`
   - `prediction_runs`
   - `model_metrics`
   - `baseline_results`
   - `predictions`
   - `anomaly_events`
   - `notification_logs`
   - `layouts`
   - `layout_devices`
   - `settings`
   - `system_logs`
3. Buat index penting.
4. Buat reading dedupe key `(gateway_id, sensor_id, recorded_at)`.
5. Buat partial unique index untuk satu active model dan satu active layout.
6. Buat seed gateway dan sensor.
7. Buat seed settings.
8. Buat script migration runner jika diperlukan.

## 11.2 Files Expected

```text
backend-go/migrations/001_create_core_tables.sql
backend-go/migrations/002_create_sensor_tables.sql
backend-go/migrations/003_create_ml_tables.sql
backend-go/migrations/004_create_event_notification_tables.sql
backend-go/migrations/005_create_layout_settings_logs.sql
backend-go/migrations/006_seed_initial_data.sql
scripts/run-migrations.sh
scripts/seed.sh
scripts/run-migrations.ps1
scripts/seed.ps1
scripts/run-migrations-docker.ps1
scripts/seed-docker.ps1
```

## 11.3 Commands

```bash
docker compose up -d postgres
```

Untuk Windows development dengan PostgreSQL dari Docker Compose:

```powershell
./scripts/run-migrations-docker.ps1
```

Jika memakai psql manual:

```bash
psql "$DATABASE_URL" -f backend-go/migrations/001_create_core_tables.sql
psql "$DATABASE_URL" -f backend-go/migrations/002_create_sensor_tables.sql
psql "$DATABASE_URL" -f backend-go/migrations/003_create_ml_tables.sql
psql "$DATABASE_URL" -f backend-go/migrations/004_create_event_notification_tables.sql
psql "$DATABASE_URL" -f backend-go/migrations/005_create_layout_settings_logs.sql
psql "$DATABASE_URL" -f backend-go/migrations/006_seed_initial_data.sql
```

## 11.4 Verification Queries

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT * FROM gateways;
SELECT sensor_code, sensor_role, modbus_slave_id FROM sensors;
SELECT key, value FROM settings ORDER BY key;
```

## 11.5 Definition of Done

```text
[ ] PostgreSQL running
[ ] Semua tabel berhasil dibuat
[ ] Index dibuat
[ ] Seed gateway dibuat
[ ] Seed sensor S1/S2 dibuat
[ ] Seed settings dibuat
[ ] Migration dapat diulang dari database kosong
[ ] Tidak ada tabel PUE/energy/cooling
```

---

# M2 — Backend Core API

## 12. Tujuan

Membuat Go backend dasar yang dapat menerima readings dari gateway dan menyediakan API untuk dashboard.

## 12.1 Tasks

1. Inisialisasi Go module.
2. Buat config loader `.env`.
3. Buat database connection.
4. Buat standard response helper.
5. Buat middleware logging.
6. Buat middleware CORS.
7. Buat middleware gateway auth.
8. Buat middleware simple admin/internal token.
9. Buat endpoint `GET /api/v1/health`.
10. Buat endpoint `POST /api/v1/readings`.
11. Buat endpoint `POST /api/v1/gateway/status`.
12. Buat endpoint `GET /api/v1/readings/latest`.
13. Buat endpoint `GET /api/v1/readings/history`.
14. Buat endpoint `GET /api/v1/sensors`.
15. Buat endpoint `PUT /api/v1/sensors/{sensorCode}`.
16. Buat endpoint `GET /api/v1/dashboard/summary` minimal.
17. Buat SSE hub dan endpoint `GET /api/v1/events`.
18. Buat offline checker setiap 30 detik.

## 12.2 Files Expected

```text
backend-go/go.mod
backend-go/cmd/server/main.go
backend-go/internal/config/
backend-go/internal/database/
backend-go/internal/handler/
backend-go/internal/middleware/
backend-go/internal/model/
backend-go/internal/repository/
backend-go/internal/service/
backend-go/internal/sse/
backend-go/internal/validator/
backend-go/internal/logger/
backend-go/.env.example
backend-go/README.md
```

## 12.3 Build Commands

```bash
cd backend-go
go mod tidy
go build ./...
go run ./cmd/server
```

## 12.4 API Test Commands

Health:

```bash
curl http://localhost:8080/api/v1/health
```

Post readings valid:

```bash
curl -X POST http://localhost:8080/api/v1/readings \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "gateway_id":"raspi-gateway-01",
    "recorded_at":"2026-01-17T14:30:00+07:00",
    "source":"hardware",
    "readings":[
      {"sensor_code":"S1","sensor_role":"ambient","temperature":27.4,"humidity":63.2},
      {"sensor_code":"S2","sensor_role":"hotspot","temperature":30.8,"humidity":58.5}
    ]
  }'
```

Latest:

```bash
curl http://localhost:8080/api/v1/readings/latest
```

History:

```bash
curl "http://localhost:8080/api/v1/readings/history?sensor_code=S2&limit=50"
```

SSE:

```bash
curl -N http://localhost:8080/api/v1/events
```

## 12.5 Definition of Done

```text
[ ] Backend build sukses
[ ] Health endpoint sukses
[ ] POST readings tanpa token ditolak
[ ] POST readings token salah ditolak
[ ] POST readings valid tersimpan
[ ] Payload invalid return 422
[ ] Latest readings menampilkan S1/S2
[ ] History readings bisa filter sensor
[ ] Dashboard summary minimal berjalan
[ ] SSE endpoint berjalan
[ ] README backend berisi cara run dan contoh curl
```

---

# M3 — Gateway Diagnostic and Delivery

## 13. Tujuan

Membuat gateway Raspberry Pi hardware-first dengan diagnostic mode dan HTTP delivery ke backend.

## 13.1 Tasks

1. Buat Python package `gateway-rpi`.
2. Buat config loader YAML dan env override.
3. Buat model dataclass/pydantic.
4. Buat serial port diagnostic.
5. Buat raw Modbus register diagnostic.
6. Buat sensor diagnostic berdasarkan config.
7. Buat payload builder.
8. Buat HTTP sender ke backend.
9. Buat retry 1x.
10. Buat bounded buffer JSONL.
11. Buat replay buffer throttled.
12. Buat status reporter.
13. Kirim heartbeat setiap 60 detik.
14. Buat command `send-test`.
15. Buat command `run`.
16. Buat README setup Raspberry Pi.
17. Buat contoh systemd service.

## 13.2 Files Expected

```text
gateway-rpi/src/gateway/config.py
gateway-rpi/src/gateway/models.py
gateway-rpi/src/gateway/modbus_client.py
gateway-rpi/src/gateway/sensor_reader.py
gateway-rpi/src/gateway/validator.py
gateway-rpi/src/gateway/payload_builder.py
gateway-rpi/src/gateway/http_sender.py
gateway-rpi/src/gateway/buffer.py
gateway-rpi/src/gateway/diagnostics.py
gateway-rpi/src/gateway/status_reporter.py
gateway-rpi/src/gateway/logger.py
gateway-rpi/src/gateway/cli.py
gateway-rpi/config.example.yaml
gateway-rpi/.env.example
gateway-rpi/requirements.txt
gateway-rpi/README.md
gateway-rpi/systemd/ems-thermal-lstm-gateway.service.example
```

## 13.3 Local Setup Commands

```bash
cd gateway-rpi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.yaml config.yaml
```

## 13.4 Diagnostic Commands

```bash
python -m gateway.cli diagnose ports
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
python -m gateway.cli diagnose sensor --sensor-code S1
python -m gateway.cli send-test
python -m gateway.cli run
```

Command path dikunci dan tidak boleh diganti tanpa persetujuan user.
Variasi `--slave-id 2` dan `--sensor-code S2` tetap digunakan saat hardware verification untuk menguji sensor kedua.

## 13.5 Raspberry Pi Setup Commands

```bash
ssh <user>@<raspberry-pi-ip>
python3 --version
pip3 --version
ls /dev/ttyUSB*
sudo usermod -aG dialout $USER
```

Logout/login ulang setelah menambahkan group `dialout`.

## 13.6 Definition of Done

```text
[ ] Gateway dependencies install sukses
[ ] Config YAML terbaca
[ ] diagnose ports berjalan
[ ] diagnose raw tersedia
[ ] diagnose sensor tersedia
[ ] send-test bisa kirim payload ke backend
[ ] run loop tersedia
[ ] Retry dibatasi 1x
[ ] Buffer JSONL tersedia dan dibatasi
[ ] Gateway tidak crash jika backend offline
[ ] README gateway lengkap
```

Catatan: jika sensor fisik belum terbaca karena wiring/register belum pasti, milestone tetap boleh dianggap partial done jika diagnostic raw sudah tersedia dan error message jelas.

---

# M4 — Frontend Foundation and Dashboard Shell

## 14. Tujuan

Membuat frontend dashboard dasar dengan sidebar final dan koneksi API.

## 14.1 Tasks

1. Inisialisasi React + Vite + TypeScript.
2. Setup Tailwind.
3. Setup shadcn/ui.
4. Setup Chart.js.
5. Buat app layout.
6. Buat sidebar final 6 menu.
7. Buat topbar status.
8. Buat API client.
9. Buat SSE client.
10. Buat status badge.
11. Buat komponen loading/empty/error.
12. Buat halaman placeholder untuk semua menu.
13. Buat Dashboard page shell.

## 14.2 Files Expected

```text
frontend-dashboard/src/app/App.tsx
frontend-dashboard/src/components/layout/AppLayout.tsx
frontend-dashboard/src/components/layout/Sidebar.tsx
frontend-dashboard/src/components/layout/Topbar.tsx
frontend-dashboard/src/components/status/StatusBadge.tsx
frontend-dashboard/src/lib/api.ts
frontend-dashboard/src/lib/sse.ts
frontend-dashboard/src/lib/status.ts
frontend-dashboard/src/pages/DashboardPage.tsx
frontend-dashboard/src/pages/SensorsReadingsPage.tsx
frontend-dashboard/src/pages/PredictionLSTMPage.tsx
frontend-dashboard/src/pages/LayoutPage.tsx
frontend-dashboard/src/pages/EventsLogsPage.tsx
frontend-dashboard/src/pages/SettingsPage.tsx
frontend-dashboard/.env.example
frontend-dashboard/README.md
```

## 14.3 Commands

```bash
cd frontend-dashboard
npm install
npm run dev
npm run build
```

## 14.4 Definition of Done

```text
[ ] Frontend dev server berjalan
[ ] Frontend build sukses
[ ] Sidebar final tampil
[ ] Semua menu bisa dibuka
[ ] API base URL dari env
[ ] Tidak ada dummy data produksi permanen
[ ] Loading/empty/error component tersedia
```

---

# M5 — Sensors & Readings Realtime Dashboard

## 15. Tujuan

Menghubungkan backend data sensor ke dashboard secara nyata.

## 15.1 Tasks

1. Implement dashboard summary API client.
2. Implement latest readings card.
3. Implement history readings chart.
4. Implement temperature chart.
5. Implement humidity chart.
6. Implement Sensors & Readings page.
7. Implement filter sensor and date.
8. Implement readings table.
9. Implement SSE update for `reading.latest`.
10. Implement gateway/sensor status display.

## 15.2 API Used

```text
GET /api/v1/dashboard/summary
GET /api/v1/readings/latest
GET /api/v1/readings/history
GET /api/v1/sensors
GET /api/v1/events
```

## 15.3 Test Commands

1. Run backend.
2. Run frontend.
3. Insert readings with curl.
4. Confirm dashboard updates.
5. Confirm SSE update.

Example:

```bash
curl -X POST http://localhost:8080/api/v1/readings \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "gateway_id":"raspi-gateway-01",
    "recorded_at":"2026-01-17T14:30:00+07:00",
    "source":"hardware",
    "readings":[
      {"sensor_code":"S1","sensor_role":"ambient","temperature":27.4,"humidity":63.2},
      {"sensor_code":"S2","sensor_role":"hotspot","temperature":30.8,"humidity":58.5}
    ]
  }'
```

## 15.4 Definition of Done

```text
[ ] Dashboard menampilkan S1/S2 terbaru
[ ] Sensors & Readings menampilkan tabel history
[ ] Chart suhu tampil dari API
[ ] Chart kelembaban tampil dari API
[ ] Filter sensor bekerja
[ ] SSE reading.latest memperbarui data
[ ] Empty state aman
[ ] API error state aman
```

---

# M6 — ML Worker Training Pipeline

## 16. Tujuan

Membuat ML Worker yang dapat melatih LSTM dari data database dan menghasilkan artifact.

## 16.1 Tasks

1. Buat ML Worker config.
2. Buat database connector.
3. Buat dataset loader dari `sensor_readings`.
4. Buat merge S1/S2 by timestamp.
5. Buat resample 1 menit.
6. Buat missing value handling.
7. Buat invalid/outlier filtering.
8. Buat target shifting S2 t+5 menit.
9. Buat feature scaler.
10. Buat target scaler.
11. Buat window builder.
12. Buat chronological split.
13. Buat baseline persistence.
14. Buat baseline moving average.
15. Buat LSTM model.
16. Buat training script.
17. Buat evaluation metrics RMSE/MAE/MAPE.
18. Simpan artifact:
    - `model.keras`
    - `feature_scaler.pkl`
    - `target_scaler.pkl`
    - `model_metadata.json`
19. Simpan model version, metrics, baseline results ke database.

## 16.2 Files Expected

```text
ml-worker/src/ml_worker/config.py
ml-worker/src/ml_worker/db.py
ml-worker/src/ml_worker/dataset_loader.py
ml-worker/src/ml_worker/preprocessing.py
ml-worker/src/ml_worker/windowing.py
ml-worker/src/ml_worker/baseline.py
ml-worker/src/ml_worker/model.py
ml-worker/src/ml_worker/train.py
ml-worker/src/ml_worker/evaluate.py
ml-worker/src/ml_worker/writer.py
ml-worker/src/ml_worker/status.py
ml-worker/src/ml_worker/cli.py
ml-worker/requirements.txt
ml-worker/.env.example
ml-worker/README.md
ml-worker/models/.gitkeep
ml-worker/reports/.gitkeep
```

## 16.3 Commands

```bash
cd ml-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m ml_worker.cli train --start-at "2026-01-17T00:00:00+07:00" --end-at "2026-01-17T23:59:59+07:00"
```

## 16.4 Minimum Data Rule

Training development minimal:

```text
>= 300 data per sensor setelah resample lebih baik
```

Jika data kurang:

1. Jangan crash.
2. Simpan system log.
3. Tampilkan error jelas.
4. Jangan membuat model palsu.

## 16.5 Definition of Done

```text
[ ] ML Worker dapat connect database
[ ] Dataset S1/S2 berhasil diload
[ ] Data diresample ke 1 menit
[ ] Window terbentuk
[ ] Baseline metrics dihitung
[ ] LSTM training berjalan
[ ] Artifact model tersimpan
[ ] model_metadata.json tersimpan
[ ] model_versions tersimpan ke database
[ ] model_metrics tersimpan ke database
[ ] baseline_results tersimpan ke database
[ ] README ML berisi command training
```

---

# M7 — ML Inference and Prediction Integration

## 17. Tujuan

Menghubungkan model aktif dengan prediksi terbaru dan dashboard.

## 17.1 Tasks

1. Buat active model loader.
2. Load `model.keras`.
3. Load `feature_scaler.pkl`.
4. Load `target_scaler.pkl`.
5. Load latest sensor data dari DB.
6. Resample 1 menit.
7. Build latest 30-step window.
8. Predict future S2 temperature.
9. Inverse transform prediction.
10. Buat payload inference.
11. Insert `prediction_runs` inference.
12. Kirim hasil ke protected `POST /api/v1/ml/predictions`.
13. Backend menyusun final status, menyimpan prediction, membuat anomaly event jika perlu, mengirim SSE, dan menjalankan keputusan Telegram.
14. Expose prediction endpoints di backend jika belum.
15. Implement Prediction & LSTM page.
16. Implement model version list.
17. Implement activate model.
18. Implement actual vs predicted chart.

## 17.2 Commands

```bash
cd ml-worker
source .venv/bin/activate
python -m ml_worker.cli infer
```

Optional worker loop:

```bash
python -m ml_worker.cli infer --loop --interval-seconds 60
```

## 17.3 Backend Endpoints Used

```text
GET /api/v1/predictions/latest
GET /api/v1/predictions/history
GET /api/v1/model-versions
PUT /api/v1/model-versions/{id}/activate
GET /api/v1/model-metrics/latest
GET /api/v1/model-comparison/latest
POST /api/v1/ml/predictions
```

## 17.4 Definition of Done

```text
[ ] Inference dapat load model aktif
[ ] Inference menghasilkan prediksi suhu S2
[ ] Prediction tersimpan ke database
[ ] Backend menerima protected ML prediction payload
[ ] Status normal/waspada/anomali terbentuk
[ ] Prediction stale setelah 10 menit tidak menjadi status aktif atau Telegram trigger
[ ] Actual S2 matched dengan nearest reading tolerance +/-60 detik
[ ] Prediction latest API berjalan
[ ] Prediction history API berjalan
[ ] Model versions API berjalan
[ ] Activate model API berjalan
[ ] Prediction & LSTM page menampilkan prediksi dan metrics
[ ] Model not ready state aman
```

---

# M8 — Alert, Telegram, and Events Logs

## 18. Tujuan

Menerapkan alert rule, Telegram notification, anomaly events, notification logs, dan system logs.

## 18.1 Tasks

1. Implement status classification service.
2. Implement anomaly event creation.
3. Implement notification decision/cooldown.
4. Implement Telegram client.
5. Implement notification logs.
6. Implement test Telegram endpoint.
7. Implement anomaly events API.
8. Implement notification logs API.
9. Implement system logs API.
10. Implement Events & Logs page tabs.
11. Emit SSE `anomaly.created`.
12. Emit SSE `notification.sent`.
13. Emit SSE `system.log` if needed.

## 18.2 Alert Rules

```text
normal  : predicted_temperature_s2 < 30
waspada : 30 <= predicted_temperature_s2 <= 32
anomali : predicted_temperature_s2 > 32
trouble : sensor/gateway problem
```

Priority:

```text
trouble > anomali > waspada > normal
```

## 18.3 Telegram Rules

Send Telegram if:

```text
normal -> waspada
normal -> anomali
waspada -> anomali
sensor S2 trouble
gateway offline/trouble if detected
```

Do not spam:

```text
cooldown default 5 minutes
same status within cooldown = skipped
escalation still sent
```

## 18.4 API Test

```bash
curl http://localhost:8080/api/v1/anomaly-events
curl http://localhost:8080/api/v1/notification-logs
curl http://localhost:8080/api/v1/system-logs
curl -X POST http://localhost:8080/api/v1/notifications/test
```

## 18.5 Definition of Done

```text
[ ] Status classification sesuai threshold
[ ] Anomaly event tersimpan
[ ] Notification log tersimpan
[ ] Telegram disabled menghasilkan skipped aman
[ ] Telegram failed tidak crash
[ ] Events & Logs page tampil
[ ] Filter events/logs bekerja minimal berdasarkan status/source/level
[ ] SSE anomaly.created berjalan
```

---

# M9 — Layout Upload and Sensor Marker

## 19. Tujuan

Membuat fitur layout/denah sensor sesuai gambaran dashboard.

## 19.1 Tasks

1. Backend upload layout image.
2. Backend serve uploaded files.
3. Backend get active layout.
4. Backend update marker sensor.
5. Backend delete marker sensor.
6. Frontend Layout page.
7. Upload image UI.
8. Render layout image.
9. Render marker S1/S2.
10. Marker shows status, temperature, humidity.
11. Drag marker.
12. Save marker position as ratio 0–1.
13. Marker responsive to image size.

## 19.2 API Used

```text
GET /api/v1/layout
POST /api/v1/layout/image
PUT /api/v1/layout/devices/{sensorCode}
DELETE /api/v1/layout/devices/{sensorCode}
```

## 19.3 Definition of Done

```text
[ ] User dapat upload layout image
[ ] Layout image tampil kembali
[ ] Marker S1/S2 tampil
[ ] Marker bisa dipindahkan
[ ] Posisi marker tersimpan
[ ] Marker menampilkan status sensor
[ ] Marker menampilkan suhu/kelembaban terbaru
[ ] Layout page aman saat belum ada layout
```

---

# M10 — Final Integration, Testing, and Bab 4 Evidence

## 20. Tujuan

Mengintegrasikan seluruh sistem, menjalankan test plan, dan mengumpulkan bukti untuk Bab 4.

## 20.1 Tasks

1. Jalankan PostgreSQL.
2. Jalankan backend.
3. Jalankan frontend.
4. Jalankan gateway diagnostic.
5. Jalankan gateway send-test.
6. Jalankan gateway real/hardware mode jika sensor sudah siap.
7. Kumpulkan readings minimal.
8. Jalankan ML training.
9. Jalankan ML inference.
10. Uji dashboard prediction.
11. Uji alert events.
12. Uji Telegram disabled/skipped atau sent.
13. Uji layout upload dan marker.
14. Jalankan test plan.
15. Ambil screenshot untuk Bab 4.
16. Export hasil metrics.
17. Catat bug dan perbaikan.

## 20.2 Full Run Commands

PostgreSQL:

```bash
docker compose up -d postgres
```

Backend:

```bash
cd backend-go
go run ./cmd/server
```

Frontend:

```bash
cd frontend-dashboard
npm run dev
```

Gateway:

```bash
cd gateway-rpi
source .venv/bin/activate
python -m gateway.cli diagnose ports
python -m gateway.cli send-test
python -m gateway.cli run
```

ML Training:

```bash
cd ml-worker
source .venv/bin/activate
python -m ml_worker.cli train
```

ML Inference:

```bash
python -m ml_worker.cli infer
```

## 20.3 Evidence for Bab 4

Ambil bukti berikut:

```text
[ ] Screenshot dashboard utama
[ ] Screenshot Sensors & Readings
[ ] Screenshot Prediction & LSTM
[ ] Screenshot Layout marker
[ ] Screenshot Events & Logs
[ ] Screenshot Settings
[ ] Screenshot backend health response
[ ] Screenshot POST readings success
[ ] Screenshot database sensor_readings
[ ] Screenshot ML training output
[ ] Screenshot model artifacts
[ ] Screenshot metrics RMSE/MAE/MAPE
[ ] Screenshot prediction saved in database
[ ] Screenshot Telegram sent/skipped/failed log
[ ] Screenshot gateway diagnostic
[ ] Screenshot system logs
```

## 20.4 Final Definition of Done

```text
[ ] Semua komponen dapat dijalankan
[ ] Data sensor mengalir ke database
[ ] Dashboard menampilkan data API asli
[ ] SSE berjalan
[ ] ML Worker training menghasilkan artifact
[ ] ML Worker inference menghasilkan prediksi
[ ] Prediction tampil di dashboard
[ ] Status normal/waspada/anomali/trouble dapat diuji
[ ] Anomaly events tersimpan
[ ] Notification logs tersimpan
[ ] Layout sensor bekerja
[ ] Test plan memiliki hasil
[ ] README dan runbook lengkap
[ ] Tidak ada PUE atau kontrol pendingin
```

---

## 21. Prompt Awal untuk Codex

Gunakan prompt ini saat pertama kali memulai di Codex:

```text
You are working inside a new thesis project repository named ems-thermal-lstm.

This project is EMS Thermal LSTM, a hardware-first Environment Monitoring System for server testbed thermal anomaly prediction using LSTM.

Before coding, read all documents in Dokumentasi/:
- 00_Project_Direction_Final.md
- 01_System_Scope_and_Features_Final.md
- 02_Hardware_and_Gateway_Final.md
- 03_System_Architecture_Final.md
- 04_Database_Design_Final.md
- 05_Backend_API_Final.md
- 06_ML_Worker_LSTM_Final.md
- 07_Frontend_Dashboard_Final.md
- 08_Alert_and_Telegram_Final.md
- 09_Test_Plan_Final.md
- 10_Codex_Implementation_Runbook.md

Locked stack:
- Backend: Go REST API + SSE
- Database: PostgreSQL, TimescaleDB optional only
- Gateway: Python on Raspberry Pi 3, hardware-first, Modbus RTU RS485
- Sensors: XY-MD02 S1 ambient/reference and S2 hotspot/exhaust
- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui + Chart.js
- ML Worker: Python TensorFlow/Keras LSTM
- Notification: Telegram Bot API

Locked scope:
- Target prediction: S2 temperature 5 minutes ahead
- Raw sensor interval: 10 seconds
- ML resampling interval: 60 seconds
- LSTM window size: 30
- Baseline: persistence and moving average
- Metrics: RMSE, MAE, MAPE
- Status: normal, waspada, anomali, trouble

Do not implement:
- PUE
- energy optimization
- fan/AC/relay control
- auto remediation
- enterprise monitoring stack
- training on Raspberry Pi
- model replacement for LSTM as main model

Work by milestone from Dokumentasi/10_Codex_Implementation_Runbook.md.
Start with M0 Repository Foundation only after explicit user approval.
After each milestone, run relevant build/test commands and report:
1. files created/changed
2. commands run
3. results
4. next proposed milestone

Do not skip tests.
If any requirement is ambiguous, stop and ask.
```

---

## 22. Prompt untuk Melanjutkan Milestone

Setelah M0 selesai, gunakan pola prompt ini:

```text
Continue to milestone M1 from Dokumentasi/10_Codex_Implementation_Runbook.md.
Implement only the tasks in M1.
Do not start M2 yet.
After implementation, run the verification commands and summarize results.
```

Ulangi untuk M2, M3, dan seterusnya.

---

## 23. Prompt untuk Debugging

Jika ada error:

```text
Debug the current error without changing scope.
Use the Dokumentasi/ requirements as source of truth.
Explain the root cause, fix it, and rerun the failing command.
Do not refactor unrelated modules.
```

---

## 24. Prompt untuk Testing

```text
Run the relevant tests for the current milestone.
Use Dokumentasi/09_Test_Plan_Final.md as the test reference.
Report which test cases passed, failed, or were not run, with reasons.
Fix failures before moving to the next milestone.
```

---

## 25. Prompt untuk Bab 4 Evidence

```text
Prepare Bab 4 evidence for the implemented milestone.
List screenshots, command outputs, database queries, API responses, and test results that should be captured.
Do not write the thesis chapter yet; only prepare evidence checklist.
```

---

## 26. Risk Register

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Sensor XY-MD02 belum terbaca | Gateway hardware tertunda | Buat diagnostic mode raw register |
| RS485 A/B terbalik | Sensor tidak merespons | Error diagnostic harus memberi kemungkinan penyebab |
| Slave ID sensor tidak diketahui | Sensor tidak terbaca | Buat command scan/test slave ID manual |
| Register sensor berbeda | Nilai suhu/kelembaban salah | Register configurable via YAML |
| Data real belum cukup untuk LSTM | Training tidak stabil | Kumpulkan data lebih lama; jangan buat model palsu |
| Backend offline saat gateway jalan | Data hilang | Retry 1x + bounded buffer |
| Dashboard berat | UI lambat | Limit query history dan gunakan filter waktu |
| Telegram gagal | Alert tidak terkirim | Save failed log, backend tetap jalan |
| Codex melebar scope | Project berantakan | Ikuti Dokumentasi/ dan milestone |

---

## 27. Final Notes

Project ini harus dibuat sebagai **production-like thesis prototype**, bukan demo asal jalan.

Namun scope tetap dikunci agar selesai dan dapat diuji:

```text
Sensor asli → Gateway Raspberry Pi → Go Backend → PostgreSQL → React Dashboard → ML Worker LSTM → Prediction → Alert/Event → Telegram
```

Sistem dianggap berhasil jika alur utama tersebut berjalan, dapat diuji, dan buktinya dapat ditulis ke Bab 4 skripsi.
