# 05 Backend API Final — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini menjelaskan rancangan final **Go Backend API** untuk project **EMS Thermal LSTM**.

Backend berfungsi sebagai pusat integrasi antara:

1. Raspberry Pi gateway.
2. PostgreSQL database.
3. React dashboard.
4. Python ML Worker.
5. Telegram notification service.
6. Server-Sent Events realtime update.

Dokumen ini menjadi pegangan Codex agar endpoint, request/response, validasi, authentication, SSE event, dan error handling dibuat konsisten.

---

## 2. Prinsip Backend

Backend harus mengikuti prinsip berikut:

1. **Gateway-safe**  
   Endpoint gateway harus dilindungi dengan Bearer token.

2. **Dashboard-ready**  
   API harus mudah dipakai dashboard untuk card, chart, table, layout, settings, dan logs.

3. **ML-ready**  
   Backend/database harus mendukung hasil model, prediksi, metrics, dan status event history pada tabel internal `anomaly_events`.

4. **Validation first**  
   Semua input dari gateway dan dashboard harus divalidasi.

5. **Safe failure**  
   Kegagalan Telegram, SSE, atau data kosong tidak boleh membuat backend crash.

6. **Consistent response**  
   Format response sukses dan error harus konsisten.

7. **No overengineering**  
   Tidak perlu GraphQL, message broker, Kubernetes, atau auth kompleks pada versi skripsi.

---

## 3. Stack Backend

| Komponen | Teknologi |
|---|---|
| Bahasa | Go / Golang |
| HTTP Router | Chi atau Gin, pilih salah satu dan konsisten |
| Database Driver | pgx atau database/sql + lib/pq |
| Database | PostgreSQL |
| Realtime | Server-Sent Events |
| Config | `.env` |
| Migration | SQL migration |
| Notification | Telegram Bot API |
| Logging | structured logger sederhana |

Rekomendasi: gunakan stack yang sederhana dan mudah dijelaskan. Chi + pgx cukup baik untuk skripsi.

---

## 4. Base URL

Development base URL:

```text
http://localhost:8080/api/v1
```

Jika frontend berjalan di Vite:

```text
http://localhost:5173
```

Jika gateway Raspberry Pi mengirim ke laptop, gunakan IP laptop atau ZeroTier IP:

```text
http://<laptop-ip>:8080/api/v1
```

---

## 5. Standard Response Format

### 5.1 Success Response Object

```json
{
  "status": "success",
  "message": "Request processed successfully",
  "data": {}
}
```

### 5.2 Success Response List

```json
{
  "status": "success",
  "message": "Data retrieved successfully",
  "data": [],
  "meta": {
    "total": 0,
    "limit": 100,
    "offset": 0
  }
}
```

### 5.3 Error Response

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "field": ["error message"]
  }
}
```

### 5.4 Empty State

```json
{
  "status": "success",
  "message": "No data available",
  "data": [],
  "meta": {
    "total": 0
  }
}
```

---

## 6. HTTP Status Code

| Code | Penggunaan |
|---:|---|
| 200 | Request sukses |
| 201 | Data berhasil dibuat |
| 400 | Request format salah |
| 401 | Token tidak ada/tidak valid |
| 403 | Akses ditolak |
| 404 | Data tidak ditemukan |
| 409 | Konflik data |
| 422 | Validasi gagal |
| 500 | Error internal server |
| 503 | Service tidak tersedia, misalnya database down |

---

## 7. Authentication

### 7.1 Gateway Authentication

Endpoint gateway wajib memakai Bearer token:

```text
Authorization: Bearer <GATEWAY_TOKEN>
```

Endpoint yang wajib dilindungi:

```text
POST /api/v1/readings
POST /api/v1/gateway/status
```

Token disimpan melalui:

1. `.env` untuk development cepat.
2. Tabel `api_tokens` untuk desain final.

### 7.2 Dashboard Authentication

Dashboard versi skripsi tidak wajib login.

Jika waktu memungkinkan, login admin sederhana boleh dibuat, tetapi tidak menjadi prioritas.

### 7.3 ML Worker Authentication

ML Worker dapat membaca data PostgreSQL langsung untuk training dan inference input. Hasil inference final wajib dikirim ke backend melalui endpoint internal.

Endpoint berikut wajib memakai internal Bearer token:

```text
POST /api/v1/ml/predictions
```

### 7.4 Sensitive Write Authentication

Endpoint berikut wajib memakai simple admin/internal Bearer token:

```text
PUT  /api/v1/settings/{key}
PUT  /api/v1/model-versions/{id}/activate
POST /api/v1/layout/image
PUT  /api/v1/layout/devices/{sensorCode}
DELETE /api/v1/layout/devices/{sensorCode}
POST /api/v1/notifications/test
POST /api/v1/ml/predictions
```

---

## 8. Endpoint Overview

### 8.1 System

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/health` | Health check backend dan database |
| GET | `/events` | SSE realtime event stream |

### 8.2 Gateway

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/readings` | Menerima payload sensor dari gateway |
| POST | `/gateway/status` | Menerima status gateway/sensor |

### 8.3 Dashboard Summary

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/dashboard/summary` | Ringkasan dashboard utama |

### 8.3.1 Internal ML

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/ml/predictions` | Terima hasil inference, klasifikasi final, simpan event, emit SSE, dan proses Telegram |

### 8.4 Sensors & Readings

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/sensors` | Daftar sensor |
| GET | `/sensors/{sensorCode}` | Detail sensor |
| PUT | `/sensors/{sensorCode}` | Update metadata sensor; admin/internal token required |
| GET | `/readings/latest` | Data sensor terbaru |
| GET | `/readings/history` | Data historis sensor |

### 8.5 Prediction & LSTM

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/predictions/latest` | Prediksi terbaru |
| GET | `/predictions/history` | Riwayat prediksi |
| GET | `/model-versions` | Daftar model version |
| GET | `/model-versions/{id}` | Detail model version |
| PUT | `/model-versions/{id}/activate` | Aktifkan model |
| GET | `/model-metrics/latest` | Metrik model terbaru |
| GET | `/model-comparison/latest` | LSTM vs baseline |

### 8.6 Layout

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/layout` | Ambil layout aktif dan marker sensor |
| POST | `/layout/image` | Upload gambar layout |
| PUT | `/layout/devices/{sensorCode}` | Update posisi marker sensor |
| DELETE | `/layout/devices/{sensorCode}` | Hapus marker sensor dari layout |

### 8.7 Events & Logs

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/anomaly-events` | Riwayat event status/anomali |
| GET | `/notification-logs` | Riwayat Telegram notification |
| GET | `/system-logs` | Riwayat log sistem |

### 8.8 Settings

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/settings` | Ambil semua settings |
| PUT | `/settings/{key}` | Update setting tertentu |
| POST | `/notifications/test` | Test Telegram notification |
| GET | `/gateways` | Daftar gateway |

---

# 9. Detail Endpoint

---

## 9.1 GET `/health`

### Fungsi

Mengecek status backend dan database.

### Auth

Tidak wajib.

### Response 200

```json
{
  "status": "success",
  "message": "Service is healthy",
  "data": {
    "service": "ems-thermal-lstm-backend",
    "environment": "development",
    "database": "connected",
    "time": "2026-01-17T14:30:00+07:00"
  }
}
```

### Response 503

```json
{
  "status": "error",
  "message": "Database disconnected"
}
```

### Acceptance Criteria

| Kode | Kriteria |
|---|---|
| API-HEALTH-001 | Endpoint dapat diakses tanpa token |
| API-HEALTH-002 | Response menampilkan status backend |
| API-HEALTH-003 | Response menampilkan status database |
| API-HEALTH-004 | Jika DB down, response 503 |

---

## 9.2 POST `/readings`

### Fungsi

Menerima data sensor dari Raspberry Pi gateway.

### Auth

Wajib Bearer token.

### Request Header

```text
Authorization: Bearer <GATEWAY_TOKEN>
Content-Type: application/json
```

### Request Body

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

### Validasi

| Field | Rule |
|---|---|
| gateway_id | required, string |
| recorded_at | required, valid ISO timestamp |
| source | optional: hardware, simulator, replay |
| readings | required, array minimal 1 |
| sensor_code | required, S1 atau S2 |
| sensor_role | required, ambient atau hotspot |
| temperature | required, numeric, 0–80 |
| humidity | required, numeric, 0–100 |

Role rule:

```text
S1 harus ambient
S2 harus hotspot
```

### Response 201

```json
{
  "status": "success",
  "message": "Readings stored successfully",
  "data": {
    "gateway_id": "raspi-gateway-01",
    "stored_count": 2,
    "recorded_at": "2026-01-17T14:30:00+07:00"
  }
}
```

### Response 401

```json
{
  "status": "error",
  "message": "Unauthorized gateway token"
}
```

### Response 422

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "readings.0.temperature": ["temperature must be between 0 and 80"]
  }
}
```

### Backend Behavior

1. Validate token.
2. Validate payload.
3. Find gateway by `gateway_id`.
4. Find sensor by gateway and `sensor_code`.
5. Insert readings.
6. Update gateway `last_seen_at`.
7. Update sensor `last_seen_at`.
8. Update `sensor_health_status` if needed.
9. Emit SSE `reading.latest`.
10. Return response success.

### SSE Event

```text
event: reading.latest
```

Payload:

```json
{
  "gateway_id": "raspi-gateway-01",
  "recorded_at": "2026-01-17T14:30:00+07:00",
  "readings": {
    "S1": {
      "temperature": 27.4,
      "humidity": 63.2,
      "sensor_health_status": "normal",
      "recorded_at": "2026-01-17T14:30:00+07:00"
    },
    "S2": {
      "temperature": 30.8,
      "humidity": 58.5,
      "sensor_health_status": "normal",
      "recorded_at": "2026-01-17T14:30:00+07:00"
    }
  }
}
```

### Acceptance Criteria

| Kode | Kriteria |
|---|---|
| API-RD-001 | Request tanpa token ditolak |
| API-RD-002 | Token salah ditolak |
| API-RD-003 | Payload valid disimpan |
| API-RD-004 | Payload invalid ditolak 422 |
| API-RD-005 | S1/S2 tersimpan sebagai baris terpisah |
| API-RD-006 | Gateway dan sensor last_seen diperbarui |
| API-RD-007 | SSE reading.latest dikirim |

---

## 9.3 POST `/gateway/status`

### Fungsi

Menerima status gateway dan sensor trouble dari Raspberry Pi.

### Auth

Wajib Bearer token.

### Request Body

```json
{
  "gateway_id": "raspi-gateway-01",
  "status": "active",
  "reported_at": "2026-01-17T14:30:00+07:00",
  "message": "Gateway heartbeat",
  "sensors": [
    {
      "sensor_code": "S1",
      "status": "normal",
      "message": "Sensor readable"
    },
    {
      "sensor_code": "S2",
      "status": "trouble",
      "message": "Sensor timeout"
    }
  ]
}
```

### Response 200

```json
{
  "status": "success",
  "message": "Gateway status updated",
  "data": {
    "gateway_id": "raspi-gateway-01",
    "status": "active"
  }
}
```

### Backend Behavior

1. Validate token.
2. Update gateway status.
3. Insert `gateway_status_logs`.
4. Update sensor status if sensors array exists.
5. If sensor status trouble, insert system log.
6. Emit `gateway.status`.
7. Emit `sensor.trouble` if relevant.

### Acceptance Criteria

| Kode | Kriteria |
|---|---|
| API-GW-001 | Status gateway dapat diterima |
| API-GW-002 | Sensor trouble memperbarui status sensor |
| API-GW-003 | Gateway status log tersimpan |
| API-GW-004 | SSE gateway.status dikirim |
| API-GW-005 | SSE sensor.trouble dikirim jika ada trouble |

---

## 9.3.1 POST `/ml/predictions`

### Fungsi

Menerima hasil inference final dari ML Worker. Backend menjadi pemilik final status classification, anomaly event creation, SSE event, dan Telegram notification.

### Auth

Wajib Bearer internal token.

### Request Body

```json
{
  "model_version_id": 1,
  "prediction_run_id": 10,
  "target_sensor_code": "S2",
  "predicted_temperature": 31.4,
  "input_window_start_at": "2026-01-17T14:00:00+07:00",
  "input_window_end_at": "2026-01-17T14:30:00+07:00",
  "predicted_for": "2026-01-17T14:35:00+07:00"
}
```

### Backend Behavior

1. Validate internal token and payload.
2. Reject or mark duplicate prediction safely.
3. Determine `thermal_status`: `normal`, `waspada`, or `anomali`.
4. Read `sensor_health_status`: `normal`, `trouble`, or `inactive`.
5. Assemble `final_status` with priority `trouble > anomali > waspada > normal`.
6. Mark prediction stale when older than 10 minutes.
7. Save prediction.
8. If prediction is not stale, create anomaly event, emit SSE, and evaluate Telegram rule.
9. Stale prediction remains queryable in history but cannot drive active dashboard status or Telegram.

---

## 9.4 GET `/dashboard/summary`

### Fungsi

Mengambil ringkasan utama dashboard.

### Query Params

Opsional:

| Param | Keterangan |
|---|---|
| from | Awal rentang chart |
| to | Akhir rentang chart |

### Response 200

```json
{
  "status": "success",
  "message": "Dashboard summary retrieved",
  "data": {
    "gateway": {
      "gateway_code": "raspi-gateway-01",
      "status": "active",
      "last_seen_at": "2026-01-17T14:30:00+07:00"
    },
    "latest_readings": {
      "S1": {
        "sensor_code": "S1",
        "sensor_role": "ambient",
        "temperature": 27.4,
        "humidity": 63.2,
        "sensor_health_status": "normal",
        "quality_status": "valid",
        "recorded_at": "2026-01-17T14:30:00+07:00"
      },
      "S2": {
        "sensor_code": "S2",
        "sensor_role": "hotspot",
        "temperature": 30.8,
        "humidity": 58.5,
        "sensor_health_status": "normal",
        "quality_status": "valid",
        "recorded_at": "2026-01-17T14:30:00+07:00"
      }
    },
    "latest_prediction": {
      "id": 101,
      "target_sensor": "S2",
      "predicted_temperature": 31.4,
      "predicted_for": "2026-01-17T14:35:00+07:00",
      "thermal_status": "waspada",
      "final_status": "waspada",
      "model_version": "v1.0.0",
      "is_stale": false
    },
    "active_model": {
      "id": 1,
      "version": "v1.0.0",
      "trained_at": "2026-01-17T13:00:00+07:00"
    },
    "latest_metrics": {
      "rmse": 0.84,
      "mae": 0.62,
      "mape": 2.15
    },
    "today_summary": {
      "total_readings": 720,
      "total_waspada": 4,
      "total_anomali": 1,
      "total_alarm": 2,
      "total_pre_alarm": 3,
      "total_trouble": 0
    },
    "telegram": {
      "enabled": false,
      "last_status": "skipped"
    },
    "recent_events": []
  }
}
```

### Acceptance Criteria

| Kode | Kriteria |
|---|---|
| API-DS-001 | Summary menampilkan latest readings |
| API-DS-002 | Summary menampilkan latest prediction jika ada |
| API-DS-003 | Summary aman jika model belum tersedia |
| API-DS-004 | Summary aman jika data sensor kosong |
| API-DS-005 | Summary tidak query seluruh database tanpa limit |

---

## 9.5 GET `/events`

### Fungsi

SSE endpoint untuk realtime update dashboard.

### Auth

Tidak wajib untuk development.

### Response Header

```text
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Event Format

```text
event: reading.latest
data: {"...":"..."}

```

### Event Types

| Event | Fungsi |
|---|---|
| `reading.latest` | Data sensor terbaru |
| `gateway.status` | Status gateway |
| `sensor.trouble` | Sensor bermasalah |
| `prediction.latest` | Prediksi terbaru |
| `anomaly.created` | Event anomali/status |
| `notification.sent` | Notifikasi terkirim/gagal |
| `system.log` | Log sistem baru |

### Acceptance Criteria

| Kode | Kriteria |
|---|---|
| API-SSE-001 | SSE endpoint dapat diakses dashboard |
| API-SSE-002 | Client disconnect tidak membuat backend crash |
| API-SSE-003 | Event reading.latest terkirim setelah insert reading |
| API-SSE-004 | Event prediction.latest terkirim setelah prediksi baru |
| API-SSE-005 | Event anomaly.created terkirim jika ada event |

---

## 9.6 GET `/sensors`

### Fungsi

Mengambil daftar sensor.

### Response 200

```json
{
  "status": "success",
  "message": "Sensors retrieved",
  "data": [
    {
      "sensor_code": "S1",
      "sensor_role": "ambient",
      "name": "S1 Ambient Sensor",
      "type": "XY-MD02",
      "location": "Ambient area",
      "modbus_slave_id": 1,
      "sensor_health_status": "normal",
      "last_seen_at": "2026-01-17T14:30:00+07:00"
    }
  ]
}
```

---

## 9.7 PUT `/sensors/{sensorCode}`

### Fungsi

Update metadata sensor.

Allowed `sensorCode`:

```text
S1
S2
```

Request body:

```json
{
  "name": "S1 Ambient Sensor",
  "location": "Ambient rack area",
  "modbus_slave_id": 1,
  "sensor_health_status": "normal"
}
```

Acceptance criteria:

| Kode | Kriteria |
|---|---|
| API-SENS-001 | Sensor metadata dapat diupdate |
| API-SENS-002 | sensor_code tidak boleh diubah sembarangan |
| API-SENS-003 | sensor_health_status harus valid |
| API-SENS-004 | Sensor tidak ditemukan return 404 |

---

## 9.8 GET `/readings/latest`

### Fungsi

Mengambil data terbaru setiap sensor.

Response:

```json
{
  "status": "success",
  "message": "Latest readings retrieved",
  "data": {
    "S1": {
      "temperature": 27.4,
      "humidity": 63.2,
      "recorded_at": "2026-01-17T14:30:00+07:00",
      "sensor_health_status": "normal"
    },
    "S2": {
      "temperature": 30.8,
      "humidity": 58.5,
      "recorded_at": "2026-01-17T14:30:00+07:00",
      "sensor_health_status": "normal"
    }
  }
}
```

---

## 9.9 GET `/readings/history`

### Fungsi

Mengambil data historis sensor untuk tabel dan chart.

Query params:

| Param | Required | Keterangan |
|---|---|---|
| sensor_code | Tidak | S1, S2, atau kosong untuk all |
| from | Tidak | Awal waktu |
| to | Tidak | Akhir waktu |
| quality_status | Tidak | valid, invalid, timeout, simulated |
| limit | Tidak | default 500 |
| offset | Tidak | default 0 |

Response:

```json
{
  "status": "success",
  "message": "Reading history retrieved",
  "data": [
    {
      "sensor_code": "S1",
      "sensor_role": "ambient",
      "temperature": 27.4,
      "humidity": 63.2,
      "quality_status": "valid",
      "source": "hardware",
      "recorded_at": "2026-01-17T14:30:00+07:00"
    }
  ],
  "meta": {
    "limit": 500,
    "offset": 0,
    "total": 1
  }
}
```

Acceptance criteria:

| Kode | Kriteria |
|---|---|
| API-HIS-001 | Filter sensor_code bekerja |
| API-HIS-002 | Filter waktu bekerja |
| API-HIS-003 | Limit diterapkan |
| API-HIS-004 | Data diurutkan berdasarkan waktu |

---

## 9.10 GET `/predictions/latest`

Mengambil prediksi terbaru.

Response:

```json
{
  "status": "success",
  "message": "Latest prediction retrieved",
  "data": {
    "id": 101,
    "model_version": "v1.0.0",
    "target_sensor": "S2",
    "predicted_temperature": 31.4,
    "actual_temperature": null,
    "predicted_for": "2026-01-17T14:35:00+07:00",
    "thermal_status": "waspada",
    "final_status": "waspada",
    "threshold_normal_max": 30.0,
    "threshold_anomaly_min": 32.0,
    "is_stale": false,
    "created_at": "2026-01-17T14:30:00+07:00"
  }
}
```

If no prediction:

```json
{
  "status": "success",
  "message": "No prediction available",
  "data": null
}
```

---

## 9.11 GET `/predictions/history`

Query params:

| Param | Keterangan |
|---|---|
| from | Awal waktu |
| to | Akhir waktu |
| final_status | normal/waspada/anomali/trouble |
| limit | default 100 |
| offset | default 0 |

---

## 9.12 GET `/model-versions`

Mengambil daftar model version.

Response:

```json
{
  "status": "success",
  "message": "Model versions retrieved",
  "data": [
    {
      "id": 1,
      "model_name": "ems_s2_lstm",
      "version": "v1.0.0",
      "model_type": "LSTM",
      "window_size": 30,
      "horizon_minutes": 5,
      "is_active": true,
      "trained_at": "2026-01-17T13:00:00+07:00",
      "metrics": {
        "rmse": 0.84,
        "mae": 0.62,
        "mape": 2.15
      }
    }
  ]
}
```

---

## 9.13 PUT `/model-versions/{id}/activate`

### Fungsi

Mengaktifkan model version tertentu.

Behavior:

1. Cek model ada.
2. Set semua model `is_active = false`.
3. Set model target `is_active = true`.
4. Simpan system log.
5. Return model aktif.

Response:

```json
{
  "status": "success",
  "message": "Model activated successfully",
  "data": {
    "id": 1,
    "version": "v1.0.0",
    "is_active": true
  }
}
```

Acceptance criteria:

| Kode | Kriteria |
|---|---|
| API-MODEL-001 | Hanya satu model aktif setelah activate |
| API-MODEL-002 | Model tidak ditemukan return 404 |
| API-MODEL-003 | Aktivasi disimpan ke system log |

---

## 9.14 GET `/model-metrics/latest`

Mengambil metrik LSTM terbaru untuk model aktif.

Response:

```json
{
  "status": "success",
  "message": "Latest model metrics retrieved",
  "data": {
    "model_version": "v1.0.0",
    "rmse": 0.84,
    "mae": 0.62,
    "mape": 2.15,
    "dataset_start_at": "2026-01-17T08:00:00+07:00",
    "dataset_end_at": "2026-01-17T13:00:00+07:00",
    "train_size": 700,
    "validation_size": 150,
    "test_size": 150
  }
}
```

---

## 9.15 GET `/model-comparison/latest`

Mengambil perbandingan LSTM vs baseline untuk model aktif.

Response:

```json
{
  "status": "success",
  "message": "Model comparison retrieved",
  "data": {
    "model_version": "v1.0.0",
    "lstm": {
      "rmse": 0.84,
      "mae": 0.62,
      "mape": 2.15
    },
    "baselines": [
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
    ]
  }
}
```

---

## 9.16 GET `/layout`

Mengambil layout aktif dan marker sensor.

Response:

```json
{
  "status": "success",
  "message": "Layout retrieved",
  "data": {
    "layout": {
      "id": 1,
      "name": "Server Testbed Layout",
      "image_url": "/uploads/layouts/layout-1.png",
      "image_width": 1200,
      "image_height": 800
    },
    "devices": [
      {
        "sensor_code": "S1",
        "sensor_role": "ambient",
        "label": "S1 Ambient",
        "position_x": 0.25,
        "position_y": 0.40,
        "final_status": "normal",
        "temperature": 27.4,
        "humidity": 63.2,
        "last_seen_at": "2026-01-17T14:30:00+07:00"
      }
    ]
  }
}
```

If no layout:

```json
{
  "status": "success",
  "message": "No active layout available",
  "data": null
}
```

---

## 9.17 POST `/layout/image`

Upload gambar layout.

Content-Type:

```text
multipart/form-data
```

Fields:

| Field | Required | Keterangan |
|---|---|---|
| image | yes | File gambar PNG/JPG/WebP |
| name | no | Nama layout |

Behavior:

1. Validasi file.
2. Simpan file ke folder uploads.
3. Simpan record ke `layouts`.
4. Set layout baru sebagai active.
5. Return layout baru.

Acceptance criteria:

| Kode | Kriteria |
|---|---|
| API-LAY-001 | Upload gambar berhasil |
| API-LAY-002 | File non-gambar ditolak |
| API-LAY-003 | Layout aktif dapat diambil kembali |

---

## 9.18 PUT `/layout/devices/{sensorCode}`

Update posisi marker sensor.

Request body:

```json
{
  "label": "S2 Hotspot",
  "position_x": 0.72,
  "position_y": 0.55
}
```

Validasi:

| Field | Rule |
|---|---|
| sensorCode | S1 atau S2 |
| position_x | number 0–1 |
| position_y | number 0–1 |

---

## 9.19 GET `/anomaly-events`

Query params:

| Param | Keterangan |
|---|---|
| status | normal, waspada, anomali, trouble |
| from | awal waktu |
| to | akhir waktu |
| limit | default 100 |
| offset | default 0 |

Response item:

```json
{
  "id": 1,
  "sensor_code": "S2",
  "status": "anomali",
  "severity": "critical",
  "predicted_temperature": 33.2,
  "actual_temperature": null,
  "description": "Predicted S2 temperature exceeded anomaly threshold",
  "detected_at": "2026-01-17T14:30:00+07:00"
}
```

---

## 9.20 GET `/notification-logs`

Mengambil riwayat notifikasi Telegram.

Query:

| Param | Keterangan |
|---|---|
| status | pending/sent/failed/skipped |
| from | awal waktu |
| to | akhir waktu |
| limit | default 100 |

---

## 9.21 GET `/system-logs`

Mengambil log sistem.

Query:

| Param | Keterangan |
|---|---|
| source | backend/gateway/ml-worker/telegram/database |
| level | info/warning/error/critical |
| from | awal waktu |
| to | akhir waktu |
| limit | default 100 |

---

## 9.22 GET `/settings`

Mengambil semua settings.

Sensitive value harus dimasking.

Response:

```json
{
  "status": "success",
  "message": "Settings retrieved",
  "data": [
    {
      "key": "threshold_normal_max",
      "value": "30.0",
      "value_type": "number",
      "is_sensitive": false
    },
    {
      "key": "telegram_bot_token",
      "value": "********",
      "value_type": "string",
      "is_sensitive": true
    }
  ]
}
```

---

## 9.23 PUT `/settings/{key}`

Update setting.

Request:

```json
{
  "value": "32.0"
}
```

Rules:

1. Key harus ada.
2. Value divalidasi sesuai `value_type`.
3. Sensitive value boleh disimpan, tetapi response tetap masked.
4. Update dicatat di system log.

---

## 9.24 POST `/notifications/test`

Mengirim test Telegram notification.

Behavior:

1. Ambil Telegram settings.
2. Jika disabled, return skipped.
3. Jika enabled, kirim test message.
4. Simpan notification log.

Response success:

```json
{
  "status": "success",
  "message": "Test notification sent",
  "data": {
    "channel": "telegram",
    "status": "sent"
  }
}
```

Response skipped:

```json
{
  "status": "success",
  "message": "Telegram is disabled",
  "data": {
    "channel": "telegram",
    "status": "skipped"
  }
}
```

---

## 10. SSE Event Payload Detail

### 10.1 `reading.latest`

Dikirim setelah data sensor berhasil disimpan.

### 10.2 `gateway.status`

Dikirim setelah gateway mengirim heartbeat/status.

### 10.3 `sensor.trouble`

Dikirim jika sensor timeout atau trouble.

### 10.4 `prediction.latest`

Dikirim setelah prediksi baru dibuat.

### 10.5 `anomaly.created`

Dikirim setelah anomaly event dibuat.

### 10.6 `notification.sent`

Dikirim setelah proses Telegram selesai, baik sent, failed, atau skipped.

---

## 11. Backend Module Structure

```text
backend-go/
├── cmd/server/main.go
├── internal/
│   ├── config/
│   ├── database/
│   ├── handler/
│   │   ├── health_handler.go
│   │   ├── reading_handler.go
│   │   ├── gateway_handler.go
│   │   ├── dashboard_handler.go
│   │   ├── sensor_handler.go
│   │   ├── prediction_handler.go
│   │   ├── model_handler.go
│   │   ├── layout_handler.go
│   │   ├── event_handler.go
│   │   ├── settings_handler.go
│   │   └── notification_handler.go
│   ├── middleware/
│   │   ├── auth.go
│   │   ├── cors.go
│   │   └── logging.go
│   ├── model/
│   ├── repository/
│   ├── service/
│   ├── sse/
│   ├── telegram/
│   ├── validator/
│   └── logger/
├── migrations/
├── go.mod
└── README.md
```

---

## 12. Environment Variables

```env
APP_ENV=development
APP_PORT=8080
APP_BASE_URL=http://localhost:8080
FRONTEND_ORIGIN=http://localhost:5173

DATABASE_URL=postgres://ems_user:ems_password@localhost:5432/ems_thermal_lstm?sslmode=disable

GATEWAY_TOKEN=change-me
ADMIN_TOKEN=change-admin-token
INTERNAL_ML_TOKEN=change-internal-ml-token

TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_COOLDOWN_MINUTES=5

UPLOAD_DIR=./uploads
```

`GATEWAY_TOKEN` dipakai sebagai bootstrap awal. Backend menyimpan dan memvalidasi hash token pada tabel `api_tokens`. Full token tidak boleh ditampilkan melalui API atau UI.

Backend juga menjalankan offline checker setiap 30 detik. Gateway heartbeat dikirim setiap 60 detik. Sensor atau gateway berubah menjadi trouble jika tidak ada data lebih dari 5 menit.

---

## 13. Validation Rules Summary

### 13.1 Reading Validation

1. Temperature 0–80.
2. Humidity 0–100.
3. Sensor code S1/S2.
4. Role must match sensor code.
5. recorded_at valid timestamp.
6. gateway_id not empty.

### 13.2 Layout Validation

1. Image type allowed: PNG, JPG, JPEG, WebP.
2. position_x 0–1.
3. position_y 0–1.
4. sensorCode S1/S2.

### 13.3 Settings Validation

1. Numeric setting harus numeric.
2. Boolean setting harus boolean.
3. Sensitive value tidak ditampilkan penuh.
4. Threshold normal max harus lebih kecil dari anomaly min.

---

## 14. Error Handling Rules

1. Jangan panic pada request invalid.
2. Return 422 untuk validation error.
3. Return 401 untuk token invalid.
4. Return 404 untuk resource tidak ditemukan.
5. Return 503 jika database tidak tersedia.
6. Telegram error dicatat sebagai failed notification log.
7. SSE disconnect tidak dianggap fatal.
8. Semua error penting dicatat ke `system_logs`.

---

## 15. Backend Acceptance Criteria

| Kode | Kriteria |
|---|---|
| BE-FINAL-001 | Backend dapat build dan run |
| BE-FINAL-002 | Health check berjalan |
| BE-FINAL-003 | Migration database dapat dijalankan |
| BE-FINAL-004 | Gateway token auth berjalan |
| BE-FINAL-005 | POST readings valid tersimpan |
| BE-FINAL-006 | POST readings invalid ditolak |
| BE-FINAL-007 | Latest readings berjalan |
| BE-FINAL-008 | History readings berjalan |
| BE-FINAL-009 | Dashboard summary berjalan |
| BE-FINAL-010 | SSE berjalan |
| BE-FINAL-011 | Prediction endpoint berjalan |
| BE-FINAL-012 | Model activation berjalan |
| BE-FINAL-013 | Layout upload dan marker berjalan |
| BE-FINAL-014 | Events/logs endpoint berjalan |
| BE-FINAL-015 | Settings endpoint berjalan |
| BE-FINAL-016 | Telegram test berjalan atau skipped dengan aman |
| BE-FINAL-017 | Error response konsisten |
| BE-FINAL-018 | Backend tidak crash saat Telegram gagal |
| BE-FINAL-019 | Internal ML prediction endpoint dilindungi token |
| BE-FINAL-020 | Prediction stale setelah 10 menit tidak memicu status aktif atau Telegram |
| BE-FINAL-021 | Sensitive write endpoint dilindungi admin/internal token |

---

## 16. Instruksi untuk Codex

Saat membuat backend, Codex harus:

1. Mengikuti endpoint dalam dokumen ini.
2. Tidak membuat endpoint PUE atau energy optimization.
3. Tidak membuat auth kompleks kecuali diminta.
4. Membuat response format konsisten.
5. Membuat validator untuk payload penting.
6. Membuat middleware gateway auth.
7. Membuat SSE hub sederhana.
8. Membuat repository layer, bukan query di handler.
9. Membuat README backend.
10. Menyediakan contoh curl untuk endpoint utama.
11. Menjalankan build/test setelah milestone backend.
## Alert Category Documentation Lock Addendum

Kontrak event dashboard dan `/anomaly-events` wajib menyertakan `event_type`. Mapping kategori:

| `event_type` | Kategori UI | Sumber |
|---|---|---|
| `actual_threshold` | Alarm | Reading aktual S1/S2 |
| `prediction_threshold` | Pre-Alarm | Prediksi S2 non-stale |
| `sensor_trouble` | Trouble | Status/timeout sensor |
| `gateway_trouble` | Trouble | Status/timeout gateway |

Status `normal` setelah status non-normal ditampilkan sebagai Recovery. Backend membuat event dan `anomaly.created` hanya pada transisi atau eskalasi.

`today_summary.total_pre_alarm` adalah indikator aktif 0/1, bukan jumlah histori harian. Nilainya 1 hanya jika terdapat prediksi S2 non-stale berstatus waspada/anomali dengan `predicted_for` masih lebih besar dari waktu sekarang.

Dashboard summary juga mengembalikan `active_pre_alarm`, yaitu prediksi threshold masa depan terbaru. Prediksi threshold yang lebih baru menggantikan nilai sebelumnya. Prediksi normal tidak menghapus Pre-Alarm lama sebelum waktu targetnya lewat; setelah `predicted_for <= now`, nilai menjadi `null`.

Dashboard summary mengembalikan `active_events` untuk kondisi Alarm/Trouble yang status terakhirnya masih non-normal. Recovery tetap berada di `recent_events` dan `/anomaly-events`, tetapi tidak masuk `active_events`.

`GET /layout` menghitung `final_status` setiap marker dari kesehatan sensor dan suhu aktual terbaru untuk S1 maupun S2: trouble bila health tidak normal, selain itu normal/waspada/anomali berdasarkan threshold aktif. Prediction/Pre-Alarm tidak mengubah `final_status` marker.
