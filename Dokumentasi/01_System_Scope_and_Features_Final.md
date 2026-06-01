# 01 System Scope and Features Final — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini merinci scope fitur final untuk project **EMS Thermal LSTM**. Dokumen ini menjadi pegangan Codex agar implementasi dashboard, backend, gateway, database, dan ML Worker tidak melebar dari kebutuhan skripsi.

Dokumen ini menjawab:

1. Fitur apa saja yang wajib dibuat.
2. Fitur apa saja yang boleh dibuat jika waktu mencukupi.
3. Fitur apa saja yang tidak boleh dibuat.
4. Isi setiap menu dashboard.
5. Prioritas implementasi fitur.
6. Acceptance criteria setiap modul.
7. Batas kualitas minimal agar sistem layak dipakai untuk Bab 4.

---

## 2. Prinsip Scope Final

Project ini harus mengikuti prinsip berikut:

1. **Hardware-first**  
   Sistem diarahkan untuk membaca sensor asli melalui Raspberry Pi, bukan sekadar simulasi.

2. **Thesis-ready engineering prototype**  
   Sistem harus rapi, dapat diuji, dan mudah dijelaskan pada Bab 4 Implementasi dan Pengujian.

3. **Production-like, not toy demo**  
   Sistem harus memiliki struktur, validasi, logging, konfigurasi, error handling, migration, dan dokumentasi yang jelas.

4. **Scope locked**  
   Codex tidak boleh menambahkan fitur besar di luar dokumen final.

5. **ML tetap fokus ke prediksi suhu S2**  
   LSTM digunakan untuk prediksi suhu S2 5 menit ke depan, bukan untuk PUE, optimasi energi, atau kontrol pendingin.

6. **Dashboard harus mengambil data asli dari backend**  
   Tidak boleh ada hardcoded dummy data pada jalur produksi dashboard.

7. **Gateway tetap ringan**  
   Raspberry Pi hanya bertugas membaca sensor dan mengirim data. Training LSTM tidak dilakukan di Raspberry Pi.

---

## 2.1 Documentation Lock Decisions

Keputusan berikut mengikat implementasi dan mengesampingkan contoh lama yang tidak konsisten:

1. Dokumentasi canonical berada di `Dokumentasi/`.
2. ML Worker membaca PostgreSQL langsung untuk input, tetapi hasil inference final dikirim ke backend melalui `POST /api/v1/ml/predictions`.
3. Backend memiliki final status classification, anomaly event creation, SSE event, dan Telegram notification.
4. Status dipisahkan menjadi `sensor_health_status`, `thermal_status`, dan `final_status`.
5. Sensitive write endpoint memakai simple admin/internal token.
6. Gateway heartbeat dikirim setiap 60 detik. Backend offline checker berjalan setiap 30 detik.
7. Sensor atau gateway menjadi trouble jika tidak ada data lebih dari 5 menit.
8. Prediction stale setelah 10 menit dan tidak boleh memicu active dashboard status atau Telegram.
9. Simulator hanya helper development. Evidence skripsi memprioritaskan `source = 'hardware'` dan `quality_status = 'valid'`.

---

## 3. Struktur Sidebar Final

Sidebar dashboard final:

```text
Dashboard
Sensors & Readings
Prediction & LSTM
Layout
Events & Logs
Settings
```

Struktur ini sudah final. Jangan membuat sidebar terlalu banyak seperti menu terpisah untuk sensor management, model version, model evaluation, notification, dan gateway management. Semua fitur tersebut digabung ke menu yang relevan.

---

## 4. Modul Utama Sistem

Sistem terdiri dari modul berikut:

| Modul | Komponen | Fungsi Utama |
|---|---|---|
| EMS Backend | Go | API, validasi, database access, SSE, alert, settings |
| EMS Dashboard | React + TypeScript | UI monitoring, grafik, layout, prediksi, events, settings |
| Database | PostgreSQL | Menyimpan sensor, readings, predictions, events, metrics, settings |
| Gateway | Python di Raspberry Pi | Membaca sensor XY-MD02 dan mengirim data ke EMS |
| ML Worker | Python | Training, preprocessing, evaluation, inference LSTM |
| Telegram | Bot API | Notifikasi kondisi waspada, anomali, dan trouble |

---

## 5. Menu 1 — Dashboard

### 5.1 Tujuan

Dashboard adalah halaman ringkasan utama yang menampilkan kondisi sistem secara cepat.

### 5.2 Fitur Wajib

Dashboard wajib menampilkan:

1. Status koneksi backend/API.
2. Status SSE realtime.
3. Status gateway terakhir.
4. Sensor health status S1 dan S2.
5. Status model aktif.
6. Status Telegram enabled/disabled.
7. Card suhu S1.
8. Card kelembaban S1.
9. Card suhu S2.
10. Card kelembaban S2.
11. Card prediksi suhu S2 5 menit ke depan.
12. Card status termal final.
13. Grafik suhu S1 dan S2.
14. Grafik kelembaban S1 dan S2.
15. Grafik actual S2 vs predicted S2.
16. Preview layout sensor.
17. Tabel recent anomaly/events.
18. Last update timestamp.

### 5.3 Data Source

Dashboard mengambil data dari:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/readings/history`
- `GET /api/v1/predictions/history`
- `GET /api/v1/layout`
- `GET /api/v1/events` untuk SSE

### 5.4 UI State

Dashboard harus menangani:

| State | Perilaku UI |
|---|---|
| Loading | Tampilkan skeleton/loading indicator |
| Empty data | Tampilkan pesan data belum tersedia |
| API error | Tampilkan alert error tanpa crash |
| SSE disconnected | Tampilkan status disconnected dan tetap gunakan polling/manual refresh |
| Model not ready | Tampilkan warning bahwa prediksi belum tersedia |
| Gateway offline | Tampilkan status offline/trouble |

### 5.5 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| DASH-001 | Dashboard dapat dibuka tanpa error |
| DASH-002 | Dashboard mengambil data dari API, bukan dummy static |
| DASH-003 | Card S1 dan S2 menampilkan data terbaru |
| DASH-004 | Prediksi S2 tampil jika model aktif tersedia |
| DASH-005 | Status normal/waspada/anomali/trouble tampil jelas |
| DASH-006 | Grafik suhu dan kelembaban tampil dari data historis |
| DASH-007 | Recent events tampil dari database |
| DASH-008 | Dashboard tetap aman saat data kosong |

---

## 6. Menu 2 — Sensors & Readings

### 6.1 Tujuan

Halaman ini menggabungkan monitoring data sensor, histori readings, dan manajemen sensor.

### 6.2 Fitur Wajib

Halaman Sensors & Readings wajib memiliki:

1. Ringkasan sensor S1.
2. Ringkasan sensor S2.
3. Sensor health status: normal, trouble, inactive.
4. Last seen tiap sensor.
5. Sensor code.
6. Sensor role.
7. Sensor name.
8. Modbus slave ID.
9. Tabel sensor readings.
10. Filter sensor: All, S1, S2.
11. Filter waktu: from dan to.
12. Filter quality status.
13. Grafik suhu berdasarkan filter.
14. Grafik kelembaban berdasarkan filter.
15. Detail reading.
16. Tombol refresh.

### 6.3 Fitur Sensor Management

Sensor management tetap berada dalam halaman ini, bukan sidebar terpisah.

Field sensor:

| Field | Keterangan |
|---|---|
| sensor_code | S1 atau S2 |
| sensor_role | ambient atau hotspot |
| name | Nama sensor |
| type | XY-MD02 |
| modbus_slave_id | Alamat slave Modbus |
| location | Deskripsi lokasi fisik |
| sensor_health_status | Status kesehatan sensor: normal, trouble, inactive |
| last_seen_at | Waktu data terakhir diterima |

### 6.4 Batasan

Untuk versi awal, dashboard boleh hanya mengedit field berikut:

1. Sensor name.
2. Location.
3. Modbus slave ID.
4. Status inactive/active jika diperlukan.

Dashboard tidak perlu mengubah register Modbus langsung. Register Modbus utama tetap dikonfigurasi pada gateway config.

### 6.5 Data Source

- `GET /api/v1/sensors`
- `PUT /api/v1/sensors/{sensorCode}`
- `GET /api/v1/readings/latest`
- `GET /api/v1/readings/history`

### 6.6 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| SR-001 | Halaman menampilkan daftar S1 dan S2 |
| SR-002 | Halaman menampilkan data reading terbaru |
| SR-003 | Tabel history dapat difilter berdasarkan sensor |
| SR-004 | Tabel history dapat difilter berdasarkan waktu |
| SR-005 | Grafik suhu dan kelembaban sesuai filter |
| SR-006 | Last seen sensor diperbarui saat data baru masuk |
| SR-007 | Sensor trouble terlihat jelas |
| SR-008 | Data kosong tidak membuat halaman crash |

---

## 7. Menu 3 — Prediction & LSTM

### 7.1 Tujuan

Halaman ini menggabungkan prediksi, model version, evaluasi model, baseline comparison, dan ringkasan training.

### 7.2 Fitur Wajib

Halaman Prediction & LSTM wajib memiliki:

1. Latest prediction card.
2. Prediction status card.
3. Active model card.
4. Model version list.
5. Tombol activate model.
6. Prediction history table.
7. Actual vs predicted chart.
8. RMSE, MAE, MAPE.
9. Baseline comparison.
10. Training dataset summary.
11. Model metadata display.
12. Model artifact path display.
13. Model not ready state.

### 7.3 Training Strategy

Training utama dilakukan melalui CLI/script ML Worker.

Dashboard versi awal **tidak wajib** menjalankan training secara langsung karena training adalah long-running process dan membutuhkan job management.

Dashboard cukup menampilkan hasil training yang sudah disimpan oleh ML Worker.

### 7.4 Model Activation

Dashboard boleh menyediakan fitur **Activate Model**.

Aturan:

1. Hanya satu model yang boleh aktif.
2. Inference menggunakan model aktif.
3. Model aktif ditandai di database.
4. Aktivasi model tidak menghapus model lama.
5. Model lama tetap dapat dilihat untuk histori.

### 7.5 Model Artifact

Setiap model version minimal memiliki:

```text
model.keras
feature_scaler.pkl
target_scaler.pkl
model_metadata.json
```

### 7.6 Model Metrics

Metrik wajib:

| Metric | Fungsi |
|---|---|
| RMSE | Mengukur akar rata-rata error kuadrat |
| MAE | Mengukur rata-rata error absolut |
| MAPE | Mengukur error persentase |

Baseline wajib:

1. Persistence model.
2. Moving average.

### 7.7 Data Source

- `GET /api/v1/predictions/latest`
- `GET /api/v1/predictions/history`
- `GET /api/v1/model-versions`
- `PUT /api/v1/model-versions/{id}/activate`
- `GET /api/v1/model-metrics/latest`
- `GET /api/v1/model-comparison/latest`

### 7.8 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| MLUI-001 | Latest prediction tampil jika tersedia |
| MLUI-002 | Model not ready tampil jika belum ada model aktif |
| MLUI-003 | Daftar model version tampil dari database |
| MLUI-004 | User dapat mengaktifkan salah satu model |
| MLUI-005 | Metrics RMSE, MAE, MAPE tampil |
| MLUI-006 | Baseline comparison tampil |
| MLUI-007 | Actual vs predicted chart tampil |
| MLUI-008 | UI tetap aman jika ML Worker belum pernah training |

---

## 8. Menu 4 — Layout

### 8.1 Tujuan

Halaman Layout digunakan untuk menampilkan posisi sensor pada gambar denah atau layout testbed.

### 8.2 Fitur Wajib

Halaman Layout wajib memiliki:

1. Upload layout image.
2. Menampilkan layout aktif.
3. Menampilkan marker S1.
4. Menampilkan marker S2.
5. Marker memiliki posisi x/y relatif terhadap gambar.
6. Marker menampilkan status sensor.
7. Marker menampilkan suhu/kelembaban terbaru.
8. Marker dapat dipindahkan dengan drag.
9. Posisi marker dapat disimpan.
10. Marker berubah warna/status sesuai kondisi.

### 8.3 Status Marker

| Status | Tampilan |
|---|---|
| normal | Marker normal |
| waspada | Marker warning |
| anomali | Marker critical |
| trouble | Marker error/trouble |
| inactive | Marker inactive |

Marker harus menampilkan teks status, tidak hanya warna.

### 8.4 Batasan

1. Layout cukup mendukung satu layout aktif.
2. Tidak perlu multi-site kompleks.
3. Tidak perlu floor management enterprise.
4. Tidak perlu map geografis.
5. Tidak perlu upload banyak layer.

### 8.5 Data Source

- `GET /api/v1/layout`
- `POST /api/v1/layout/image`
- `PUT /api/v1/layout/devices/{sensorCode}`
- `DELETE /api/v1/layout/devices/{sensorCode}`

### 8.6 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| LAY-001 | User dapat upload gambar layout |
| LAY-002 | Gambar layout tersimpan dan tampil kembali |
| LAY-003 | Marker S1 dan S2 dapat ditampilkan |
| LAY-004 | Marker dapat dipindahkan |
| LAY-005 | Posisi marker tersimpan di database |
| LAY-006 | Marker menampilkan status sensor |
| LAY-007 | Marker tetap proporsional saat ukuran layar berubah |

---

## 9. Menu 5 — Events & Logs

### 9.1 Tujuan

Halaman ini menggabungkan anomaly events, notification history, dan system logs.

### 9.2 Struktur Tab

Gunakan tab agar halaman tidak terlalu penuh:

```text
[Anomaly Events] [Notifications] [System Logs]
```

### 9.3 Anomaly Events

Fitur:

1. Tabel anomaly events.
2. Filter final status: normal, waspada, anomali, trouble.
3. Filter waktu.
4. Detail event.
5. Predicted temperature.
6. Actual temperature jika tersedia.
7. Sensor terkait.
8. Threshold yang digunakan.

Event yang disimpan:

- Waspada.
- Anomali.
- Recovery normal jika diaktifkan.
- Trouble sensor/gateway jika relevan.

### 9.4 Notifications

Fitur:

1. Riwayat notifikasi Telegram.
2. Status sent, failed, skipped, pending.
3. Waktu pengiriman.
4. Pesan yang dikirim.
5. Error message jika gagal.
6. Filter status.

### 9.5 System Logs

Fitur:

1. Log backend.
2. Log ML Worker.
3. Log gateway jika dikirim ke EMS.
4. Level: info, warning, error.
5. Source: backend, gateway, ml-worker, telegram.
6. Message.
7. Timestamp.
8. Filter source, level, dan waktu.

### 9.6 Data Source

- `GET /api/v1/anomaly-events`
- `GET /api/v1/notification-logs`
- `GET /api/v1/system-logs`

### 9.7 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| EV-001 | Anomaly events tampil dari database |
| EV-002 | Notification logs tampil dari database |
| EV-003 | System logs tampil dari database |
| EV-004 | Filter status dan waktu bekerja |
| EV-005 | Failed Telegram tidak membuat backend crash |
| EV-006 | Events & Logs aman saat data kosong |

---

## 10. Menu 6 — Settings

### 10.1 Tujuan

Halaman Settings digunakan untuk konfigurasi sistem utama.

### 10.2 Fitur Wajib

Settings wajib memiliki:

1. Gateway settings summary.
2. API token gateway.
3. Telegram settings.
4. Thermal threshold settings.
5. ML parameter info.
6. App environment info.
7. Test Telegram button.
8. Save settings.

### 10.3 Gateway Settings

Field:

| Field | Keterangan |
|---|---|
| gateway_code | Kode gateway |
| gateway_name | Nama gateway |
| expected_interval_seconds | Interval data yang diharapkan |
| gateway_token | Token gateway |
| last_seen_at | Terakhir gateway mengirim data |
| status | active/offline/trouble |

Catatan:

- EMS menyimpan token gateway.
- Gateway menggunakan token tersebut untuk POST readings.
- Token harus disembunyikan sebagian di UI.

### 10.4 Telegram Settings

Field:

| Field | Keterangan |
|---|---|
| telegram_enabled | true/false |
| bot_token | Token bot Telegram |
| chat_id | ID chat tujuan |
| cooldown_minutes | Cooldown notifikasi |

### 10.5 Threshold Settings

Field:

| Field | Default | Keterangan |
|---|---:|---|
| threshold_normal_max | 30.0 | Batas atas normal |
| threshold_anomaly_min | 32.0 | Batas awal anomali |
| sensor_timeout_minutes | 5 | Batas trouble sensor |

### 10.6 ML Parameter Info

Field ini boleh read-only:

| Field | Default |
|---|---:|
| raw_sampling_interval_seconds | 10 |
| ml_resample_interval_seconds | 60 |
| window_size | 30 |
| horizon_minutes | 5 |
| target_sensor | S2 |

### 10.7 Data Source

- `GET /api/v1/settings`
- `PUT /api/v1/settings/{key}`
- `POST /api/v1/notifications/test`
- `GET /api/v1/gateways`

### 10.8 Acceptance Criteria

| Kode | Kriteria |
|---|---|
| SET-001 | Settings dapat mengambil konfigurasi dari database |
| SET-002 | Threshold dapat diubah dan tersimpan |
| SET-003 | Telegram dapat enable/disable |
| SET-004 | Test Telegram dapat dijalankan |
| SET-005 | Gateway token tidak ditampilkan penuh sembarangan |
| SET-006 | Settings error ditampilkan dengan jelas |

---

## 11. Gateway Scope

### 11.1 Fitur Gateway Wajib

Gateway wajib memiliki:

1. Config file YAML atau ENV.
2. Serial port configuration.
3. Modbus configuration.
4. Sensor S1 config.
5. Sensor S2 config.
6. Diagnostic mode.
7. Hardware reading mode.
8. Payload builder.
9. HTTP sender.
10. Retry ringan.
11. Local bounded buffer.
12. Replay buffer throttled.
13. Gateway logs.
14. Sensor timeout handling.
15. Status payload untuk trouble.

### 11.2 Diagnostic Mode

Karena hardware belum pernah diuji, diagnostic mode wajib dibuat.

Command diagnostic minimal:

```bash
python -m gateway.cli diagnose ports
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
python -m gateway.cli diagnose sensor --sensor-code S1
python -m gateway.cli send-test
python -m gateway.cli run
```

### 11.3 Gateway Tidak Wajib

Fitur berikut tidak wajib pada versi awal:

1. Gateway local web UI.
2. Reboot Raspberry Pi dari dashboard.
3. Ubah network Raspberry Pi dari dashboard.
4. ZeroTier management otomatis.
5. Multi-device gateway management kompleks.

### 11.4 Acceptance Criteria Gateway

| Kode | Kriteria |
|---|---|
| GW-001 | Gateway dapat membaca konfigurasi |
| GW-002 | Gateway dapat list serial port |
| GW-003 | Gateway dapat test baca raw register |
| GW-004 | Gateway dapat membentuk payload S1/S2 |
| GW-005 | Gateway dapat POST payload ke backend |
| GW-006 | Gateway tidak crash jika satu sensor gagal |
| GW-007 | Gateway menyimpan buffer jika backend offline |
| GW-008 | Gateway dapat replay buffer secara terbatas |

---

## 12. Backend Scope

### 12.1 Fitur Backend Wajib

Backend wajib menyediakan:

1. Health check.
2. Gateway token authentication.
3. POST readings.
4. GET readings latest.
5. GET readings history.
6. GET sensors.
7. Update sensor metadata.
8. Dashboard summary.
9. Prediction latest/history.
10. Model versions.
11. Activate model.
12. Model metrics.
13. Layout API.
14. Anomaly events API.
15. Notification logs API.
16. Settings API.
17. System logs API.
18. SSE events.
19. Telegram client.
20. Error response standard.

### 12.2 Backend Acceptance Criteria

| Kode | Kriteria |
|---|---|
| BE-001 | Backend dapat build tanpa error |
| BE-002 | Health check berjalan |
| BE-003 | Request tanpa token ditolak untuk endpoint gateway |
| BE-004 | Payload valid tersimpan |
| BE-005 | Payload invalid ditolak jelas |
| BE-006 | Data latest dan history dapat diambil |
| BE-007 | Dashboard summary berjalan |
| BE-008 | SSE dapat mengirim update reading terbaru |
| BE-009 | Telegram gagal tidak membuat backend crash |
| BE-010 | Semua error response konsisten |

---

## 13. ML Worker Scope

### 13.1 Fitur ML Worker Wajib

ML Worker wajib memiliki:

1. Database loader.
2. Merge S1/S2 by timestamp.
3. Resampling ke 1 menit.
4. Missing value handling.
5. Outlier/invalid filtering.
6. Target shifting untuk S2 t+5 menit.
7. Feature scaling.
8. Target scaling.
9. Window builder.
10. Chronological split.
11. Baseline persistence.
12. Baseline moving average.
13. LSTM trainer.
14. Metrics calculation.
15. Artifact writer.
16. Model version writer.
17. Inference runner.
18. Prediction writer.
19. Status classifier.
20. System log writer.

### 13.2 ML Worker Tidak Wajib

Fitur berikut tidak wajib:

1. AutoML.
2. Ensemble model.
3. Hyperparameter tuning kompleks.
4. Training di Raspberry Pi.
5. Prediksi PUE.
6. Unsupervised anomaly detection kompleks.

### 13.3 Acceptance Criteria ML Worker

| Kode | Kriteria |
|---|---|
| ML-001 | ML Worker dapat membaca data dari database |
| ML-002 | Data S1/S2 berhasil digabung |
| ML-003 | Data berhasil diresampling ke 1 menit |
| ML-004 | Window training terbentuk |
| ML-005 | Baseline metrics dihitung |
| ML-006 | LSTM berhasil training |
| ML-007 | Artifact model tersimpan |
| ML-008 | RMSE, MAE, MAPE tersimpan |
| ML-009 | Inference menghasilkan prediksi suhu S2 |
| ML-010 | Prediksi tersimpan ke database |

---

## 14. Frontend Scope

### 14.1 Frontend Wajib

Frontend wajib memiliki:

1. App layout.
2. Sidebar final 6 menu.
3. Topbar status.
4. API client.
5. SSE client.
6. Status badge component.
7. Card component.
8. Chart component.
9. Table component.
10. Loading state.
11. Empty state.
12. Error state.
13. Dashboard page.
14. Sensors & Readings page.
15. Prediction & LSTM page.
16. Layout page.
17. Events & Logs page.
18. Settings page.

### 14.2 Frontend Tidak Wajib

1. Mobile app.
2. Multi-user login kompleks.
3. Dark mode jika menghambat fitur utama.
4. Animasi berlebihan.
5. UI enterprise multi-site.

### 14.3 Acceptance Criteria Frontend

| Kode | Kriteria |
|---|---|
| FE-001 | Frontend dapat build |
| FE-002 | Semua menu sidebar dapat dibuka |
| FE-003 | API client menggunakan env base URL |
| FE-004 | Dashboard tidak memakai dummy production data |
| FE-005 | Chart tampil dari API |
| FE-006 | Loading/empty/error state tersedia |
| FE-007 | SSE update tidak membuat UI crash |
| FE-008 | Layout marker dapat tampil |

---

## 15. Prioritas Implementasi

### Priority 0 — Fondasi

1. Repo structure.
2. Environment file.
3. Docker Compose PostgreSQL.
4. Database migration.
5. Backend skeleton.
6. Frontend skeleton.
7. Gateway skeleton.
8. ML Worker skeleton.

### Priority 1 — Data Flow Sensor

1. Gateway config.
2. Backend POST readings.
3. Database sensor_readings.
4. Latest/history API.
5. Dashboard basic readings.

### Priority 2 — Realtime Monitoring

1. SSE backend.
2. Frontend SSE client.
3. Dashboard cards update.
4. Sensor readings chart.

### Priority 3 — Hardware Diagnostic

1. Serial port list.
2. Raw Modbus read.
3. Sensor test command.
4. Gateway send-test command.

### Priority 4 — ML Worker

1. Dataset loader.
2. Preprocessing.
3. Training.
4. Baseline.
5. Metrics.
6. Artifact.
7. Inference.

### Priority 5 — Prediction Integration

1. Predictions table.
2. Prediction API.
3. Dashboard prediction card.
4. Model version UI.
5. Model activation.

### Priority 6 — Layout and Alerts

1. Layout upload.
2. Sensor marker.
3. Anomaly event.
4. Telegram notification.
5. Events & Logs.

### Priority 7 — Polish and Testing

1. Error handling.
2. README.
3. Runbook.
4. Test plan execution.
5. Screenshots for Bab 4.

---

## 16. Anti-Scope Creep Rules

Codex harus menolak atau menunda fitur berikut jika muncul saat implementasi:

1. PUE.
2. Energy dashboard.
3. Fan control.
4. AC control.
5. Relay control.
6. Mobile app.
7. Enterprise multi-tenant.
8. Kubernetes.
9. Kafka/RabbitMQ kecuali benar-benar dibutuhkan.
10. Authentication kompleks.
11. Role-based access control kompleks.
12. AutoML.
13. Model selain LSTM sebagai model utama.
14. Training di Raspberry Pi.
15. Web gateway admin penuh sebelum fitur wajib stabil.

---

## 17. Definition of Done Dokumen Ini

Scope fitur dianggap final jika:

1. Sidebar final sudah disetujui.
2. Fitur wajib per menu sudah jelas.
3. Fitur opsional tidak mengganggu fitur wajib.
4. Gateway scope sudah hardware-first.
5. ML scope tetap fokus prediksi S2.
6. Backend scope cukup untuk dashboard dan ML.
7. Frontend scope tidak terlalu banyak menu.
8. Tidak ada PUE atau kontrol pendingin.
9. Prioritas implementasi sudah jelas.
