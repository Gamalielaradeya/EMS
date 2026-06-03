# M10B Hardware Validation Log - EMS Thermal LSTM

## Status

**Partial Hardware Validation - one XY-MD02 sensor validated**

Stage-two validation on 2026-06-03 confirmed Raspberry Pi gateway delivery with
one connected XY-MD02 sensor as S1. M10B is not complete because S2 was not
physically connected and no two-sensor validation was performed.

## Summary

| Item | Result |
|---|---|
| Raspberry Pi SSH | Passed: `gamaliel@192.168.18.33` |
| Hostname | `lmnop` |
| OS | Debian GNU/Linux 13 `trixie` |
| Python | `3.13.5` |
| Git | `2.47.3` |
| Gateway path | `/home/gamaliel/EMS/gateway-rpi` |
| USB RS485 | Passed: FT232 at `/dev/ttyUSB0` |
| Serial permission | Passed: user is in `dialout` |
| Laptop backend | Passed: `http://192.168.18.9:8081/api/v1/health` from Pi returned HTTP `200` |
| Modbus function | Fixed: gateway now supports function `04` input registers |
| Raw S1 read | Passed: `raw=[352, 547]` |
| S1 diagnostic | Passed: temperature `35.1 C`, humidity `54.6 %` |
| Gateway send-test | Passed: backend accepted 2 simulator readings |
| Gateway run loop | Passed: about 3 minutes, S1 hardware readings inserted |
| Hardware rows | Passed: `19` hardware rows captured for S1 |
| SSE | Passed: `reading.latest` and `gateway.status` observed |
| Dashboard/API | Passed: dashboard summary and latest readings show S1 hardware data |
| S2 | Not run: only one sensor connected |

## Hardware Risk

Raspberry Pi undervoltage remains a risk:

```text
throttled=0x50000
Undervoltage detected!
Voltage normalised
```

Use a stronger/stabler Raspberry Pi power supply before final Bab 4 evidence.

Gateway logs also showed repeated `pymodbus` receive-buffer cleanup warnings
while reads still succeeded. This should be monitored after power and wiring are
cleaned up.

## Laptop EMS Preparation

| Step | Evidence |
|---|---|
| PostgreSQL | Docker PostgreSQL on host port `55432` |
| Migrations/seed | Applied to `ems_thermal_lstm` |
| Backend | Built and started on `APP_PORT=8081` |
| Backend bind | `0.0.0.0:8081` and `[::]:8081` listening |
| Laptop health | `GET http://localhost:8081/api/v1/health` returned `success` |
| LAN health from laptop | `GET http://192.168.18.9:8081/api/v1/health` returned `success` |
| LAN health from Pi | `curl http://192.168.18.9:8081/api/v1/health` returned HTTP `200` |
| Frontend | Vite dashboard available on `http://localhost:5173` |

Windows Firewall inbound TCP `8081` had been created before this run, so the Pi
could reach the backend.

## Gateway Compatibility Fix

The previous blocker was caused by gateway diagnostics and sensor reads using
Modbus function `03` holding registers only. The real XY-MD02 sensor was
confirmed by Modbus Poll to use function `04` input registers:

```text
Protocol: RTU
Serial: 9600 baud, 8 data bits, no parity, 1 stop bit
Function: 04 Read Input Registers
Slave ID: 1
Address: 1
Quantity: 2
Observed registers: 377, 502
Scale: 0.1
```

Minimal fix implemented:

- `modbus.register_type` config default support.
- Per-register `register_type` support for temperature and humidity.
- `holding`/function `03` remains supported.
- `input`/function `04` added for XY-MD02.
- `diagnose raw --register-type input|holding` added for explicit diagnostics.
- `config.example.yaml`, `gateway-rpi/README.md`, and gateway tests updated.

Pi local runtime config was set to:

```text
backend.base_url = http://192.168.18.9:8081/api/v1
modbus.port = /dev/ttyUSB0
modbus.baudrate = 9600
modbus.bytesize = 8
modbus.parity = N
modbus.stopbits = 1
modbus.timeout_seconds = 1
modbus.register_type = input
S1.enabled = true
S1.slave_id = 1
S1.temperature.address = 1
S1.humidity.address = 2
S1.register_type = input
S2.enabled = false
```

The backend token was supplied through the ignored Pi `.env` and was not
printed.

## Commands and Results

### Pi Backend Connectivity

```bash
curl -sS --max-time 5 http://192.168.18.9:8081/api/v1/health
```

Result:

```text
{"status":"success","message":"service is healthy",...}
http_code=200
```

### Serial Port Discovery

```bash
python -m gateway.cli diagnose ports
```

Result:

```text
Serial ports detected:
- /dev/ttyS0
- /dev/ttyUSB0
```

### Raw Input Register Diagnostic

```bash
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
```

Result:

```text
Reading raw register: register_type=input slave_id=1 address=1 count=2
raw=[352, 547]
```

Interpreted with scale `0.1`:

```text
temperature ~= 35.2 C
humidity ~= 54.7 %
```

### S1 Sensor Diagnostic

```bash
python -m gateway.cli diagnose sensor --sensor-code S1
```

Result:

```text
Reading configured sensor: sensor_code=S1 slave_id=1
temperature=35.1
humidity=54.6
```

### Send-Test

```bash
python -m gateway.cli send-test
```

Result:

```text
Test payload accepted by backend.
{'status': 'success', 'message': 'readings accepted', 'data': {'received_count': 2, 'stored_count': 2}}
```

These `send-test` rows are simulator transport evidence only, not hardware
evidence.

### Gateway Run Loop

```bash
timeout -s INT 190 python -m gateway.cli run
```

Result:

```text
Gateway stopped.
POST http://192.168.18.9:8081/api/v1/readings "HTTP/1.1 201 Created"
POST http://192.168.18.9:8081/api/v1/gateway/status "HTTP/1.1 201 Created"
```

The loop ran for about 3 minutes and stopped safely through SIGINT. S2 was
disabled in local Pi config because only one sensor was connected.

## Backend Evidence

Source counts:

```text
source    | count
----------+------
hardware  | 19
simulator | 2
```

Latest rows:

```text
S1 | 35.10 | 54.60 | hardware | valid | 2026-06-03 01:20:26+00
S1 | 35.00 | 54.50 | hardware | valid | 2026-06-03 01:20:16+00
S1 | 35.00 | 54.60 | hardware | valid | 2026-06-03 01:20:06+00
```

Gateway state:

```text
raspi-gateway-01 | active | 2026-06-03 01:20:26+00
```

Sensor state:

```text
S1 | normal | 2026-06-03 01:20:26+00
S2 | normal | 2026-06-03 01:16:33+00
```

S2 state comes from earlier simulator `send-test`, not hardware.

Latest readings API:

```text
S1 source=hardware temperature=35.1 humidity=54.6
S2 source=simulator temperature=30.8 humidity=58.5
```

Dashboard summary API:

```text
gateway.status=active
latest_readings.S1.temperature=35.1
latest_readings.S1.humidity=54.6
today_summary.total_readings=21
telegram.enabled=false
```

SSE capture:

```text
event: reading.latest
event: gateway.status
event: reading.latest
event: reading.latest
...
```

Frontend server responded with HTTP `200`; no final thesis screenshot was
captured in this operator run.

## Validation Commands

Local gateway:

```text
python -m compileall -q src tests
python -m unittest discover -s tests -v
Ran 13 tests - OK
```

Raspberry Pi gateway:

```text
python -m compileall -q src tests
python -m unittest discover -s tests -v
Ran 13 tests - OK
```

Backend:

```text
go build ./cmd/server
GET /api/v1/health passed locally and from Pi
```

Backend code was not changed, so full backend tests were not required for this
gateway compatibility fix.

## Remaining Work Before M10B Done

- Connect and validate S2 XY-MD02 as hotspot sensor.
- Re-run raw diagnostics and configured diagnostics for both S1 and S2.
- Run gateway loop with both sensors enabled for 3-5 minutes.
- Capture dashboard screenshot with real S1 and S2 hardware readings.
- Capture final database evidence with only hardware readings for thesis proof.
- Fix or monitor Raspberry Pi undervoltage before final evidence.
- Investigate `pymodbus` receive-buffer cleanup warnings if they continue after
  power/wiring cleanup.
