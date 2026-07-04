# 02 Hardware and Gateway Final — EMS Thermal LSTM

## 1. Tujuan Dokumen

Dokumen ini menjelaskan rancangan final hardware dan gateway untuk project **EMS Thermal LSTM**.

Dokumen ini menjadi pegangan Codex saat membuat modul gateway Raspberry Pi agar implementasi:

1. Berorientasi pada sensor asli.
2. Tetap aman untuk Raspberry Pi 3.
3. Memiliki diagnostic mode untuk pengujian hardware awal.
4. Menggunakan Modbus RTU over RS485.
5. Mengirim data ke EMS backend secara periodik.
6. Memiliki retry dan local buffer yang terbatas.
7. Tidak melakukan training LSTM di gateway.
8. Tidak melebar menjadi sistem gateway enterprise.

---

## 2. Kondisi Awal Hardware

Kondisi awal yang diketahui:

| Komponen | Status |
|---|---|
| Laptop development | Tersedia dan digunakan untuk development |
| Raspberry Pi 3 | Tersedia |
| Raspberry Pi OS | Ubuntu/Debian CLI, belum dikonfirmasi detail versinya |
| SSH Raspberry Pi | Sudah bisa diakses |
| Sensor XY-MD02 | 2 unit tersedia |
| USB RS485 adapter | Tersedia |
| Kabel RS485/UTP/AWG | Tersedia |
| Pengujian RS485 | Belum dilakukan |
| Pengujian sensor XY-MD02 | Belum dilakukan |
| Slave ID sensor | Belum dikonfirmasi |
| Register suhu/kelembaban | Belum dikonfirmasi |

Karena sensor dan RS485 belum diuji, gateway **wajib** memiliki diagnostic mode sebelum service utama dijalankan.

---

## 3. Peran Hardware dalam Sistem

```text
[Sensor XY-MD02 S1 Ambient]
            |
            | RS485 A/B
            |
[Sensor XY-MD02 S2 Hotspot]
            |
            | RS485 A/B
            v
[USB RS485 Adapter]
            |
            | USB
            v
[Raspberry Pi 3 Gateway]
            |
            | HTTP REST JSON
            v
[EMS Backend di Laptop]
```

Raspberry Pi tidak menjalankan database, dashboard, atau training LSTM. Raspberry Pi hanya berperan sebagai **gateway akuisisi data sensor**.

---

## 4. Penempatan Sensor

### 4.1 Sensor S1 — Ambient / Reference

S1 digunakan sebagai sensor referensi lingkungan.

Rekomendasi penempatan:

- Tidak terlalu dekat dengan sumber panas langsung.
- Diletakkan pada area sekitar server testbed.
- Mewakili kondisi udara sekitar.

Data S1 digunakan sebagai fitur input LSTM, bukan target utama prediksi.

### 4.2 Sensor S2 — Hotspot / Exhaust

S2 digunakan sebagai sensor utama untuk area panas.

Rekomendasi penempatan:

- Dekat area exhaust laptop/server testbed.
- Dekat area yang diperkirakan mengalami kenaikan suhu lebih cepat.
- Tidak menempel langsung pada komponen panas agar pembacaan tetap merepresentasikan suhu lingkungan sekitar hotspot.

Data suhu S2 digunakan sebagai **target prediksi LSTM**.

---

## 5. Topologi RS485

Sensor XY-MD02 menggunakan komunikasi **Modbus RTU over RS485**.

Koneksi umum:

```text
Sensor S1 A  ─┐
Sensor S2 A  ─┼── RS485 A pada USB RS485 Adapter
              |
Sensor S1 B  ─┐
Sensor S2 B  ─┼── RS485 B pada USB RS485 Adapter
```

Catatan:

1. Pastikan polaritas A/B sesuai adapter yang digunakan.
2. Beberapa adapter memberi label D+ dan D- bukan A dan B.
3. Jika pembacaan gagal, salah satu kemungkinan adalah kabel A/B tertukar.
4. Jika sensor membutuhkan power eksternal, pastikan tegangan sesuai spesifikasi sensor.
5. Jika sensor berada pada bus yang sama, masing-masing sensor harus memiliki slave ID berbeda.

---

## 6. Parameter Modbus Awal

Parameter awal gateway:

| Parameter | Nilai Awal |
|---|---|
| Protocol | Modbus RTU |
| Serial port Linux | `/dev/ttyUSB0` |
| Baudrate | 9600 |
| Data bits | 8 |
| Parity | None / `N` |
| Stop bits | 1 |
| Timeout | 3 detik |
| S1 slave ID | 1, sementara |
| S2 slave ID | 2, sementara |

Nilai slave ID dan register harus dapat diubah melalui config file tanpa mengubah kode program.

---

## 7. Register Sensor

Karena register XY-MD02 dapat berbeda tergantung modul/datasheet, gateway tidak boleh hardcode register secara kaku.

Gunakan konfigurasi seperti berikut:

```yaml
sensors:
  - code: "S1"
    role: "ambient"
    slave_id: 1
    registers:
      temperature:
        address: 1
        count: 1
        scale: 0.1
      humidity:
        address: 2
        count: 1
        scale: 0.1

  - code: "S2"
    role: "hotspot"
    slave_id: 2
    registers:
      temperature:
        address: 1
        count: 1
        scale: 0.1
      humidity:
        address: 2
        count: 1
        scale: 0.1
```

Jika hasil pembacaan tidak sesuai, lakukan diagnostic raw register untuk mencari address yang benar.

---

## 8. Gateway Software Stack

Gateway dibuat menggunakan Python.

Rekomendasi library:

| Library | Fungsi |
|---|---|
| `pymodbus` | Membaca sensor Modbus RTU |
| `httpx` atau `requests` | Mengirim HTTP request ke backend |
| `PyYAML` | Membaca config YAML |
| `python-dotenv` | Membaca `.env` jika diperlukan |
| `pydantic` atau dataclass | Validasi struktur config/payload |
| `logging` | Logging gateway |
| `pyserial` | Serial port support |

Gateway harus dapat berjalan pada Raspberry Pi 3 dengan resource ringan.

---

## 9. Struktur Folder Gateway

Struktur folder gateway final:

```text
gateway-rpi/
├── src/
│   ├── gateway/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models.py
│   │   ├── modbus_client.py
│   │   ├── sensor_reader.py
│   │   ├── validator.py
│   │   ├── payload_builder.py
│   │   ├── http_sender.py
│   │   ├── buffer.py
│   │   ├── diagnostics.py
│   │   ├── status_reporter.py
│   │   ├── logger.py
│   │   └── cli.py
├── config.example.yaml
├── .env.example
├── requirements.txt
├── README.md
├── logs/
│   └── gateway.log
└── data/
    └── failed_payloads.jsonl
```

Catatan:

- Folder `gateway-rpi/` adalah gateway hardware asli.
- Jangan menjadikan simulator sebagai gateway utama.
- Simulator jika dibuat harus terpisah dan hanya alat bantu development.

---

## 10. File Konfigurasi Gateway

### 10.1 `config.example.yaml`

```yaml
gateway:
  id: "raspi-gateway-01"
  name: "Raspberry Pi Gateway 01"
  mode: "hardware"
  location: "Server Testbed"

backend:
  base_url: "http://192.168.1.100:8080/api/v1"
  readings_endpoint: "/readings"
  status_endpoint: "/gateway/status"
  token: "change-me"
  timeout_seconds: 5
  retry_count: 1
  retry_delay_seconds: 2

sampling:
  interval_seconds: 10

modbus:
  port: "/dev/ttyUSB0"
  baudrate: 9600
  bytesize: 8
  parity: "N"
  stopbits: 1
  timeout_seconds: 3

sensors:
  - code: "S1"
    role: "ambient"
    name: "S1 Ambient Sensor"
    enabled: true
    slave_id: 1
    registers:
      temperature:
        address: 1
        count: 1
        scale: 0.1
      humidity:
        address: 2
        count: 1
        scale: 0.1

  - code: "S2"
    role: "hotspot"
    name: "S2 Hotspot Sensor"
    enabled: true
    slave_id: 2
    registers:
      temperature:
        address: 1
        count: 1
        scale: 0.1
      humidity:
        address: 2
        count: 1
        scale: 0.1

validation:
  temperature_min: 0
  temperature_max: 80
  humidity_min: 0
  humidity_max: 100

buffer:
  enabled: true
  file_path: "./data/failed_payloads.jsonl"
  max_items: 1000
  replay_enabled: true
  replay_batch_size: 5
  replay_interval_seconds: 60

logging:
  level: "INFO"
  file_path: "./logs/gateway.log"
```

### 10.2 `.env.example`

```env
GATEWAY_CONFIG=./config.yaml
BACKEND_TOKEN=change-me
BACKEND_BASE_URL=http://192.168.1.100:8080/api/v1
MODBUS_PORT=/dev/ttyUSB0
```

`.env` digunakan untuk override value sensitif seperti token.

### 10.3 Documentation Lock Configuration

1. Token gateway awal berasal dari `.env`.
2. Backend menyimpan dan memvalidasi hash token pada tabel `api_tokens`.
3. Full token tidak boleh ditampilkan di UI atau log.
4. Gateway mengirim heartbeat ke `POST /api/v1/gateway/status` setiap 60 detik.
5. Heartbeat terpisah dari pengiriman readings 10 detik.

---

## 11. Payload Gateway ke EMS

### 11.1 Payload Readings

Endpoint tujuan:

```http
POST /api/v1/readings
```

Header:

```text
Authorization: Bearer <GATEWAY_TOKEN>
Content-Type: application/json
```

Body:

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

### 11.2 Payload Gateway/Sensor Status

Endpoint tujuan:

```http
POST /api/v1/gateway/status
```

Body:

```json
{
  "gateway_id": "raspi-gateway-01",
  "status": "active",
  "reported_at": "2026-01-17T14:30:00+07:00",
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

Status payload digunakan ketika sensor timeout, sensor tidak terbaca, atau gateway ingin mengirim heartbeat/status.

---

## 12. Runtime Flow Gateway

### 12.1 Flow Utama

```text
Start Gateway
    ↓
Load config
    ↓
Initialize logger
    ↓
Initialize Modbus client
    ↓
Loop every sampling interval
    ↓
Read S1
    ↓
Read S2
    ↓
Validate readings
    ↓
Build payload
    ↓
Send payload to EMS backend
    ↓
If send success: continue
    ↓
If send failed: retry once
    ↓
If retry failed: write to local bounded buffer
    ↓
Replay old buffer slowly if backend reachable
    ↓
Sleep until next interval
```

### 12.2 Important Runtime Rules

1. Gateway tidak boleh berhenti hanya karena satu sensor gagal.
2. Jika satu sensor gagal, sensor lain tetap dikirim jika valid.
3. Jika S2 gagal terbaca, gateway harus mengirim status trouble.
4. Jika backend offline, gateway tetap membaca sensor.
5. Gateway tidak boleh melakukan retry tanpa batas.
6. Replay buffer tidak boleh menghambat data realtime terbaru.
7. Payload harus memiliki timestamp saat pembacaan sensor dilakukan.
8. Log error harus jelas dan disimpan lokal.
9. Heartbeat gateway dikirim setiap 60 detik.
10. Simulator hanya helper development dan bukan sumber bukti akhir skripsi.

---

## 13. Delivery Strategy

Gateway menggunakan strategi delivery berikut:

| Kondisi | Aksi |
|---|---|
| Request sukses | Lanjut loop berikutnya |
| Request timeout/gagal | Retry 1x setelah delay pendek |
| Retry gagal | Simpan payload ke buffer lokal |
| Backend kembali online | Replay buffer perlahan |
| Buffer penuh | Drop payload tertua dan catat warning |

Default:

| Parameter | Nilai |
|---|---:|
| HTTP timeout | 5 detik |
| Retry count | 1 |
| Retry delay | 2 detik |
| Max buffer items | 1000 payload |
| Replay batch size | 5 payload |
| Replay interval | 60 detik |

Alasan:

- Menghindari data hilang total saat backend offline.
- Tidak membebani Raspberry Pi dengan retry agresif.
- Tetap memprioritaskan data realtime terbaru.
- Menjaga dataset time-series agar tidak terlalu banyak bolong.

---

## 14. Diagnostic Mode

Diagnostic mode wajib karena sensor dan RS485 belum pernah diuji.

### 14.1 Tujuan Diagnostic Mode

Diagnostic mode digunakan untuk:

1. Mengecek serial port yang tersedia.
2. Mengecek apakah USB RS485 terbaca.
3. Menguji koneksi Modbus ke sensor.
4. Membaca raw register.
5. Mencari register suhu dan kelembaban yang benar.
6. Menguji slave ID S1 dan S2.
7. Menguji pengiriman payload ke backend.

### 14.2 Command Diagnostic Minimal

```bash
python -m gateway.cli diagnose ports
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
python -m gateway.cli diagnose sensor --sensor-code S1
python -m gateway.cli send-test
python -m gateway.cli run
```

Variasi `--slave-id 2` dan `--sensor-code S2` tetap dipakai pada hardware test plan untuk memverifikasi sensor kedua.

### 14.3 Output Diagnostic

Output harus jelas, misalnya:

```text
Serial ports detected:
- /dev/ttyUSB0

Reading raw register:
slave_id=1 address=1 count=2
raw=[274, 632]
scaled temperature=27.4
scaled humidity=63.2
```

Jika gagal:

```text
ERROR: Failed to read slave_id=1 address=1 count=2
Possible causes:
- wrong serial port
- wrong slave ID
- wrong baudrate
- A/B cable reversed
- sensor not powered
- wrong register address
```

---

## 15. Data Validation Gateway

Gateway melakukan validasi awal sebelum mengirim data ke backend.

| Field | Rule |
|---|---|
| sensor_code | Harus S1 atau S2 |
| sensor_role | S1 = ambient, S2 = hotspot |
| temperature | Numeric, 0 sampai 80 |
| humidity | Numeric, 0 sampai 100 |
| recorded_at | Timestamp valid |
| gateway_id | Tidak boleh kosong |

Jika data invalid:

1. Jangan dikirim sebagai reading valid.
2. Catat log warning/error.
3. Jika sensor gagal, kirim status trouble.
4. Jika hanya satu sensor valid, sensor valid tetap boleh dikirim.

---

## 16. Sensor Trouble Handling

Sensor dianggap trouble jika:

1. Sensor timeout.
2. Sensor tidak merespons Modbus.
3. Data kosong.
4. Data tidak numeric.
5. Temperature di luar 0–80°C.
6. Humidity di luar 0–100%.
7. Sensor tidak mengirim data lebih dari batas timeout sistem.

Default:

| Kondisi | Rule |
|---|---|
| Warning missing data | Tidak ada data lebih dari 2x interval |
| Trouble | Tidak ada data lebih dari 5 menit |

Gateway harus mengirim status trouble ke EMS jika S2 atau S1 gagal terbaca.

---

## 17. Backend Connectivity

Gateway harus dapat mengecek apakah backend reachable.

Minimal:

```http
GET /api/v1/health
```

Aturan:

1. Jika health check sukses, gateway boleh replay buffer.
2. Jika health check gagal, gateway tetap membaca sensor.
3. Gateway tidak boleh crash jika backend offline.
4. Backend URL harus dapat diubah dari config.

---

## 18. Logging Gateway

Gateway wajib menulis log lokal.

Log minimal:

1. Gateway started.
2. Config loaded.
3. Serial port used.
4. Sensor read success.
5. Sensor read failed.
6. Payload sent success.
7. Payload send failed.
8. Payload buffered.
9. Buffer replay success.
10. Buffer replay failed.
11. Sensor trouble status sent.

Format log rekomendasi:

```text
2026-01-17 14:30:00 INFO gateway started
2026-01-17 14:30:10 INFO read success sensor=S1 temp=27.4 hum=63.2
2026-01-17 14:30:10 ERROR read failed sensor=S2 message="timeout"
2026-01-17 14:30:10 WARNING status sent sensor=S2 status=trouble
```

---

## 19. Security dan Configuration Safety

1. API token tidak boleh ditulis hardcoded di source code.
2. Token disimpan di `.env` atau config lokal yang tidak di-commit.
3. `config.example.yaml` boleh di-commit.
4. `config.yaml` asli tidak boleh di-commit.
5. Log tidak boleh menampilkan full token.
6. Gateway harus menggunakan Authorization Bearer token.

---

## 20. Raspberry Pi Setup Checklist

Checklist setup Raspberry Pi:

```text
[ ] Raspberry Pi dapat diakses via SSH
[ ] Python 3 tersedia
[ ] pip tersedia
[ ] git tersedia
[ ] USB RS485 terpasang
[ ] /dev/ttyUSB0 atau serial port lain terdeteksi
[ ] User memiliki permission untuk akses serial port
[ ] requirements.txt gateway terinstall
[ ] config.yaml dibuat dari config.example.yaml
[ ] BACKEND_BASE_URL mengarah ke laptop EMS
[ ] GATEWAY_TOKEN sesuai token di EMS backend
[ ] diagnose ports berhasil
[ ] diagnose raw register berhasil
[ ] diagnose sensor S1 berhasil
[ ] diagnose sensor S2 berhasil
[ ] send-test ke backend berhasil
[ ] gateway service berjalan periodik
```

Command umum:

```bash
ls /dev/ttyUSB*
python3 --version
pip3 --version
sudo usermod -aG dialout $USER
```

Setelah menambahkan user ke group `dialout`, logout/login ulang atau reboot Raspberry Pi.

---

## 21. Systemd Service

Gateway sebaiknya dapat dijalankan sebagai systemd service setelah diagnostic berhasil.

Contoh service:

```ini
[Unit]
Description=EMS Thermal LSTM Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/ems-thermal-lstm/gateway-rpi
ExecStart=/usr/bin/python3 -m gateway.cli run --config ./config.yaml
Restart=always
RestartSec=5
User=pi
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Catatan:

- Nama user bisa berbeda tergantung OS.
- Path final disesuaikan saat deployment.
- Service hanya dipasang setelah test manual berhasil.

---

## 22. Gateway API Contract

Gateway hanya perlu mengetahui endpoint berikut:

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v1/health` | Mengecek backend |
| POST | `/api/v1/readings` | Mengirim data sensor |
| POST | `/api/v1/gateway/status` | Mengirim status gateway/sensor |

Gateway tidak perlu mengakses endpoint dashboard, prediction, model, layout, atau settings kecuali ada kebutuhan lanjutan.

---

## 23. Hardware Test Plan Ringkas

### 23.1 Test Serial Port

Langkah:

```bash
ls /dev/ttyUSB*
python -m gateway.cli diagnose ports
```

Expected:

```text
/dev/ttyUSB0 terdeteksi
```

### 23.2 Test Raw Register S1

Langkah:

```bash
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
```

Expected:

```text
Raw register terbaca atau error jelas ditampilkan
```

### 23.3 Test Raw Register S2

Langkah:

```bash
python -m gateway.cli diagnose raw --slave-id 2 --address 1 --count 2
```

Expected:

```text
Raw register terbaca atau error jelas ditampilkan
```

### 23.4 Test Sensor Payload

Langkah:

```bash
python -m gateway.cli diagnose sensor --sensor-code S1
python -m gateway.cli diagnose sensor --sensor-code S2
```

Expected:

```text
Temperature dan humidity tampil dalam satuan yang masuk akal
```

### 23.5 Test Send to Backend

Langkah:

```bash
python -m gateway.cli send-test
```

Expected:

```text
Backend mengembalikan response success dan stored_count > 0
```

---

## 24. Batasan Gateway

Gateway tidak boleh melakukan:

1. Training LSTM.
2. Inference LSTM.
3. Penyimpanan utama ke database.
4. Visualisasi dashboard utama.
5. Pengolahan model.
6. Perhitungan RMSE/MAE/MAPE.
7. PUE calculation.
8. Kontrol kipas/AC/relay.
9. Optimasi energi.
10. Gateway enterprise multi-device kompleks.

---

## 25. Acceptance Criteria Final Gateway

| Kode | Kriteria |
|---|---|
| GW-FINAL-001 | Gateway dapat membaca config YAML |
| GW-FINAL-002 | Gateway dapat mendeteksi serial port |
| GW-FINAL-003 | Gateway dapat membaca raw register Modbus |
| GW-FINAL-004 | Gateway dapat membaca sensor S1 |
| GW-FINAL-005 | Gateway dapat membaca sensor S2 |
| GW-FINAL-006 | Gateway membentuk payload sesuai API EMS |
| GW-FINAL-007 | Gateway mengirim payload dengan Bearer token |
| GW-FINAL-008 | Gateway retry hanya 1 kali saat gagal kirim |
| GW-FINAL-009 | Gateway menyimpan payload gagal ke bounded buffer |
| GW-FINAL-010 | Gateway replay buffer secara throttled |
| GW-FINAL-011 | Gateway tetap berjalan jika backend offline |
| GW-FINAL-012 | Gateway tetap berjalan jika salah satu sensor gagal |
| GW-FINAL-013 | Gateway mengirim status trouble saat sensor bermasalah |
| GW-FINAL-014 | Gateway menulis log lokal |
| GW-FINAL-015 | Gateway dapat dijalankan manual dan sebagai service |

---

## 26. Instruksi untuk Codex

Saat membuat gateway, Codex harus:

1. Membuat gateway hardware-first.
2. Membuat diagnostic mode sebelum service utama dianggap selesai.
3. Tidak mengandalkan simulator sebagai jalur utama.
4. Tidak hardcode slave ID dan register.
5. Tidak hardcode backend URL dan token.
6. Menggunakan config YAML dan env override.
7. Menjaga gateway tetap ringan untuk Raspberry Pi 3.
8. Membatasi retry dan buffer.
9. Menulis README setup Raspberry Pi.
10. Menyediakan command test hardware yang jelas.
11. Menyediakan contoh systemd service.
12. Tidak membuat UI gateway besar sebelum fitur utama stabil.
