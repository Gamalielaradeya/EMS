# M10B Hardware Validation Log - EMS Thermal LSTM

## Status

**Blocked - waiting hardware access**

Raspberry Pi 3, USB RS485 adapter, and two XY-MD02 sensors are not physically
available during this validation run. Hardware success is not claimed.

## Laptop EMS Preparation Result

| Item | Result |
|---|---|
| Repository gate | Passed: Milestone `10A` done and working tree clean |
| PostgreSQL | Passed: Docker PostgreSQL started on host port `55432` |
| Database schema | Passed: migrations and seed applied to `ems_thermal_lstm` |
| Backend | Passed: built and started on `APP_PORT=8081` |
| Local health | Passed: `GET http://localhost:8081/api/v1/health` |
| ZeroTier health | Passed: `GET http://10.147.17.201:8081/api/v1/health` |
| Alternate ZeroTier health | Passed: `GET http://10.147.20.201:8081/api/v1/health` |
| Frontend | Passed: started locally on `http://localhost:5173` |

Laptop Wi-Fi address `10.32.227.194` was detected, but health access on port
`8081` timed out from the laptop-side probe. Use a verified ZeroTier address
for Raspberry Pi configuration unless local firewall/network settings are
changed and retested.

## Blocker

- Raspberry Pi hardware is not physically available.
- No current Raspberry Pi SSH target can be reached.
- Previously seen SSH trace `root@192.168.1.110` timed out and is not accepted
  as the current Pi address.
- `raspberrypi.local` does not resolve on the laptop.

## Hardware Commands Not Run

No Raspberry Pi hardware command was run:

```bash
cat /etc/os-release
python3 --version
git --version
ls /dev/ttyUSB*
id
groups
python -m gateway.cli diagnose ports
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
python -m gateway.cli diagnose raw --slave-id 2 --address 1 --count 2
python -m gateway.cli diagnose sensor --sensor-code S1
python -m gateway.cli diagnose sensor --sensor-code S2
python -m gateway.cli send-test
python -m gateway.cli run
```

No RS485 polarity, sensor power, slave-ID, baudrate, or register-address change
was attempted.

## Resume Checklist

### 1. Make Hardware Available

- [ ] Power Raspberry Pi 3.
- [ ] Connect Raspberry Pi to LAN or ZeroTier.
- [ ] Connect USB RS485 adapter.
- [ ] Wire powered XY-MD02 sensors to RS485 A/B bus.
- [ ] Provide current SSH target as `user@host`.

### 2. Prepare Laptop EMS

From repository root:

```powershell
$env:POSTGRES_PORT = "55432"
docker compose up -d postgres
./scripts/run-migrations-docker.ps1

$env:DATABASE_URL = "postgres://ems_user:change-postgres-password@localhost:55432/ems_thermal_lstm?sslmode=disable"
$env:GATEWAY_TOKEN = "<local-gateway-token>"
$env:APP_PORT = "8081"
cd backend-go
go run ./cmd/server
```

Start frontend in another terminal:

```powershell
cd frontend-dashboard
$env:VITE_API_BASE_URL = "http://localhost:8081/api/v1"
$env:VITE_SSE_URL = "http://localhost:8081/api/v1/events"
npm run dev -- --host localhost --port 5173
```

Use this backend URL from Raspberry Pi unless a retested LAN address is
preferred:

```text
http://10.147.17.201:8081/api/v1
```

### 3. Confirm Raspberry Pi Environment

After SSH access:

```bash
cat /etc/os-release
python3 --version
git --version
ls -l /dev/ttyUSB*
id
groups
```

- [ ] Record OS information.
- [ ] Record Python version.
- [ ] Record git version.
- [ ] Record detected serial port.
- [ ] Confirm user has serial permission, normally through `dialout`.

If required:

```bash
sudo usermod -aG dialout "$USER"
```

Log out and back in before retesting serial access.

### 4. Prepare Gateway Package on Raspberry Pi

```bash
cd /path/to/EMS/gateway-rpi
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp config.example.yaml config.yaml
```

Edit ignored local `config.yaml` or `.env`:

```text
BACKEND_BASE_URL=http://10.147.17.201:8081/api/v1
BACKEND_TOKEN=<matching-local-gateway-token>
MODBUS_PORT=/dev/ttyUSB0
```

Keep initial slave IDs:

```text
S1 = 1
S2 = 2
```

Do not commit `config.yaml`, `.env`, tokens, logs, buffer data, or virtual
environment files.

### 5. Run Diagnostics

```bash
source .venv/bin/activate
python -m gateway.cli diagnose ports --config ./config.yaml
python -m gateway.cli diagnose raw --config ./config.yaml --slave-id 1 --address 1 --count 2
python -m gateway.cli diagnose raw --config ./config.yaml --slave-id 2 --address 1 --count 2
python -m gateway.cli diagnose sensor --config ./config.yaml --sensor-code S1
python -m gateway.cli diagnose sensor --config ./config.yaml --sensor-code S2
```

- [ ] Save SSH output.
- [ ] Save `/dev/ttyUSB*` evidence.
- [ ] Save port discovery output.
- [ ] Save raw S1/S2 register output.
- [ ] Save configured S1/S2 diagnostic output.

If reads fail, record exact error before changing anything. Check, in order:

1. USB serial port.
2. RS485 A/B polarity.
3. Sensor power.
4. Slave ID.
5. Baudrate.
6. Register address.

Record every attempted change and result in this file.

### 6. Validate Delivery

```bash
python -m gateway.cli send-test --config ./config.yaml
python -m gateway.cli run --config ./config.yaml
```

- [ ] Capture `send-test` success response.
- [ ] Run loop for at least 3-5 minutes.
- [ ] Stop gateway safely with `Ctrl+C`.
- [ ] Capture gateway logs showing hardware send success.
- [ ] Confirm `GET /api/v1/readings/latest` returns S1 and S2.
- [ ] Capture database row-count sample.
- [ ] Confirm dashboard realtime update.
- [ ] Confirm `reading.latest` and `gateway.status` SSE behavior.
- [ ] Capture dashboard screenshot with real readings.

## Deferred Outside M10B

- TensorFlow installation.
- Final LSTM training.
- Final ML metrics.
