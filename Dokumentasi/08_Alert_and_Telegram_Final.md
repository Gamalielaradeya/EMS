# 08 Alert and Telegram Final — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini menjelaskan rancangan final mekanisme alert dan notifikasi Telegram pada project **EMS Thermal LSTM**.

Dokumen ini menjadi pegangan Codex agar implementasi status, anomaly event, cooldown, notification log, Telegram message, dan dashboard alert dibuat konsisten dengan scope skripsi.

---

## 2. Posisi Alert dalam Sistem

Alert berada setelah data sensor masuk dan/atau setelah prediksi LSTM dibuat.

```text
Sensor S1/S2
    ↓
Gateway Raspberry Pi
    ↓
Backend EMS
    ↓
Database sensor_readings
    ↓
ML Worker LSTM
    ↓
Prediction S2 +5 menit
    ↓
Status classification
    ↓
Anomaly event
    ↓
Dashboard alert + Telegram notification
```

Alert **bukan sistem kontrol otomatis**. Sistem hanya memberi informasi, peringatan, dan notifikasi. Sistem tidak menghidupkan kipas, mematikan server, mengontrol AC, atau menjalankan relay.

---

## 3. Sumber Alert

Sumber alert final:

| Sumber | Keterangan |
|---|---|
| Prediksi LSTM | Prediksi suhu S2 melewati threshold normal/waspada/anomali |
| Sensor Gateway | Sensor timeout, tidak terbaca, atau data invalid |
| Gateway | Gateway tidak mengirim data lebih dari batas waktu |
| ML Worker | Model belum siap, data tidak cukup, inference gagal |
| Backend | Payload invalid, database error, SSE issue |
| Telegram | Notifikasi gagal terkirim |

---

## 4. Status Final Sistem

Sistem menggunakan status berikut:

| Status | Makna | Sumber Utama |
|---|---|---|
| `normal` | Kondisi aman | Prediksi S2 di bawah threshold normal |
| `waspada` | Mendekati batas operasional | Prediksi S2 berada pada rentang warning |
| `anomali` | Melewati batas operasional | Prediksi S2 melewati threshold anomaly |
| `trouble` | Masalah teknis sensor/gateway/sistem | Sensor timeout, data invalid, gateway offline |

Priority status:

```text
trouble > anomali > waspada > normal
```

Artinya, jika S2 trouble, dashboard harus menampilkan trouble walaupun prediksi terakhir normal.

### 4.1 Documentation Lock Status Model

Backend menjadi source of truth untuk status final setelah menerima inference melalui protected `POST /api/v1/ml/predictions`.

```text
sensor_health_status: normal | trouble | inactive
thermal_status      : normal | waspada | anomali
final_status        : trouble > anomali > waspada > normal
```

Prediction stale setelah 10 menit tetap disimpan pada history, tetapi tidak boleh menjadi active dashboard status atau Telegram trigger.

Gateway mengirim heartbeat setiap 60 detik. Backend menjalankan offline checker setiap 30 detik dan menganggap sensor atau gateway trouble jika tidak ada data lebih dari 5 menit.

---

## 5. Threshold Termal

Status termal ditentukan berdasarkan prediksi suhu S2.

Default threshold:

| Status | Kondisi |
|---|---|
| Normal | `predicted_temperature_s2 < 30.0°C` |
| Waspada | `30.0°C <= predicted_temperature_s2 <= 32.0°C` |
| Anomali | `predicted_temperature_s2 > 32.0°C` |

Catatan akademik:

1. Threshold 30°C dan 32°C adalah batas operasional untuk testbed penelitian.
2. Threshold ini bukan standar universal data center.
3. Threshold harus dapat dikonfigurasi melalui `settings`.
4. Target utama status termal adalah sensor S2 hotspot/exhaust.
5. S1 adalah sensor ambient/reference.

Pseudocode:

```python
def classify_thermal_status(predicted_temperature, normal_max=30.0, anomaly_min=32.0):
    if predicted_temperature < normal_max:
        return "normal"
    if predicted_temperature <= anomaly_min:
        return "waspada"
    return "anomali"
```

---

## 6. Status Sensor

Sensor memiliki health status:

| Status Sensor | Kondisi |
|---|---|
| `normal` | Sensor terbaca dan data valid |
| `trouble` | Sensor timeout/tidak terbaca/data invalid |
| `inactive` | Sensor tidak digunakan sementara |

Aturan:

1. S1 umumnya `normal` atau `trouble`.
2. Thermal status S2 disimpan terpisah sebagai `normal`, `waspada`, atau `anomali`.
3. Status `trouble` lebih prioritas daripada status prediksi.
4. Jika model belum siap, jangan memaksa status prediksi.

---

## 7. Severity Mapping

| Status | Severity | UI Meaning |
|---|---|---|
| normal | info | Aman |
| waspada | warning | Perlu perhatian |
| anomali | critical | Perlu tindakan pemantauan segera |
| trouble | error | Masalah teknis |

Severity digunakan untuk:

1. Badge dashboard.
2. Warna marker layout.
3. Anomaly event table.
4. Telegram message.
5. System log level.

---

## 8. Trigger Alert

### 8.1 Thermal Warning Alert

Trigger:

```text
30.0°C <= predicted_temperature_s2 <= 32.0°C
```

Status:

```text
waspada
```

Action:

1. Simpan prediction.
2. Simpan anomaly event status `waspada`.
3. Emit SSE `prediction.latest`.
4. Emit SSE `anomaly.created`.
5. Kirim Telegram jika aturan notification terpenuhi.
6. Tampilkan badge waspada pada dashboard.

---

### 8.2 Thermal Anomaly Alert

Trigger:

```text
predicted_temperature_s2 > 32.0°C
```

Status:

```text
anomali
```

Action:

1. Simpan prediction.
2. Simpan anomaly event status `anomali`.
3. Emit SSE `prediction.latest`.
4. Emit SSE `anomaly.created`.
5. Kirim Telegram jika aturan notification terpenuhi.
6. Tampilkan marker S2 sebagai anomali pada layout.

---

### 8.3 Normal Recovery Event

Trigger:

```text
previous_status IN ('waspada', 'anomali', 'trouble')
AND current_status = 'normal'
```

Action:

1. Simpan recovery event sebagai `normal` jika fitur recovery logging aktif.
2. Tampilkan di Events & Logs.
3. Telegram recovery bersifat opsional.

Keputusan final:

```text
Simpan recovery event boleh dilakukan.
Telegram recovery tidak wajib untuk versi awal.
```

---

### 8.4 Sensor Trouble Alert

Trigger:

1. Sensor timeout.
2. Sensor tidak merespons Modbus.
3. Sensor mengirim data kosong.
4. Data sensor invalid.
5. Gateway melaporkan sensor trouble.
6. Sensor tidak memiliki data terbaru lebih dari `sensor_timeout_minutes`.

Default:

| Kondisi | Rule |
|---|---|
| Missing warning | Tidak ada data > 2x expected interval |
| Trouble | Tidak ada data > 5 menit |

Action:

1. Update sensor status menjadi `trouble`.
2. Simpan `system_logs`.
3. Simpan anomaly event status `trouble` jika relevan.
4. Emit SSE `sensor.trouble`.
5. Kirim Telegram jika trouble terjadi pada S2 atau gateway utama.

---

### 8.5 Gateway Offline Alert

Trigger:

```text
now - gateways.last_seen_at > sensor_timeout_minutes
```

Action:

1. Update gateway status menjadi `offline`.
2. Simpan system log.
3. Emit SSE `gateway.status`.
4. Tampilkan gateway offline di dashboard.
5. Telegram opsional tetapi disarankan jika gateway utama offline.

---

### 8.6 Model Not Ready Alert

Trigger:

1. Tidak ada model aktif.
2. File `model.keras` tidak ditemukan.
3. `feature_scaler.pkl` tidak ditemukan.
4. `target_scaler.pkl` tidak ditemukan.
5. Data kurang dari window requirement.
6. Inference gagal.

Status internal:

```text
model_not_ready
```

Action:

1. Simpan ke `system_logs`.
2. Tampilkan warning di dashboard Prediction & LSTM.
3. Jangan membuat anomaly event termal.
4. Telegram tidak wajib.

---

## 9. Database Tables yang Digunakan

Alert menggunakan tabel:

1. `predictions`
2. `anomaly_events`
3. `notification_logs`
4. `system_logs`
5. `settings`
6. `sensors`
7. `gateways`

---

## 10. Anomaly Event Rules

### 10.1 Field Penting

`anomaly_events` minimal menyimpan:

```text
prediction_id
sensor_id
event_type
status
severity
predicted_temperature
actual_temperature
threshold_normal_max
threshold_anomaly_min
description
detected_at
created_at
```

### 10.2 Event yang Wajib Disimpan

| Event | Wajib? |
|---|---|
| Waspada | Ya |
| Anomali | Ya |
| Trouble sensor | Ya |
| Gateway offline | Ya sebagai system log, anomaly event opsional |
| Recovery normal | Opsional tetapi disarankan |
| Model not ready | System log saja |

### 10.3 Description Template

Waspada:

```text
Predicted S2 temperature is within warning range.
```

Anomali:

```text
Predicted S2 temperature exceeded anomaly threshold.
```

Trouble:

```text
Sensor S2 reported trouble: <message>.
```

---

## 11. Telegram Notification Rules

### 11.1 Kapan Telegram Dikirim

| Kondisi | Telegram |
|---|---|
| normal → waspada | Ya |
| normal → anomali | Ya |
| waspada → anomali | Ya |
| anomali → waspada | Ya, opsional; default ya jika status berubah |
| waspada tetap waspada | Tidak selama cooldown |
| anomali tetap anomali | Tidak selama cooldown |
| anomali/waspada → normal | Opsional, default tidak |
| S2 trouble | Ya |
| S1 trouble | Opsional, default tidak |
| Gateway offline | Ya jika gateway utama |
| Model not ready | Tidak wajib |
| Telegram disabled | Tidak kirim, log `skipped` |

---

### 11.2 Cooldown Rule

Default cooldown:

```text
5 menit
```

Aturan:

1. Notifikasi status yang sama untuk sensor yang sama tidak dikirim ulang selama cooldown.
2. Eskalasi status tetap dikirim meskipun masih dalam cooldown.
3. Eskalasi: `normal → waspada`, `normal → anomali`, `waspada → anomali`.
4. Telegram disabled menghasilkan log `skipped`.
5. Failure Telegram menghasilkan log `failed`.

Pseudocode:

```python
def should_send_notification(current_status, previous_status, last_notification_at, cooldown_minutes):
    if current_status == "normal":
        return False

    if previous_status != current_status:
        return True

    if last_notification_at is None:
        return True

    elapsed_minutes = now() - last_notification_at
    return elapsed_minutes >= cooldown_minutes
```

---

## 12. Telegram Settings

Settings yang digunakan:

| Key | Default | Sensitive | Keterangan |
|---|---|---|---|
| `telegram_enabled` | `false` | false | Enable/disable Telegram |
| `telegram_bot_token` | empty | true | Token bot |
| `telegram_chat_id` | empty | true | Chat ID tujuan |
| `telegram_cooldown_minutes` | `5` | false | Cooldown notifikasi |
| `threshold_normal_max` | `30.0` | false | Batas normal |
| `threshold_anomaly_min` | `32.0` | false | Batas anomali |

Aturan keamanan:

1. Bot token tidak boleh hardcoded.
2. Bot token tidak boleh tampil penuh di UI.
3. Chat ID dapat disamarkan sebagian.
4. Telegram gagal tidak boleh menghentikan backend.

---

## 13. Telegram Message Format

### 13.1 Thermal Waspada

```text
[EMS THERMAL ALERT]

Status        : WASPADA
Sensor        : S2 - Hotspot/Exhaust
Prediksi Suhu : 31.4°C
Prediksi Untuk: 2026-01-17 14:35:00
Threshold     : Normal < 30°C, Anomali > 32°C
Model         : LSTM v1.0.0
Waktu Deteksi : 2026-01-17 14:30:00

Keterangan:
Suhu S2 diprediksi mendekati batas operasional.
```

### 13.2 Thermal Anomali

```text
[EMS THERMAL ALERT]

Status        : ANOMALI
Sensor        : S2 - Hotspot/Exhaust
Prediksi Suhu : 33.2°C
Prediksi Untuk: 2026-01-17 14:35:00
Threshold     : Normal < 30°C, Anomali > 32°C
Model         : LSTM v1.0.0
Waktu Deteksi : 2026-01-17 14:30:00

Keterangan:
Suhu S2 diprediksi melewati batas operasional.
Segera lakukan pemeriksaan kondisi lingkungan server testbed.
```

### 13.3 Sensor Trouble

```text
[EMS SENSOR TROUBLE]

Status   : TROUBLE
Sensor   : S2 - Hotspot/Exhaust
Masalah  : Sensor timeout
Gateway  : raspi-gateway-01
Waktu    : 2026-01-17 14:30:00

Keterangan:
Sensor tidak dapat dibaca oleh gateway.
Periksa koneksi RS485, power sensor, slave ID, dan konfigurasi register.
```

### 13.4 Gateway Offline

```text
[EMS GATEWAY OFFLINE]

Gateway : raspi-gateway-01
Status  : OFFLINE
Last Seen: 2026-01-17 14:20:00
Waktu   : 2026-01-17 14:30:00

Keterangan:
Gateway tidak mengirim data lebih dari batas timeout.
Periksa koneksi jaringan, service gateway, dan Raspberry Pi.
```

---

## 14. Notification Log Rules

Setiap keputusan notifikasi harus tercatat.

| Kondisi | Log Status |
|---|---|
| Berhasil dikirim | `sent` |
| Telegram API error | `failed` |
| Telegram disabled | `skipped` |
| Cooldown aktif | `skipped` |
| Menunggu kirim | `pending` |

Field minimal:

```text
anomaly_event_id
channel
recipient
message
status
sent_at
error_message
metadata
created_at
```

---

## 15. Backend Alert Service

Backend perlu memiliki service berikut:

```text
StatusClassificationService
AlertEventService
NotificationDecisionService
TelegramService
NotificationLogService
```

### 15.1 StatusClassificationService

Tanggung jawab:

1. Ambil threshold dari settings.
2. Klasifikasikan prediksi S2.
3. Terapkan priority `trouble > anomali > waspada > normal`.

### 15.2 AlertEventService

Tanggung jawab:

1. Membuat anomaly event.
2. Menyimpan recovery jika aktif.
3. Emit SSE `anomaly.created`.

### 15.3 NotificationDecisionService

Tanggung jawab:

1. Cek previous status.
2. Cek cooldown.
3. Cek Telegram enabled.
4. Tentukan sent/skipped.
5. Proses event melalui bounded in-memory queue agar ingestion tidak menunggu Telegram.
6. Queue penuh harus dicatat sebagai `failed`, bukan memblokir request.

### 15.4 TelegramService

Tanggung jawab:

1. Format message.
2. Send request ke Telegram API.
3. Return status sent/failed.
4. Tidak boleh panic.
5. Timeout Telegram tidak boleh menahan request readings, gateway status, atau prediction.

Worker notifikasi memproses queue secara berurutan agar keputusan cooldown
konsisten. Saat shutdown, backend berhenti menerima request lalu mencoba
menghabiskan queue dalam batas graceful shutdown. Endpoint test notification
tetap sinkron karena pengguna membutuhkan hasil tes langsung.

---

## 16. SSE Event untuk Alert

### 16.1 `prediction.latest`

Dikirim ketika prediksi baru disimpan.

### 16.2 `anomaly.created`

Dikirim ketika event waspada/anomali/trouble dibuat.

### 16.3 `notification.sent`

Dikirim ketika Telegram selesai diproses.

### 16.4 `sensor.trouble`

Dikirim ketika sensor dilaporkan trouble.

### 16.5 `gateway.status`

Dikirim ketika gateway heartbeat/status berubah.

---

## 17. Dashboard Alert Behavior

Dashboard harus menampilkan:

1. Badge status termal.
2. Recent anomaly table.
3. Marker layout dengan status.
4. Telegram enabled/disabled.
5. Notification history.
6. Sensor trouble warning.
7. Model not ready warning.
8. Gateway offline warning.

UI tidak boleh hanya mengandalkan warna. Status harus selalu ditampilkan sebagai teks.

---

## 18. Edge Cases

| Case | Expected Behavior |
|---|---|
| Tidak ada model aktif | Dashboard tampilkan model not ready |
| Prediksi stale | Jangan jadikan status aktif dashboard |
| S2 trouble | Status final trouble |
| S1 trouble tapi S2 normal | Dashboard tampilkan S1 trouble, status termal S2 tetap sesuai prediksi |
| Telegram token salah | Log failed, backend tidak crash |
| Telegram disabled | Log skipped jika event butuh notifikasi |
| Cooldown aktif | Tidak kirim ulang, log skipped opsional |
| Prediction normal setelah anomali | Recovery event opsional, Telegram tidak wajib |

---

## 19. Testing Alert

Test case minimal:

| ID | Skenario | Expected Result |
|---|---|---|
| ALERT-001 | Prediksi S2 28°C | Status normal, tidak ada Telegram |
| ALERT-002 | Prediksi S2 31°C | Status waspada, anomaly event dibuat |
| ALERT-003 | Prediksi S2 33°C | Status anomali, anomaly event dibuat |
| ALERT-004 | S2 trouble | Sensor status trouble, event trouble dibuat |
| ALERT-005 | Telegram disabled | Notification log skipped |
| ALERT-006 | Telegram API gagal | Notification log failed, backend tetap jalan |
| ALERT-007 | Status sama dalam cooldown | Tidak kirim ulang |
| ALERT-008 | Waspada ke anomali | Telegram tetap dikirim karena eskalasi |
| ALERT-009 | Gateway offline | Gateway status offline dan dashboard warning |
| ALERT-010 | Model not ready | System log warning, tidak membuat thermal anomaly |

---

## 20. Acceptance Criteria

| Kode | Kriteria |
|---|---|
| ALT-001 | Status normal/waspada/anomali dihitung dari prediksi S2 |
| ALT-002 | Status trouble lebih prioritas daripada prediksi |
| ALT-003 | Threshold dapat dibaca dari settings |
| ALT-004 | Anomaly event tersimpan untuk waspada/anomali |
| ALT-005 | Trouble event tersimpan untuk sensor bermasalah |
| ALT-006 | Telegram dikirim sesuai rules |
| ALT-007 | Cooldown mencegah spam notifikasi |
| ALT-008 | Telegram disabled menghasilkan skipped |
| ALT-009 | Telegram failure menghasilkan failed dan backend tetap jalan |
| ALT-010 | Dashboard menerima SSE event terkait alert |
| ALT-011 | Notification logs tampil pada Events & Logs |
| ALT-012 | Tidak ada kontrol kipas/AC/relay otomatis |

---

## 21. Instruksi untuk Codex

Saat mengimplementasikan alert dan Telegram, Codex harus:

1. Menggunakan status dan threshold dari dokumen ini.
2. Mengambil threshold dari `settings`.
3. Tidak hardcode token Telegram.
4. Tidak mengirim Telegram untuk setiap reading mentah.
5. Mengirim Telegram berdasarkan anomaly event/status event.
6. Menerapkan cooldown.
7. Mencatat semua hasil notifikasi ke `notification_logs`.
8. Tidak membuat backend crash ketika Telegram gagal.
9. Menyediakan test notification endpoint.
10. Tidak membuat fitur kontrol pendingin otomatis.
## Alert Category Documentation Lock Addendum

Keputusan final yang mengesampingkan penyebutan alert generik sebelumnya:

1. Alarm: reading aktual S1/S2 berubah ke `waspada` atau `anomali`.
2. Pre-Alarm: prediksi S2 non-stale berubah ke `waspada` atau `anomali`.
3. Trouble: sensor/gateway berubah ke kondisi trouble/offline.
4. Recovery: sumber yang sama kembali normal/active.
5. Status berulang tidak membuat event atau Telegram baru; eskalasi tetap membuat event.
6. Alarm aktual dan Trouble dievaluasi untuk Telegram segera. Pre-Alarm memakai cooldown. Recovery dicatat dan tidak dikirim ke Telegram.
7. Counter Pre-Alarm aktif hanya selama `predicted_for > now`; prediksi yang waktunya sudah lewat tetap berada dalam histori tetapi tidak dihitung aktif.
8. Dashboard mempertahankan satu Pre-Alarm threshold terbaru sampai waktu targetnya lewat. Prediksi threshold baru menggantikannya; prediksi normal yang lebih baru tidak menghapus peringatan yang targetnya masih di masa depan.
9. Recovery disimpan sebagai histori, tetapi tidak dianggap event aktif dan tidak ditampilkan pada monitoring bottom sheet.
