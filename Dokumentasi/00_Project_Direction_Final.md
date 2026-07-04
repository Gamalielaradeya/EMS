# 00 Project Direction Final — EMS Thermal LSTM

## 1. Identitas Project

**Nama project:** EMS Thermal LSTM  
**Jenis project:** Skripsi Informatika jalur perekayasaan  
**Fokus penelitian:** Early Warning System pada EMS Server menggunakan Long Short-Term Memory untuk estimasi suhu S2 lima menit ke depan
**Mode utama:** Hardware-first / real sensor mode  
**Repository:** repo baru dari nol  
**Deployment awal:** laptop development lokal  
**Gateway:** Raspberry Pi 3  
**Sensor:** 2 sensor XY-MD02 melalui USB RS485 adapter  

Project ini dibuat ulang dari awal agar implementasi lebih bersih, terarah, dan sesuai kebutuhan Bab 4 serta Bab 5 skripsi.

---

## 2. Tujuan Utama Sistem

EMS Thermal LSTM adalah sistem monitoring lingkungan server testbed yang bertujuan untuk:

1. Membaca suhu dan kelembaban dari dua sensor XY-MD02.
2. Mengirim data sensor dari Raspberry Pi gateway ke EMS central platform.
3. Menyimpan data sensor sebagai data time-series.
4. Menampilkan data aktual dan historis melalui dashboard web.
5. Melakukan prediksi suhu S2 untuk 5 menit ke depan menggunakan model LSTM.
6. Mengklasifikasikan status termal menjadi normal, waspada, anomali, atau trouble.
7. Menampilkan posisi sensor pada layout/denah yang dapat diunggah pengguna.
8. Menyimpan riwayat prediksi, anomali, notifikasi, dan log sistem.
9. Mengirim notifikasi Telegram ketika status masuk kondisi waspada, anomali, atau trouble sesuai aturan.
10. Menyediakan hasil implementasi dan pengujian yang siap dijadikan dasar Bab 4 dan Bab 5 skripsi.

---

## 3. Konsep Besar Sistem

Sistem dibagi menjadi tiga komponen utama:

```text
[Gateway Raspberry Pi]
    ↓
[EMS Central Platform]
    ↓
[ML Worker LSTM]
```

### 3.1 EMS Central Platform

EMS Central Platform adalah pusat sistem yang berjalan di laptop development pada tahap awal.

Komponen:

- Go backend API
- PostgreSQL database
- React dashboard
- SSE realtime update
- Telegram notification service
- Settings dan system logs

Tanggung jawab:

- Menerima data sensor dari gateway.
- Memvalidasi payload sensor.
- Menyimpan data ke database.
- Menyediakan API untuk dashboard.
- Mengirim update realtime ke dashboard.
- Menyimpan hasil prediksi dan status termal.
- Mengirim notifikasi Telegram.

### 3.2 Gateway Raspberry Pi

Gateway berjalan pada Raspberry Pi 3 dan bertugas membaca sensor asli.

Komponen:

- Python gateway service
- Modbus RTU reader
- Sensor validator
- HTTP sender
- Local bounded buffer
- Gateway logger
- Configuration file

Tanggung jawab:

- Membaca sensor XY-MD02 S1 dan S2 via USB RS485.
- Menggunakan konfigurasi serial port, baudrate, slave ID, dan register sensor.
- Mengirim payload sensor ke EMS backend.
- Melakukan retry ringan ketika pengiriman gagal.
- Menyimpan data gagal kirim ke buffer lokal terbatas.
- Melakukan replay buffer secara perlahan saat backend kembali online.
- Mengirim status trouble jika sensor timeout atau tidak terbaca.

### 3.3 ML Worker LSTM

ML Worker berjalan di laptop development atau server terpisah, bukan di Raspberry Pi.

Komponen:

- Python ML worker
- Data loader dari PostgreSQL
- Preprocessing time-series
- Resampling 1 menit
- Window builder
- Baseline model
- LSTM training
- Model evaluation
- Inference runner
- Prediction writer

Tanggung jawab:

- Mengambil data sensor dari database.
- Menggabungkan data S1 dan S2 berdasarkan timestamp.
- Melakukan preprocessing dan resampling.
- Membentuk dataset supervised learning.
- Melatih model LSTM.
- Membandingkan LSTM dengan baseline sederhana.
- Menghitung RMSE, MAE, dan MAPE.
- Menyimpan model artifact dan metadata.
- Melakukan inference suhu S2 5 menit ke depan.
- Menyimpan prediksi dan status termal ke database.

---

## 4. Hardware dan Peran Sensor

### 4.1 Hardware yang Digunakan

| Komponen | Fungsi |
|---|---|
| Laptop development | Menjalankan backend, database, dashboard, dan ML worker |
| Raspberry Pi 3 | Gateway pembaca sensor |
| Sensor XY-MD02 S1 | Sensor ambient/reference |
| Sensor XY-MD02 S2 | Sensor hotspot/exhaust |
| USB RS485 adapter | Penghubung sensor RS485 ke Raspberry Pi |
| Kabel UTP/AWG | Jalur komunikasi RS485 |
| Jaringan LAN/ZeroTier | Koneksi gateway ke EMS backend |

### 4.2 Peran Sensor

| Sensor | Peran | Fungsi |
|---|---|---|
| S1 | Ambient/reference | Mengukur suhu dan kelembaban area sekitar sebagai pembanding |
| S2 | Hotspot/exhaust | Mengukur suhu dan kelembaban area dekat sumber panas; target utama prediksi LSTM |

Target prediksi sistem adalah **suhu S2 5 menit ke depan**.

---

## 5. Sidebar dan Struktur Dashboard Final

Sidebar dashboard final menggunakan struktur ringkas berikut:

```text
Dashboard
Sensors & Readings
Prediction & LSTM
Layout
Events & Logs
Settings
```

### 5.1 Dashboard

Halaman ringkasan utama.

Fitur:

- Status koneksi API, SSE, gateway, sensor, model, dan Telegram.
- Card suhu dan kelembaban S1.
- Card suhu dan kelembaban S2.
- Card prediksi suhu S2 5 menit ke depan.
- Status termal: normal, waspada, anomali, atau trouble.
- Grafik suhu realtime/historis.
- Grafik kelembaban realtime/historis.
- Grafik actual S2 vs predicted S2.
- Preview layout sensor.
- Recent status events.

### 5.2 Sensors & Readings

Gabungan halaman data sensor dan manajemen sensor.

Fitur:

- Data realtime S1 dan S2.
- Tabel historis sensor readings.
- Filter berdasarkan sensor, waktu, dan quality status.
- Grafik suhu dan kelembaban.
- Daftar sensor.
- Sensor code, role, name, Modbus slave ID, status, dan last seen.
- Detail reading.

### 5.3 Prediction & LSTM

Gabungan halaman prediksi, training result, model version, dan evaluasi.

Fitur:

- Latest prediction.
- Prediction history.
- Active model.
- Model versions.
- Activate model.
- Model metadata.
- RMSE, MAE, MAPE.
- Baseline comparison.
- Training result.
- Dataset summary.

Training utama dilakukan melalui CLI/script ML Worker. Dashboard minimal dapat melihat model version dan mengaktifkan model yang tersedia.

### 5.4 Layout

Halaman layout/denah sensor.

Fitur:

- Upload gambar layout/denah.
- Menampilkan layout aktif.
- Menambahkan marker sensor.
- Memilih sensor untuk marker.
- Drag posisi sensor.
- Menyimpan posisi x/y marker.
- Marker berubah status sesuai kondisi sensor atau status termal.

### 5.5 Events & Logs

Gabungan halaman status event, notifikasi, dan log sistem.

Fitur:

- Riwayat status events.
- Riwayat status normal/waspada/anomali.
- Riwayat sensor trouble.
- Riwayat Telegram notification.
- Backend system logs.
- ML Worker logs.
- Gateway logs yang dikirim ke EMS jika tersedia.

### 5.6 Settings

Halaman konfigurasi sistem.

Fitur:

- Gateway configuration.
- API token gateway.
- Telegram bot token dan chat ID.
- Enable/disable Telegram.
- Threshold normal max.
- Threshold anomaly min.
- Sampling interval display.
- ML horizon dan window info.
- App configuration.

---

## 6. Interval Data dan Realtime Strategy

Sistem membedakan interval monitoring dan interval ML.

| Bagian | Nilai Final |
|---|---|
| Gateway sensor read interval | 10 detik default |
| Gateway send interval | 10 detik default |
| Dashboard update | Setiap data baru masuk melalui SSE |
| Database raw readings | Menyimpan data mentah setiap 10 detik |
| ML resampling interval | 1 menit |
| LSTM window size | 30 data hasil resample |
| LSTM window duration | 30 menit |
| Prediction horizon | 5 menit ke depan |
| Inference interval | 1 menit atau sesuai konfigurasi |

Alasan desain:

- Dashboard tetap terasa realtime karena data masuk setiap 10 detik.
- ML tetap konsisten dengan rancangan skripsi karena data diresampling menjadi interval 1 menit.
- Window 30 tetap merepresentasikan 30 menit histori.
- Horizon 5 menit tetap jelas secara akademik.

---

## 7. Gateway Delivery Strategy

Gateway tidak menggunakan fire-and-forget murni dan tidak menggunakan retry agresif.

Strategi final:

1. Gateway membaca S1 dan S2 sesuai interval.
2. Gateway membentuk payload JSON dengan timestamp.
3. Gateway mengirim payload ke EMS backend.
4. Jika berhasil, gateway melanjutkan loop berikutnya.
5. Jika gagal, gateway melakukan retry ringan 1 kali.
6. Jika retry masih gagal, payload disimpan ke local bounded buffer.
7. Gateway tetap melanjutkan pembacaan sensor berikutnya.
8. Payload buffer dikirim ulang secara perlahan saat backend kembali online.
9. Payload realtime terbaru lebih diprioritaskan daripada replay payload lama.
10. Buffer harus dibatasi agar storage Raspberry Pi tidak penuh.

Default konfigurasi:

| Parameter | Nilai |
|---|---|
| HTTP timeout | 5 detik |
| Retry count | 1 |
| Retry delay | 2 detik |
| Local buffer | JSONL file |
| Max buffer items | 1000 payload |
| Replay rate | 5 payload per menit |

---

## 8. ML dan Model Artifact

Model LSTM menghasilkan artifact berikut:

| Artifact | Fungsi |
|---|---|
| `model.keras` | Model LSTM hasil training |
| `feature_scaler.pkl` | Scaler untuk input feature |
| `target_scaler.pkl` | Scaler untuk target suhu S2 |
| `model_metadata.json` | Metadata model, parameter, fitur, target, metrics, dan training time |

Feature input:

```text
temperature_s1
humidity_s1
temperature_s2
humidity_s2
```

Target:

```text
future_temperature_s2
```

Parameter final:

| Parameter | Nilai |
|---|---|
| Model utama | LSTM |
| Baseline | Persistence dan moving average |
| Split data | Chronological split |
| Metrics | RMSE, MAE, MAPE |
| Target prediksi | Suhu S2 5 menit ke depan |
| Window | 30 data hasil resample 1 menit |

---

## 9. Status Termal

Status termal ditentukan berdasarkan prediksi suhu S2.

| Status | Kondisi Default |
|---|---|
| Normal | predicted_temperature_s2 < 30°C |
| Waspada | 30°C <= predicted_temperature_s2 <= 32°C |
| Anomali | predicted_temperature_s2 > 32°C |
| Trouble | Sensor timeout, sensor tidak terbaca, data invalid, atau gateway bermasalah |

Prioritas status:

```text
trouble > anomali > waspada > normal
```

Threshold 30°C dan 32°C adalah batas operasional untuk testbed penelitian, bukan standar universal untuk semua server atau data center.

---

## 10. Fitur Wajib

Fitur berikut wajib dibuat:

1. Backend Go dapat menerima data sensor dari gateway.
2. Backend melakukan validasi payload sensor.
3. Backend menyimpan data sensor ke PostgreSQL.
4. Backend menyediakan data latest dan history.
5. Backend menyediakan SSE update realtime.
6. Gateway Raspberry Pi dapat dikonfigurasi untuk membaca S1 dan S2.
7. Gateway mengirim payload sensor ke backend.
8. Dashboard menampilkan data sensor aktual.
9. Dashboard menampilkan grafik suhu dan kelembaban.
10. Dashboard menampilkan prediksi suhu S2.
11. Dashboard menampilkan status normal, waspada, anomali, dan trouble.
12. Layout dapat menampilkan posisi sensor di atas gambar denah.
13. ML Worker dapat training LSTM dari data database.
14. ML Worker menghasilkan model artifact.
15. ML Worker menghitung RMSE, MAE, MAPE.
16. ML Worker menyimpan hasil prediksi ke database.
17. Sistem menyimpan riwayat status events pada tabel internal `anomaly_events`.
18. Sistem mengirim Telegram alert untuk kondisi penting.
19. Sistem memiliki settings dasar.
20. Sistem memiliki test plan dan runbook.

---

## 11. Fitur Opsional

Fitur berikut boleh dibuat jika fitur wajib sudah stabil:

1. Gateway local web admin.
2. Training trigger dari dashboard.
3. Import CSV dataset dari dashboard.
4. Export readings ke CSV.
5. ZeroTier status display.
6. Reboot Raspberry Pi dari UI.
7. Network configuration dari UI.
8. Advanced model comparison chart.
9. Login admin sederhana.

Fitur opsional tidak boleh mengganggu stabilitas fitur wajib.

---

## 12. Out of Scope / Dilarang Dibuat

Fitur berikut tidak boleh dimasukkan ke versi final skripsi:

1. PUE calculation.
2. Efisiensi energi.
3. Optimasi konsumsi daya.
4. Kontrol kipas otomatis.
5. Kontrol AC otomatis.
6. Relay control.
7. Auto remediation.
8. Sistem enterprise data center.
9. Training LSTM di Raspberry Pi.
10. Model utama selain LSTM.
11. Mobile app.
12. Multi-user/role kompleks.

Jika Codex menemukan referensi lama terkait PUE atau efisiensi energi, abaikan dan jangan implementasikan.

---

## 13. Development dan Deployment Awal

Deployment awal dilakukan di laptop development.

```text
Laptop development:
- PostgreSQL
- Go backend
- React dashboard
- Python ML Worker

Raspberry Pi 3:
- Python gateway service
- USB RS485 sensor reader

Network:
- LAN lokal atau ZeroTier
```

VPS Ubuntu 24.04 hanya digunakan jika sistem lokal sudah stabil atau dibutuhkan untuk deployment lanjutan.

---

## 14. Standar Kualitas Implementasi

Codex harus menghasilkan implementasi dengan standar berikut:

1. Struktur project rapi dan modular.
2. Tidak menggunakan dummy data pada jalur produksi.
3. Semua konfigurasi penting menggunakan `.env` atau config file.
4. Migration database tersedia.
5. Seed data awal tersedia untuk gateway dan sensor.
6. Endpoint API memiliki validasi input.
7. Error response konsisten.
8. Logging tersedia pada backend, gateway, dan ML Worker.
9. Gateway tidak boleh crash hanya karena satu sensor gagal terbaca.
10. Backend tidak boleh crash jika Telegram gagal.
11. Dashboard harus menangani loading, empty, dan error state.
12. ML Worker harus menyimpan artifact dan metadata.
13. Setiap milestone wajib dites sebelum lanjut.
14. README dan runbook wajib tersedia.

---

## 15. Definition of Done Global

Project dianggap layak untuk lanjut ke Bab 4 jika:

1. Backend berhasil build dan running.
2. Database migration berhasil dijalankan.
3. Gateway dapat mengirim data sensor atau minimal payload hardware-ready.
4. Data sensor tersimpan di database.
5. Dashboard membaca data asli dari API.
6. SSE update berjalan.
7. ML Worker dapat training dari database.
8. Model artifact berhasil dibuat.
9. Prediksi suhu S2 dapat disimpan ke database.
10. Status normal, waspada, anomali, dan trouble dapat diuji.
11. Telegram alert dapat diuji atau failure-nya tercatat aman.
12. Layout sensor dapat menampilkan marker sensor.
13. Test plan memiliki bukti hasil pengujian.
14. Tidak ada fitur di luar scope seperti PUE dan kontrol pendingin.

---

## 16. Instruksi untuk Codex

Saat mengerjakan project ini, Codex harus mengikuti aturan berikut:

1. Jangan langsung mengubah scope.
2. Jangan menambahkan fitur di luar dokumen final.
3. Jangan membuat PUE, energy optimization, atau cooling control.
4. Selalu baca dokumen dalam `Dokumentasi/` sebelum coding.
5. Kerjakan berdasarkan milestone.
6. Setelah setiap milestone, jalankan build/test yang relevan.
7. Laporkan file yang dibuat atau diubah.
8. Laporkan command yang dijalankan.
9. Jika ada ambiguity, berhenti dan minta keputusan.
10. Prioritaskan sistem hardware-first, bukan simulator-first.

---

## 17. Catatan Kondisi Awal Hardware

Kondisi awal yang diketahui:

1. Raspberry Pi 3 sudah terpasang OS berbasis Ubuntu/Debian CLI.
2. Raspberry Pi sudah bisa diakses melalui SSH.
3. Sensor XY-MD02 belum pernah diuji koneksi real.
4. USB RS485 adapter belum diverifikasi di Raspberry Pi.
5. Register Modbus sensor belum dikonfirmasi.
6. Slave ID S1 dan S2 belum dikonfirmasi.

Karena itu, gateway harus memiliki mode diagnostic untuk:

1. Melihat daftar serial port.
2. Menguji koneksi Modbus.
3. Menguji baca satu sensor berdasarkan slave ID.
4. Menguji kombinasi register suhu dan kelembaban.
5. Menampilkan hasil raw register.
6. Menyimpan log diagnostic.

Diagnostic mode digunakan untuk validasi hardware, bukan sebagai pengganti sistem utama.
