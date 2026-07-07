# 07 Frontend Dashboard Final — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini menjelaskan rancangan final frontend dashboard untuk project **EMS Thermal LSTM**. Frontend digunakan sebagai antarmuka utama untuk monitoring sensor, prediksi LSTM, layout sensor, event/log, dan pengaturan sistem.

Dokumen ini menjadi pegangan Codex agar UI yang dibuat:

1. Sesuai sidebar final.
2. Mengambil data asli dari backend API.
3. Mendukung update realtime melalui SSE.
4. Menampilkan status normal, waspada, anomali, dan trouble secara jelas.
5. Mendukung kebutuhan Bab 4 Implementasi dan Pengujian.
6. Tidak melebar menjadi dashboard enterprise atau fitur di luar scope skripsi.

---

## 2. Stack Frontend

| Bagian | Teknologi |
|---|---|
| Framework | React |
| Build tool | Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI component | shadcn/ui |
| Chart | Chart.js |
| Realtime | Server-Sent Events |
| API | Go Backend REST API |
| State sederhana | React hooks / context |

Catatan:

1. Jangan memakai dummy data pada jalur production dashboard.
2. Dummy/mock data hanya boleh digunakan untuk story/dev component jika dipisahkan jelas.
3. Dashboard harus tetap aman ketika API belum memiliki data.

---

## 3. Sidebar Final

Sidebar final berisi 6 menu:

```text
Dashboard
Sensors & Readings
Prediction & LSTM
Layout
Events & Logs
Settings
```

Jangan membuat menu tambahan seperti:

```text
Sensor Management
Gateway Management
Model Versions
Model Evaluation
Notifications
System Logs
```

Fitur-fitur tersebut digabung ke menu yang sudah ditentukan.

---

## 4. Struktur Folder Frontend

```text
frontend-dashboard/
├── src/
│   ├── app/
│   │   └── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── dashboard/
│   │   │   ├── SensorStatusCard.tsx
│   │   │   ├── PredictionCard.tsx
│   │   │   ├── ThermalStatusCard.tsx
│   │   │   ├── MetricCard.tsx
│   │   │   └── RecentEventsTable.tsx
│   │   ├── charts/
│   │   │   ├── TemperatureChart.tsx
│   │   │   ├── HumidityChart.tsx
│   │   │   ├── ActualVsPredictionChart.tsx
│   │   │   └── ModelComparisonChart.tsx
│   │   ├── sensor-layout/
│   │   │   ├── SensorLayoutMap.tsx
│   │   │   ├── SensorMarker.tsx
│   │   │   └── LayoutEditor.tsx
│   │   ├── status/
│   │   │   ├── StatusBadge.tsx
│   │   │   └── ConnectionStatus.tsx
│   │   ├── tables/
│   │   └── ui/
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── SensorsReadingsPage.tsx
│   │   ├── PredictionLSTMPage.tsx
│   │   ├── LayoutPage.tsx
│   │   ├── EventsLogsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── hooks/
│   │   ├── useApi.ts
│   │   ├── useSSE.ts
│   │   └── usePolling.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── sse.ts
│   │   ├── status.ts
│   │   ├── format.ts
│   │   └── utils.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── sensor.ts
│   │   ├── prediction.ts
│   │   ├── layout.ts
│   │   └── settings.ts
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── components.json
├── .env.example
└── README.md
```

---

## 5. Environment Variables

`.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_SSE_URL=http://localhost:8080/api/v1/events
VITE_APP_NAME=EMS Thermal LSTM
```

Aturan:

1. Jangan hardcode API base URL langsung di component.
2. Semua request API harus lewat `lib/api.ts`.
3. Semua SSE connection harus lewat `lib/sse.ts` atau hook `useSSE`.
4. Jangan menyimpan `ADMIN_TOKEN` dalam variable `VITE_*` karena nilai tersebut akan masuk ke browser bundle. Untuk prototype lokal, admin token dimasukkan saat runtime dan disimpan hanya selama sesi browser.

---

## 6. Global Layout

Layout global:

```text
+---------------------------------------------------------------+
| Topbar: EMS Thermal LSTM | API | SSE | Gateway | Model | Time |
+-------------------+-------------------------------------------+
| Sidebar           | Main Content                              |
| Dashboard         | Page Header                               |
| Sensors & Readings| Cards / Charts / Tables / Forms           |
| Prediction & LSTM |                                           |
| Layout            |                                           |
| Events & Logs     |                                           |
| Settings          |                                           |
+-------------------+-------------------------------------------+
```

### 6.1 Topbar

Topbar menampilkan:

1. Nama sistem.
2. API status.
3. SSE status.
4. Gateway status.
5. Active model status.
6. Telegram status.
7. Last update timestamp.
8. Refresh button.

### 6.2 Sidebar

Sidebar harus:

1. Menampilkan 6 menu final.
2. Menandai active route.
3. Tetap rapi pada layar laptop.
4. Tidak perlu mobile-perfect pada milestone awal, tetapi jangan rusak di resolusi umum laptop.

---

## 7. Status Design

Status yang digunakan:

| Status | Makna | UI |
|---|---|---|
| normal | Kondisi aman | Badge hijau |
| waspada | Mendekati batas | Badge kuning/oranye |
| anomali | Melewati batas | Badge merah |
| trouble | Sensor/gateway/system error | Badge abu/merah gelap |
| inactive | Sensor tidak aktif | Badge abu |

Aturan:

1. Badge harus menampilkan teks status, bukan warna saja.
2. Gunakan helper `getStatusVariant(status)` di `lib/status.ts`.
3. Status `trouble` harus lebih prioritas dari status termal lain.
4. Gunakan `sensor_health_status`, `thermal_status`, dan assembled `final_status`.
5. Prediction stale setelah 10 menit tetap tampil di history, tetapi tidak boleh menjadi active dashboard status.

---

## 8. Page 1 — Dashboard

### 8.1 Tujuan

Halaman ringkasan kondisi EMS secara cepat.

### 8.2 Komponen Wajib

1. System status row.
2. S1 temperature card.
3. S1 humidity card.
4. S2 temperature card.
5. S2 humidity card.
6. Predicted S2 temperature card.
7. Thermal status card.
8. Latest model metric cards: RMSE, MAE, MAPE.
9. Temperature chart.
10. Humidity chart.
11. Actual vs prediction chart.
12. Layout preview.
13. Recent events table.

### 8.3 Data Source

| UI | Endpoint |
|---|---|
| Summary cards | `GET /dashboard/summary` |
| Temperature chart | `GET /readings/history` |
| Actual vs prediction | `GET /predictions/history` + readings history |
| Layout preview | `GET /layout` |
| Realtime update | `GET /events` SSE |

### 8.4 Dashboard State

| Kondisi | UI |
|---|---|
| Data belum ada | Empty state: “Data sensor belum tersedia” |
| Model belum ada | Warning: “Model LSTM belum tersedia” |
| Gateway offline | Badge gateway offline/trouble |
| SSE disconnected | Badge SSE disconnected, data tetap bisa refresh manual |
| API error | Alert error |

### 8.5 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| FE-DASH-001 | Dashboard tampil tanpa error |
| FE-DASH-002 | Card sensor mengambil data dari API |
| FE-DASH-003 | Prediksi tampil jika tersedia |
| FE-DASH-004 | Model not ready state tampil jika belum ada model |
| FE-DASH-005 | Chart aman saat data kosong |
| FE-DASH-006 | SSE update memperbarui data terbaru |
| FE-DASH-007 | Recent events tampil dari API |

---

## 9. Page 2 — Sensors & Readings

### 9.1 Tujuan

Menampilkan data sensor realtime, historis, dan metadata sensor.

### 9.2 Komponen Wajib

1. Sensor summary cards S1/S2.
2. Sensor metadata table.
3. Reading history filter.
4. Temperature history chart.
5. Humidity history chart.
6. Readings table.
7. Sensor detail/edit dialog.
8. Refresh button.

### 9.3 Filter

| Filter | Tipe |
|---|---|
| Sensor | Select: All, S1, S2 |
| From | datetime input |
| To | datetime input |
| Quality | Select: all, valid, invalid, timeout, simulated |
| Limit | Select/input |

### 9.4 Sensor Edit Field

Field yang boleh diedit:

1. Name.
2. Location.
3. Modbus slave ID.
4. Status jika diperlukan.

Field yang tidak boleh diedit sembarangan:

1. sensor_code.
2. sensor_role.
3. type, kecuali memang dibutuhkan.

### 9.5 Endpoint

1. `GET /sensors`
2. `PUT /sensors/{sensorCode}`
3. `GET /readings/latest`
4. `GET /readings/history`

### 9.6 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| FE-SR-001 | S1 dan S2 tampil |
| FE-SR-002 | Sensor metadata tampil |
| FE-SR-003 | Filter history bekerja |
| FE-SR-004 | Chart sesuai data history |
| FE-SR-005 | Edit sensor metadata berjalan |
| FE-SR-006 | Empty/error state tersedia |

---

## 10. Page 3 — Prediction & LSTM

### 10.1 Tujuan

Menampilkan prediksi LSTM, model version, evaluasi model, dan baseline comparison dalam satu halaman.

### 10.2 Komponen Wajib

1. Latest prediction card.
2. Prediction status card.
3. Active model card.
4. Metrics cards: RMSE, MAE, MAPE.
5. Actual vs predicted chart.
6. Prediction history table.
7. Model versions table.
8. Activate model button.
9. Model comparison chart/table.
10. Dataset/training summary.
11. Model not ready state.

### 10.3 Model Version Table Columns

```text
Version
Model Type
Window
Horizon
RMSE
MAE
MAPE
Trained At
Active
Action
```

### 10.4 Prediction History Columns

```text
Created At
Predicted For
Predicted Temperature
Actual Temperature
Status
Model Version
```

### 10.5 Endpoint

1. `GET /predictions/latest`
2. `GET /predictions/history`
3. `GET /model-versions`
4. `PUT /model-versions/{id}/activate`
5. `GET /model-metrics/latest`
6. `GET /model-comparison/latest`

### 10.6 Training UI Rule

Training lewat UI tidak wajib pada versi awal. Training utama dilakukan melalui CLI ML Worker.

Jika Codex membuat tombol training, tombol tersebut harus:

1. Tidak blocking UI.
2. Tidak pura-pura training.
3. Tidak dibuat sebelum backend/worker mendukung job status.

Default keputusan: **jangan buat training trigger UI dulu**.

### 10.7 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| FE-ML-001 | Latest prediction tampil |
| FE-ML-002 | Model not ready state tampil |
| FE-ML-003 | Metrics tampil dari API |
| FE-ML-004 | Model versions tampil |
| FE-ML-005 | Activate model button bekerja |
| FE-ML-006 | Baseline comparison tampil |
| FE-ML-007 | Prediction chart aman saat data kosong |

---

## 11. Page 4 — Layout

### 11.1 Tujuan

Menampilkan denah/layout testbed dan posisi sensor S1/S2.

### 11.2 Komponen Wajib

1. Upload layout image.
2. Display layout image.
3. Sensor marker S1.
4. Sensor marker S2.
5. Drag marker.
6. Save marker position.
7. Marker status badge.
8. Marker tooltip/detail.
9. Empty state jika layout belum ada.

### 11.3 Marker Data

Marker menampilkan:

1. Sensor code.
2. Sensor role.
3. Temperature.
4. Humidity.
5. Status.
6. Last seen.

### 11.4 Position Rule

Marker position disimpan sebagai rasio:

```text
position_x: 0 sampai 1
position_y: 0 sampai 1
```

Frontend mengubah rasio menjadi pixel berdasarkan ukuran gambar saat render.

### 11.5 Endpoint

1. `GET /layout`
2. `POST /layout/image`
3. `PUT /layout/devices/{sensorCode}`
4. `DELETE /layout/devices/{sensorCode}`

### 11.6 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| FE-LAY-001 | Upload layout berhasil |
| FE-LAY-002 | Layout tampil setelah upload |
| FE-LAY-003 | Marker S1/S2 tampil |
| FE-LAY-004 | Marker dapat dipindah |
| FE-LAY-005 | Posisi marker tersimpan |
| FE-LAY-006 | Marker menampilkan status dan data sensor |
| FE-LAY-007 | Layout aman jika gambar belum tersedia |

---

## 12. Page 5 — Events & Logs

### 12.1 Tujuan

Menampilkan status events, notification logs, dan system logs.

### 12.2 Tab Final

```text
Status Events
Notifications
System Logs
```

### 12.3 Status Events Table Columns

```text
Detected At
Sensor
Status
Severity
Predicted Temperature
Actual Temperature
Description
```

### 12.4 Notification Logs Table Columns

```text
Created At
Channel
Recipient
Status
Message
Error Message
```

### 12.5 System Logs Table Columns

```text
Created At
Source
Level
Message
Context
```

### 12.6 Filters

1. Status.
2. Level.
3. Source.
4. From.
5. To.
6. Limit.

### 12.7 Endpoint

1. `GET /anomaly-events`
2. `GET /notification-logs`
3. `GET /system-logs`

### 12.8 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| FE-EV-001 | Semua tab tampil |
| FE-EV-002 | Status events tampil |
| FE-EV-003 | Notification logs tampil |
| FE-EV-004 | System logs tampil |
| FE-EV-005 | Filter dasar bekerja |
| FE-EV-006 | Empty state tersedia |

---

## 13. Page 6 — Settings

### 13.1 Tujuan

Mengatur konfigurasi dasar sistem.

### 13.2 Section Final

1. Gateway Settings.
2. Telegram Settings.
3. Thermal Threshold Settings.
4. ML Parameter Info.
5. Application Info.

### 13.3 Gateway Settings

Tampilkan:

1. Gateway code.
2. Gateway name.
3. Status.
4. Last seen.
5. Expected interval.
6. Token masked.

### 13.4 Telegram Settings

Field:

1. Telegram enabled.
2. Bot token.
3. Chat ID.
4. Cooldown minutes.
5. Test Telegram button.

Sensitive value harus disamarkan setelah tersimpan.

Sensitive write endpoint memakai simple admin/internal token. Full gateway token dan Telegram token tidak boleh ditampilkan kembali oleh UI.

### 13.5 Thermal Threshold Settings

Field:

1. threshold_normal_max.
2. threshold_anomaly_min.
3. sensor_timeout_minutes.

Validasi:

```text
threshold_normal_max < threshold_anomaly_min
```

### 13.6 ML Parameter Info

Read-only atau editable terbatas:

1. raw_sampling_interval_seconds = 10.
2. ml_resample_interval_seconds = 60.
3. lstm_window_size = 30.
4. prediction_horizon_minutes = 5.
5. target_sensor = S2.

### 13.7 Endpoint

1. `GET /settings`
2. `PUT /settings/{key}`
3. `POST /notifications/test`
4. `GET /gateways`

### 13.8 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| FE-SET-001 | Settings tampil dari API |
| FE-SET-002 | Sensitive value masked |
| FE-SET-003 | Threshold dapat disimpan |
| FE-SET-004 | Telegram dapat enable/disable |
| FE-SET-005 | Test Telegram berjalan atau skipped aman |
| FE-SET-006 | Error save ditampilkan jelas |

---

## 14. API Client Rules

Semua request harus melalui `lib/api.ts`.

Minimal function:

```text
getDashboardSummary()
getSensors()
updateSensor(sensorCode, payload)
getLatestReadings()
getReadingHistory(params)
getLatestPrediction()
getPredictionHistory(params)
getModelVersions()
activateModel(id)
getModelMetricsLatest()
getModelComparisonLatest()
getLayout()
uploadLayoutImage(file, name)
updateLayoutDevice(sensorCode, payload)
getAnomalyEvents(params)
getNotificationLogs(params)
getSystemLogs(params)
getSettings()
updateSetting(key, value)
testTelegram()
```

Aturan:

1. Gunakan typed response.
2. Handle non-2xx response.
3. Jangan duplicate fetch logic di setiap page.
4. Error message dari backend harus bisa ditampilkan.

---

## 15. SSE Client Rules

SSE connection dibuat melalui `lib/sse.ts` atau `useSSE`.

Event yang ditangani:

1. `reading.latest`.
2. `gateway.status`.
3. `sensor.trouble`.
4. `prediction.latest`.
5. `anomaly.created`.
6. `notification.sent`.
7. `system.log`.

Aturan:

1. SSE disconnected tidak boleh membuat UI crash.
2. Tampilkan status SSE di topbar.
3. Reconnect otomatis boleh dibuat.
4. Jika reconnect gagal, user tetap bisa refresh manual.

---

## 16. Chart Rules

Chart menggunakan Chart.js.

Chart wajib:

1. Temperature chart S1/S2.
2. Humidity chart S1/S2.
3. Actual S2 vs predicted S2.
4. Model comparison chart atau table.

Aturan:

1. Chart harus aman saat data kosong.
2. Chart tidak boleh mengambil data terlalu besar tanpa limit.
3. Sumbu waktu harus mudah dibaca.
4. Tooltip menampilkan waktu dan nilai.
5. Threshold 30°C dan 32°C boleh ditampilkan di actual vs prediction chart jika mudah.

---

## 17. Loading, Empty, Error State

Setiap page harus punya state berikut:

| State | UI |
|---|---|
| Loading | Skeleton/spinner |
| Empty | Pesan data belum tersedia |
| Error | Alert error dan tombol retry |
| Stale | Badge stale/warning jika data lama |
| Disconnected | Badge SSE/API disconnected |

Jangan biarkan halaman blank tanpa pesan.

---

## 18. UI Component Guidelines

Gunakan shadcn/ui untuk:

1. Card.
2. Badge.
3. Button.
4. Table.
5. Tabs.
6. Dialog.
7. Select.
8. Input.
9. Alert.
10. Tooltip.
11. Skeleton.
12. Toast.

UI harus bersih dan cocok untuk presentasi skripsi. Hindari animasi berlebihan.

---

## 19. Data Types Minimal

### 19.1 Sensor

```ts
export type SensorHealthStatus = 'normal' | 'trouble' | 'inactive';
export type ThermalStatus = 'normal' | 'waspada' | 'anomali';
export type FinalStatus = ThermalStatus | 'trouble';

export interface Sensor {
  sensor_code: 'S1' | 'S2';
  sensor_role: 'ambient' | 'hotspot';
  name: string;
  type: string;
  location?: string;
  modbus_slave_id?: number;
  sensor_health_status: SensorHealthStatus;
  last_seen_at?: string;
}
```

### 19.2 Reading

```ts
export interface SensorReading {
  sensor_code: 'S1' | 'S2';
  sensor_role: 'ambient' | 'hotspot';
  temperature: number;
  humidity: number;
  quality_status: string;
  source: string;
  recorded_at: string;
}
```

### 19.3 Prediction

```ts
export interface Prediction {
  id: number;
  model_version: string;
  target_sensor: 'S2';
  predicted_temperature: number;
  actual_temperature?: number | null;
  predicted_for: string;
  thermal_status: ThermalStatus;
  final_status: FinalStatus;
  threshold_normal_max: number;
  threshold_anomaly_min: number;
  is_stale: boolean;
  created_at: string;
}
```

---

## 20. Frontend Testing Checklist

```text
[ ] npm install berhasil
[ ] npm run dev berhasil
[ ] npm run build berhasil
[ ] Sidebar 6 menu tampil
[ ] Dashboard mengambil data dari API
[ ] Sensors & Readings filter berjalan
[ ] Prediction & LSTM model not ready state berjalan
[ ] Layout upload tampil
[ ] Marker layout bisa disimpan
[ ] Events & Logs tab berjalan
[ ] Settings dapat load dan save
[ ] SSE connected/disconnected state tampil
[ ] API error tidak membuat UI crash
```

---

## 21. Anti-Scope Creep

Frontend tidak boleh membuat:

1. PUE dashboard.
2. Energy efficiency page.
3. Fan/AC/relay control page.
4. Enterprise multi-site dashboard.
5. User role management kompleks.
6. Mobile app terpisah.
7. Gateway web admin besar sebelum fitur wajib selesai.
8. Training UI palsu tanpa backend/worker support.

---

## 22. Frontend Acceptance Criteria Final

| Kode | Kriteria |
|---|---|
| FE-FINAL-001 | Frontend build tanpa error |
| FE-FINAL-002 | Sidebar final 6 menu tersedia |
| FE-FINAL-003 | Semua halaman utama dapat dibuka |
| FE-FINAL-004 | Dashboard memakai data API |
| FE-FINAL-005 | SSE update berjalan atau graceful disconnected |
| FE-FINAL-006 | Sensor readings chart dan table tampil |
| FE-FINAL-007 | Prediction & LSTM menampilkan model/prediksi/metrics |
| FE-FINAL-008 | Layout upload dan marker berjalan |
| FE-FINAL-009 | Events & Logs menampilkan data dari API |
| FE-FINAL-010 | Settings dapat load dan update |
| FE-FINAL-011 | Loading/empty/error state tersedia |
| FE-FINAL-012 | Tidak ada dummy data pada jalur produksi |

---

## 23. Instruksi untuk Codex

Saat membuat frontend, Codex harus:

1. Mengikuti sidebar final 6 menu.
2. Menggunakan TypeScript type untuk data API.
3. Membuat API client terpusat.
4. Membuat SSE client terpusat.
5. Tidak membuat dummy data sebagai jalur utama.
6. Menambahkan loading, empty, dan error state.
7. Menggunakan shadcn/ui secara konsisten.
8. Menggunakan Chart.js untuk grafik.
9. Menjaga UI bersih dan presentable untuk skripsi.
10. Menjalankan `npm run build` sebelum milestone frontend dianggap selesai.
## Alert Category Documentation Lock Addendum

Monitoring bottom sheet menampilkan ringkasan `Alarm`, `Pre-Alarm`, dan `Trouble`. Alarm/Trouble memakai event backend, sedangkan Pre-Alarm memakai prediksi masa depan aktif. Kategori tabel diturunkan dari `event_type`, bukan ditebak dari `status`. Recovery ditampilkan untuk event berstatus `normal` setelah kondisi non-normal.

Counter Pre-Alarm menunjukkan kondisi aktif 0/1 dari prediksi masa depan, bukan jumlah event prediksi dalam histori.

Bottom sheet hanya menampilkan satu baris Pre-Alarm aktif dari `active_pre_alarm`. Histori `prediction_threshold` tidak dicampur ke tabel bottom sheet dan tetap tersedia pada halaman Events & Logs serta Prediction & LSTM. Baris aktif hilang otomatis setelah waktu `predicted_for` terlewati.

Alarm dan Trouble pada bottom sheet berasal dari `active_events`. Event Recovery/normal dan event lama yang sudah pulih tidak ditampilkan di bottom sheet, tetapi tetap tersedia pada Events & Logs sebagai histori audit.

Semua tampilan status perangkat (Dashboard, Sensors & Readings, Layout card, dan marker map) memakai aturan yang sama: trouble hanya untuk health perangkat, sedangkan waspada/anomali berasal dari suhu aktual. Pre-Alarm ditampilkan terpisah dan tidak mengubah warna marker.

Color code status berlaku konsisten di seluruh halaman: normal/recovery hijau, waspada kuning, anomali merah, dan trouble oranye. Tabel Events & Logs memakai tint baris yang sama selain badge teks.
