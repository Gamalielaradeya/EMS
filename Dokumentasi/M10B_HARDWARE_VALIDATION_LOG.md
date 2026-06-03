# M10B Hardware Validation Log - EMS Thermal LSTM

## Status

**Partial - two-sensor hardware path validated; long collection blocked**

Stage-two validation on 2026-06-03 confirmed Raspberry Pi gateway delivery with
one connected XY-MD02 sensor as S1. M10B is not complete because S2 was not
physically connected and no two-sensor validation was performed.

Stage-three validation on 2026-06-03 used a new Wi-Fi network and connected
both sensors. S1 and S2 raw diagnostics, configured diagnostics, and one backend
runtime cycle passed, but the first full loop attempt stalled on continuous
ASCII/junk bytes in the serial receive buffer.

Stabilization on 2026-06-03 added a configurable `300 ms` inter-sensor Modbus
delay. After deploying that patch to the Raspberry Pi, the canonical gateway
loop ran for about `190` seconds with both sensors enabled and stored repeated
hardware rows for both S1 and S2.

Later final dataset collection was stopped because XY-MD02 ordinary
UART/common-protocol ASCII temperature and humidity reports continued to enter
the RS485 receive buffer. The two-sensor short hardware path remains valid, but
the long dataset collection is not valid yet.

## Summary

| Item | Result |
|---|---|
| Raspberry Pi SSH | Passed: `gamaliel@192.168.10.108` |
| Hostname | `lmnop` |
| OS | Debian GNU/Linux 13 `trixie` |
| Python | `3.13.5` |
| Git | `2.47.3` |
| Gateway path | `/home/gamaliel/EMS/gateway-rpi` |
| USB RS485 | Passed: FT232 at `/dev/ttyUSB0` |
| Serial permission | Passed: user is in `dialout` |
| Laptop backend | Passed: `http://192.168.10.112:8081/api/v1/health` from Pi returned HTTP `200` |
| Modbus function | Fixed: gateway now supports function `04` input registers |
| Raw S1 read | Passed: `raw=[256, 425]` on current network |
| Raw S2 read | Passed: `raw=[253, 440]` on current network |
| S1 diagnostic | Passed: temperature `25.5 C`, humidity `42.4 %` |
| S2 diagnostic | Passed: temperature `25.2 C`, humidity `44.0 %` |
| Gateway send-test | Passed: backend accepted 2 simulator readings |
| Gateway run loop | Passed: about `190` seconds with S1 and S2 enabled |
| Hardware rows | Passed: repeated S1 and S2 hardware rows stored |
| SSE | Passed historically for S1 loop; stabilization used HTTP/API/DB evidence |
| Dashboard/API | Passed: latest readings and dashboard summary show both sensors as hardware |
| S2 | Passed: raw, configured diagnostic, and repeated backend hardware rows |

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

Stage-three retry showed those warnings could block stable loop operation before
stabilization. After adding the inter-sensor delay, warnings still appeared but
did not block repeated backend delivery during the 190-second validation run.

## Stage-Three Network Context

Old addresses are no longer current:

```text
old laptop IP: 192.168.18.9
old Pi IP: 192.168.18.33
```

Current addresses:

```text
laptop IP: 192.168.10.112
Pi IP: 192.168.10.108
Pi SSH: ssh gamaliel@192.168.10.108
backend base URL from Pi: http://192.168.10.112:8081/api/v1
```

PostgreSQL host port note:

```text
Requested 55432 was unavailable because Windows excluded TCP range 55365-55464.
Requested 55433 was also inside that excluded range.
This validation used POSTGRES_PORT=15432.
Backend still used APP_PORT=8081.
```

Pi backend health passed:

```text
curl http://192.168.10.112:8081/api/v1/health
http_code=200
```

## Stage-Three Two-Sensor Diagnostics

Pi local config was updated without printing secrets:

```text
backend.base_url = http://192.168.10.112:8081/api/v1
modbus.port = /dev/ttyUSB0
modbus.baudrate = 9600
modbus.bytesize = 8
modbus.parity = N
modbus.stopbits = 1
modbus.timeout_seconds = 1
modbus.register_type = input
S1.enabled = true
S1.slave_id = 1
S2.enabled = true
S2.slave_id = 2
S1/S2 temperature.address = 1
S1/S2 humidity.address = 2
S1/S2 register_type = input
```

Diagnostics:

```text
python -m gateway.cli diagnose ports
Serial ports detected:
- /dev/ttyS0
- /dev/ttyUSB0

python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
Reading raw register: register_type=input slave_id=1 address=1 count=2
raw=[256, 425]

python -m gateway.cli diagnose raw --slave-id 2 --address 1 --count 2
Reading raw register: register_type=input slave_id=2 address=1 count=2
raw=[253, 440]

python -m gateway.cli diagnose sensor --sensor-code S1
temperature=25.5
humidity=42.4

python -m gateway.cli diagnose sensor --sensor-code S2
temperature=25.2
humidity=44
```

One runtime cycle passed:

```text
GatewayRuntime.run_once()
POST /api/v1/readings 201
POST /api/v1/gateway/status 201
```

Database hardware evidence from that runtime cycle:

```text
S1 | 25.60 | 42.90 | hardware | valid | 2026-06-03 05:39:31+00
S2 | 25.10 | 44.40 | hardware | valid | 2026-06-03 05:39:31+00
```

Latest readings API later returned both sensors as hardware:

```text
S1 source=hardware temperature=25.6 humidity=42.9
S2 source=hardware temperature=25.1 humidity=44.4
```

## Stage-Three Loop Blocker

The canonical loop command was attempted:

```bash
timeout -s INT 190 python -m gateway.cli run
```

It did not produce repeated two-sensor deliveries. The loop printed
`Gateway stopped` only after timeout/SIGINT and stalled after serial cleanup:

```text
pymodbus.logging Cleanup recv buffer before send: ...
```

Bounded retry diagnostics then also stalled on raw S1 read. The serial buffer
contained repeated ASCII-like sensor text, for example bytes corresponding to
temperature and humidity strings such as `25.0`, `45.4`, `25.4`, and `43.5`.
The stack trace ended inside `pymodbus` RTU frame decoding after `KeyboardInterrupt`.

Interpretation:

- The sensors and wiring can answer function `04` input-register reads.
- Backend delivery works.
- One two-sensor runtime cycle works.
- The bus is not stable for a 3-5 minute gateway loop because unsolicited
  ASCII/junk bytes flood the RTU receive buffer.
- Possible hardware/config causes to investigate: XY-MD02 active-upload mode,
  wiring noise, undervoltage, RS485 adapter behavior, or sensor mode settings.

This was the stage-three blocker. The stage-four stabilization below supersedes
it with repeated S1 and S2 hardware rows.

## Stage-Four Stabilization - Two-Sensor Loop Passed

New manual evidence before code change:

```text
S1 raw repeated read: 15/15 success
S1 values: around [253-255, 447-453]
S2 raw repeated read: 15/15 success
S2 values: around [253-255, 484-515]
No timeout, CRC error, or no-response during repeated raw tests.
```

Interpretation:

- RS485 wiring, slave IDs, function `04` input registers, and sensor power are
  basically valid.
- Remaining blocker was the run-loop timing/serial handling path, not basic
  Modbus connectivity.
- Diagnostics use short one-shot transactions, while the run loop reads S1 and
  S2 back-to-back through a persistent client.

Minimal stabilization implemented:

```text
modbus.inter_read_delay_ms: 300
MODBUS_INTER_READ_DELAY_MS override
GatewayRuntime reads enabled sensors sequentially.
GatewayRuntime waits between sensor transactions.
```

No backend API, frontend, ML worker, Telegram, or out-of-scope feature was
changed.

Post-patch Pi config decisions without secrets:

```text
backend.base_url = http://192.168.10.112:8081/api/v1
modbus.port = /dev/ttyUSB0
modbus.baudrate = 9600
modbus.bytesize = 8
modbus.parity = N
modbus.stopbits = 1
modbus.timeout_seconds = 1
modbus.register_type = input
modbus.inter_read_delay_ms = 300
S1.enabled = true
S1.slave_id = 1
S2.enabled = true
S2.slave_id = 2
S1/S2 temperature.address = 1
S1/S2 humidity.address = 2
S1/S2 register_type = input
```

Post-patch diagnostics:

```text
python -m gateway.cli diagnose ports
Serial ports detected:
- /dev/ttyS0
- /dev/ttyUSB0

python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
Reading raw register: register_type=input slave_id=1 address=1 count=2
raw=[255, 444]

python -m gateway.cli diagnose raw --slave-id 2 --address 1 --count 2
Reading raw register: register_type=input slave_id=2 address=1 count=2
raw=[257, 449]

python -m gateway.cli diagnose sensor --sensor-code S1
temperature=25.6
humidity=44.5

python -m gateway.cli diagnose sensor --sensor-code S2
temperature=25.7
humidity=45
```

Canonical loop validation:

```bash
timeout -s INT 190 python -m gateway.cli run
```

Result:

```text
Gateway stopped.
RUN_EXIT_CODE=124
Repeated POST /api/v1/readings returned HTTP 201.
Repeated POST /api/v1/gateway/status returned HTTP 201.
```

Exit code `124` is expected because Linux `timeout` stopped the intentionally
long-running gateway loop after the validation window.

Backend database evidence after the loop:

```text
sensor_code | hardware_rows | latest_recorded_at
S1          | 36            | 2026-06-03 06:28:38.577324+00
S2          | 17            | 2026-06-03 06:28:38.577324+00

latest hardware rows:
S1 | 25.60 | 44.30 | hardware | valid | 2026-06-03 06:28:38.577324+00
S2 | 25.50 | 45.30 | hardware | valid | 2026-06-03 06:28:38.577324+00

gateway:
raspi-gateway-01 | active | 2026-06-03 06:28:38.577324+00

sensors:
S1 | normal | 2026-06-03 06:28:38.577324+00
S2 | normal | 2026-06-03 06:28:38.577324+00
```

Latest readings API:

```text
GET /api/v1/readings/latest
S1 source=hardware quality_status=valid temperature=25.6 humidity=44.3
S2 source=hardware quality_status=valid temperature=25.5 humidity=45.3
```

Dashboard summary API:

```text
GET /api/v1/dashboard/summary
gateway.status=active
latest_readings.S1.temperature=25.6
latest_readings.S1.humidity=44.3
latest_readings.S1.sensor_health_status=normal
latest_readings.S2.temperature=25.5
latest_readings.S2.humidity=45.3
latest_readings.S2.sensor_health_status=normal
today_summary.total_readings=55
telegram.enabled=false
```

Power risk:

```text
vcgencmd get_throttled
throttled=0x50000
```

Treat `0x50000` as historical undervoltage/throttling since boot, not a
stabilization blocker. Clean reboot and recheck before long final evidence run.

M10B result:

```text
Done: two-sensor Raspberry Pi gateway hardware path validated.
```

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

## Remaining Bab 4 Evidence Work After M10B

- Capture final dashboard screenshot with real S1 and S2 hardware readings.
- Capture final database evidence from a longer hardware collection run if
  needed for thesis dataset quality.
- Clean reboot Raspberry Pi and recheck `vcgencmd get_throttled` before long
  evidence collection.
- Continue monitoring `pymodbus` receive-buffer cleanup warnings during longer
  runs; they did not block the stabilized 190-second M10B validation.
- Run final TensorFlow training from hardware readings after enough data is
  collected.

## Final Hardware Dataset Collection - Blocked

Status on 2026-06-03:

```text
Goal: collect source=hardware, quality_status=valid rows for S1 and S2.
Laptop IP: 192.168.10.112
Raspberry Pi IP: 192.168.10.108
Backend: http://192.168.10.112:8081/api/v1
Frontend: http://localhost:5173
PostgreSQL host port: 15432
Gateway process: stopped on Raspberry Pi, PID 1309
Gateway log: ~/EMS/gateway-rpi/logs/hardware_dataset_20260603T065015Z.log
Temporary laptop monitor log: %TEMP%/ems-hardware-dataset/monitor.log
```

Collection config decisions:

```text
S2 is read before S1 in ignored Pi config.yaml for this collection run.
modbus.inter_read_delay_ms is overridden to 500 ms in ignored Pi .env.
No source code changed for this collection setup.
No tokens were printed.
```

Baseline count before starting the final collection loop:

```text
S1 hardware valid rows: 36
S2 hardware valid rows: 17
latest_recorded_at: 2026-06-03 06:28:38.577324+00
```

First post-start validation after several cycles:

```text
S1 hardware valid rows: 43
S2 hardware valid rows: 24
latest_recorded_at: 2026-06-03 06:51:18.013053+00

latest rows:
S1 | 25.80 | 44.30 | hardware | valid | 2026-06-03 06:51:18.013053+00
S2 | 25.50 | 45.30 | hardware | valid | 2026-06-03 06:51:18.013053+00
```

Dashboard summary after start:

```text
gateway.status=active
latest_readings.S1.temperature=25.8
latest_readings.S1.humidity=44.3
latest_readings.S1.sensor_health_status=normal
latest_readings.S2.temperature=25.5
latest_readings.S2.humidity=45.3
latest_readings.S2.sensor_health_status=normal
today_summary.total_readings=69
telegram.enabled=false
```

Temporary monitor sample 1:

```text
time: 2026-06-03T13:53:47+07:00
backend_health=success
gateway_status=active
S1=25.9/44.1 at 2026-06-03T13:53:38.016247+07:00
S2=25.5/45.2 at 2026-06-03T13:53:38.016247+07:00
S1 hardware valid rows: 57
S2 hardware valid rows: 38
latest_recorded_at: 2026-06-03 06:53:38.016247+00
```

Power risk remains:

```text
vcgencmd get_throttled
throttled=0x50000
```

Do not treat the final ML result as thesis evidence until training is run on the
collected hardware rows.

Collection stop result:

```text
Gateway loop stopped on Raspberry Pi.
Last observed hardware-valid counts:
S1 hardware valid rows: 273
S2 hardware valid rows: 253
latest_recorded_at: 2026-06-03 07:42:26.761374+00

latest rows:
S1 | 26.10 | 51.90 | hardware | valid | 2026-06-03 07:42:26.761374+00
S2 | 27.30 | 43.40 | hardware | valid | 2026-06-03 07:42:26.761374+00
```

These rows prove continued delivery happened for a limited window, but this
collection is not accepted as the final thesis ML dataset because the long run
became unstable.

Root cause evidence from gateway log:

```text
Serial receive buffer contained ordinary ASCII temperature/humidity strings,
for example values like "26.1 ...,44.4 ...\r\n".
pymodbus reported:
ERROR: request ask for id=2 but got id=32, Skipping.
ERROR: request ask for id=2 but got id=161, Skipping.
ERROR: request ask for id=2 but got id=163, Skipping.
```

Interpretation:

- S1/S2 raw Modbus reads remain valid.
- S1/S2 configured diagnostics remain valid.
- Short runtime inserts remain valid.
- The long run is blocked because one or both XY-MD02 devices are emitting
  ordinary UART/common-protocol automatic reports onto the shared RS485 bus.
- Those ASCII bytes can be interpreted by `pymodbus` as wrong unit IDs such as
  `32`, `161`, or `163` instead of the requested Modbus slave ID `2`.
- A gateway patch that tries to ignore arbitrary ASCII bytes would only be a
  temporary mitigation. It is not the root fix for final evidence.

Documentation research:

- The XY-MD02 manual states that the device integrates Modbus protocol and
  ordinary/general UART protocol; the UART/common protocol supports automatic
  reporting.
- The same manual lists general-protocol commands:
  `READ` to trigger one temperature/humidity report, `AUTO` to start automatic
  reporting, and `STOP` to stop automatic reporting.
- A vendor listing also describes the product as supporting both Modbus RTU and
  custom/common protocol, with the common protocol automatically outputting
  temperature and humidity.
- Source checked:
  `https://iot-kmutnb.github.io/blogs/sensors/xy-md02/xy-md02_manual-2.pdf`

Recommended next hardware configuration step:

```text
1. Keep Raspberry Pi gateway stopped.
2. Isolate one XY-MD02 sensor at a time on the RS485 adapter.
3. Open a serial terminal/RS485 configuration tool at 9600 baud, 8 data bits,
   no parity, 1 stop bit.
4. Send ASCII command STOP, preferably with CR/LF if the tool requires line
   ending.
5. Wait and confirm the sensor no longer emits periodic ASCII temperature and
   humidity strings while idle.
6. Send PARAM to inspect settings if the tool supports it.
7. Repeat for the second XY-MD02 sensor.
8. Reconnect both sensors on the RS485 bus.
9. Re-run repeated raw reads for S1 and S2.
10. Re-run the gateway loop for at least 2 hours only after the bus is quiet
    while idle.
```

Final dataset collection remains blocked until XY-MD02 automatic reporting is
disabled and passive Modbus RTU polling is stable.

## XY-MD02 STOP Attempt - Still Blocked

Status on 2026-06-03:

```text
Goal: disable ordinary UART/common-protocol automatic reporting.
Pi SSH: gamaliel@192.168.10.108
Gateway path: ~/EMS/gateway-rpi
Serial port: /dev/ttyUSB0
Serial settings: 9600 baud, 8 data bits, no parity, 1 stop bit
Gateway run loop: stopped before test
Secrets printed: no
Code changed: no
```

STOP commands sent from Raspberry Pi with `pyserial`:

```text
STOP\r\n
STOP\n
STOP
```

Result after initial STOP variants:

```text
ASCII temperature/humidity text was still received immediately after each
command.
10-second quiet check still received 3,843,328 bytes while actively draining
the serial stream.
Sample bytes contained repeated temperature/humidity text such as:
27.9 ...,41.6 ...\r\n
26.0 ...,44.7 ...\r\n
```

A second safer burst attempt sent repeated variants:

```text
STOP\r
STOP\r\n
STOP\n
STOP
```

Result after burst attempt:

```text
quiet_wait_10s_in_waiting=4080
quiet_sample still contained repeated ASCII temperature/humidity reports.
```

Requested repeated raw reads:

```text
S1 20 attempts: not completed
S2 20 attempts: not started
```

Reason:

```text
The first repeated S1 raw diagnostic did not return before the operator timeout.
The diagnostic process was left running on the Raspberry Pi and was stopped with
pkill against gateway.cli.
```

Conclusion:

- The `STOP` command did not disable automatic reporting while both sensors were
  connected on the shared RS485 bus.
- No 10-minute gateway loop was started.
- No 2-hour final collection was started.
- The collected rows from the earlier short window remain hardware delivery
  evidence only, not final ML dataset evidence.
- Do not add a gateway ASCII-ignore patch as the final fix. The bus must be made
  quiet in hardware/device configuration.

Recommended next hardware step:

```text
1. Stop the gateway.
2. Power-cycle the XY-MD02 sensors, because one checked guide notes cycling
   power can stop automatic polling when STOP cannot be typed/sent fast enough.
3. Isolate one XY-MD02 sensor at a time on the RS485 adapter.
4. Check idle serial output for 10 seconds before sending any command.
5. Send STOP with CR/LF through a serial terminal or vendor configuration tool.
6. If STOP still fails, use the vendor/configuration tool to switch the device
   from ordinary/common UART automatic report mode back to passive Modbus RTU.
7. Repeat for the second sensor.
8. Reconnect both sensors and confirm idle bus has zero ASCII reports.
9. Only then run S1/S2 20-attempt raw reads and the 10-minute gateway loop.
```

M10B remains partial/blocked for final dataset collection.

## Isolated S1 STOP Attempt - Still Auto-Reporting

Status on 2026-06-03 `15:09 +07:00`:

```text
Goal: test S1 alone after disconnecting S2 from RS485 bus and power/data chain.
Pi SSH: gamaliel@192.168.10.108
Gateway path: ~/EMS/gateway-rpi
Serial port: /dev/ttyUSB0
Connected sensor: S1 only
S1 slave ID: 1
S1 register type: input/function 04
Register address: 1
Register count: 2
Scale: 0.1
Serial settings: 9600 baud, 8 data bits, no parity, 1 stop bit
Gateway run loop: not running
Secrets printed: no
Code changed: no
```

STOP commands sent to isolated S1 from Raspberry Pi with `pyserial`:

```text
STOP\r\n
STOP\n
STOP
Repeated STOP burst with STOP\r, STOP\r\n, STOP\n, STOP
```

Result:

```text
ASCII automatic reporting still appeared after each STOP command.
Each immediate receive check returned 512 bytes of ASCII-like
temperature/humidity text.
After the repeated STOP burst and 10-second wait:
idle_in_waiting_after_10s=3993
idle_sample still contained repeated humidity/temperature text fragments such as
"45.7 ...\r\n".
```

Raw Modbus diagnostic:

```bash
timeout -s INT 25 python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
```

Result:

```text
Reading raw register: register_type=input slave_id=1 address=1 count=2
RAW_S1_EXIT=124
```

The timeout interrupted `pymodbus` RTU frame decoding while it was processing
the noisy receive stream. This raw diagnostic is blocked, not passed.

Configured S1 diagnostic:

```bash
timeout -s INT 25 python -m gateway.cli diagnose sensor --sensor-code S1
```

Result:

```text
Reading configured sensor: sensor_code=S1 slave_id=1
temperature=26
humidity=44.9
SENSOR_S1_EXIT=0
Cleanup recv buffer before send: 0xe6 0x2c 0x34 0x35 0x2e 0x37 ...
```

Interpretation:

- Isolating S1 did not stop ordinary UART/common-protocol automatic reporting.
- `STOP` did not disable automatic reporting for S1 in the current wiring/tool
  state.
- S1 can still answer a configured sensor diagnostic after buffer cleanup.
- Raw one-shot diagnostics are unreliable while S1 continues flooding ASCII
  reports.
- No 10-minute gateway loop or 2-hour collection was started.
- Do not proceed to final dataset collection until S1 idle bus output is quiet.

Recommended next step before S2 isolated test:

```text
Power-cycle S1 while isolated, then check idle serial output before sending any
command. If ASCII output resumes immediately after power-up, use a vendor serial
configuration tool or documented ordinary-protocol parameter command to disable
automatic reporting / set passive Modbus RTU mode. After S1 is quiet, repeat the
same isolated test for S2.
```

## Opportunistic Two-Hour Collection Attempt - Aborted, No Data Growth

Status on 2026-06-03:

```text
Goal: preliminary/opportunistic hardware collection while final auto-report
      blocker is still unresolved.
Dataset status: not final thesis dataset.
Laptop IP: 192.168.18.9
Raspberry Pi IP: 192.168.18.33
Backend from Pi: http://192.168.18.9:8081/api/v1
PostgreSQL host port: 15432
Frontend: already listening on localhost:5173
Code changed: no
Secrets printed: no
```

Initial stack state:

```text
PostgreSQL container already running on host port 15432.
Backend already listening on 0.0.0.0:8081 and [::]:8081.
Frontend already listening on localhost:5173.
Local backend health passed:
GET http://localhost:8081/api/v1/health
Pi backend health passed:
curl http://192.168.18.9:8081/api/v1/health
```

Baseline hardware-valid counts:

```text
S1|273|2026-06-03 07:42:26.761374+00
S2|253|2026-06-03 07:42:26.761374+00
```

Pi config was updated locally, without printing tokens:

```text
backend.base_url=http://192.168.18.9:8081/api/v1
modbus.port=/dev/ttyUSB0
modbus.register_type=input
modbus.inter_read_delay_ms=500
S1 enabled=true slave_id=1 role=ambient
S2 enabled=true slave_id=2 role=hotspot
```

First gateway start:

```text
pid=1002
log=logs/preliminary_hardware_20260603T115145Z.log
```

Result:

```text
No new hardware rows were inserted.
Gateway log showed repeated HTTP timeouts:
POST /readings failed after 2 attempt(s): timed out
POST /gateway/status failed after 2 attempt(s): timed out
Gateway log also showed repeated pymodbus receive-buffer cleanup with ASCII
temperature/humidity bytes.
The gateway was stopped with SIGINT.
```

Manual backend write sanity check:

```text
Pi curl health to backend passed.
A valid manual Python urllib POST to /api/v1/readings returned HTTP 201.
A direct httpx POST from the Pi also returned HTTP 201.
The artificial test rows were deleted immediately afterward so the hardware
dataset remained unpolluted.
```

Gateway restart attempt:

```text
pid=1303
log=logs/preliminary_hardware_retry_20260603T115651Z.log
```

Result after the requested 30-second wait and later simple checks:

```text
S1|273|2026-06-03 07:42:26.761374+00
S2|253|2026-06-03 07:42:26.761374+00
advanced=false
```

Simple log tail showed the same failure pattern:

```text
POST /readings failed after 2 attempt(s): timed out
POST /gateway/status failed after 2 attempt(s): timed out
Cleanup recv buffer before send: 0x33 0x32 ... ASCII temperature/humidity bytes
```

Broken monitor correction:

```text
The first local monitor used an overly complex SSH status command with shell
quoting/sed syntax that failed on the Pi side. That monitor was stopped.
The corrected simple checks used:
ssh gamaliel@192.168.18.33 "pgrep -af 'python -m gateway.cli run' || true"
simple DB count queries
simple latest endpoint calls
simple tail command with the actual log path
```

Final stop:

```text
Gateway pid 1303 was stopped with SIGINT.
Final process check with ps/grep showed no gateway.cli process.
```

Conclusion:

- The opportunistic 2-hour collection was not started because row counts did not
  increase after gateway start/restart.
- No new valid hardware data was collected in this attempt.
- The existing hardware-valid counts remained S1 `273` and S2 `253`.
- The preliminary collection remains blocked by current runtime behavior:
  gateway loop HTTP sends time out while ASCII auto-report noise continues on
  the serial bus.
- Direct Pi-to-backend write sanity checks prove the backend can still accept a
  valid authenticated readings payload.
- This run is preliminary/noisy validation only and must not be used as final
  thesis dataset evidence.

## Best-Effort Opportunistic Collection - Ran, Zero New Rows

Status on 2026-06-03:

```text
Goal: keep best-effort collection running for about 2 hours while the known
      XY-MD02 ASCII auto-report issue remains unresolved.
Dataset status: preliminary/noisy only; not final thesis dataset.
Code changed: no
Final TensorFlow training: not run
```

Stack and network:

```text
Laptop IP: 192.168.18.9
Raspberry Pi IP: 192.168.18.33
Backend from Pi: http://192.168.18.9:8081/api/v1
PostgreSQL: Docker container on host port 15432
Backend: already listening on 0.0.0.0:8081 and [::]:8081
Frontend: already listening on localhost:5173
Local backend health: passed
Pi-to-backend health: passed
```

Gateway start:

```text
Gateway Python PID: 950
Wrapper shell PID: 947
Gateway log: ~/EMS/gateway-rpi/logs/best_effort_20260603T122434Z.log
Monitor log: %TEMP%\ems-best-effort-hardware\best_effort_20260603T192705.log
```

Monitor window:

```text
Monitor start: 2026-06-03T19:27:05+07:00
Monitor end:   2026-06-03T21:22:51+07:00
Duration: about 1 hour 56 minutes
Samples: 24
Restart count: 0
Gateway process state during samples: alive
Gateway process state at end: still running
```

Hardware-valid counts before and after:

```text
Start:
S1|273|2026-06-03 07:42:26.761374+00
S2|253|2026-06-03 07:42:26.761374+00

End:
S1|273|2026-06-03 07:42:26.761374+00
S2|253|2026-06-03 07:42:26.761374+00

New successful rows:
S1: 0
S2: 0
```

Latest readings at the end:

```text
S1 id=528 temperature=26.1 humidity=51.9
   recorded_at=2026-06-03T14:42:26.761374+07:00
   source=hardware quality_status=valid
S2 id=527 temperature=27.3 humidity=43.4
   recorded_at=2026-06-03T14:42:26.761374+07:00
   source=hardware quality_status=valid
```

Main observed errors:

```text
POST /readings failed after 2 attempt(s): timed out
POST /gateway/status failed after 2 attempt(s): timed out
Cleanup recv buffer before send: ASCII temperature/humidity bytes
```

Monitor interpretation:

- The gateway process remained alive, so watchdog did not restart it.
- Row counts never advanced in any sample.
- The gateway stayed stuck in the same failure pattern: HTTP delivery timeout
  plus serial receive-buffer ASCII flood.
- No simulator rows or artificial hardware rows were kept.
- This attempt produced no additional usable hardware rows.
- The gateway was intentionally left running at the end because this run was
  requested as best-effort while the operator was away.

Final state:

```text
Best-effort collection ran but collected 0 new rows.
Gateway still running on Raspberry Pi.
Data remains preliminary/noisy only, not final thesis evidence.
```

## M10E Token Alignment and Collection Retry

Status: blocked after token fix.

On 2026-06-03, the gateway token mismatch was confirmed and corrected on the
Raspberry Pi local `~/EMS/gateway-rpi/config.yaml` without printing token
values. The backend was reachable from the Pi before and after the change.

Validation after token alignment:

```text
Pi health: HTTP 200, about 0.038 s
Direct authenticated POST /api/v1/readings: HTTP 201, about 0.190 s
Stored manual validation rows: 2
Deleted manual validation rows after test: 2
```

The corrected direct POST proves the backend, LAN path, and gateway bearer
token are aligned. No artificial validation rows were retained.

A short gateway retry was then started as preliminary/noisy collection only:

```text
Gateway command: .venv/bin/python -m gateway.cli run
Gateway log: ~/EMS/gateway-rpi/logs/manual_collection_M10E_20260603T223033Z.log
Wait window before checking counts: 60 seconds
```

Hardware-valid counts before and after the retry:

```text
Before:
S1|273|2026-06-03 07:42:26.761374+00
S2|253|2026-06-03 07:42:26.761374+00

After:
S1|273|2026-06-03 07:42:26.761374+00
S2|253|2026-06-03 07:42:26.761374+00
```

The gateway was stopped after counts did not increase. The collection log only
showed startup followed by serial receive-buffer cleanup containing unsolicited
ASCII temperature/humidity bytes, then `Gateway stopped`. No new HTTP delivery
was reached during the retry window.

Interpretation:

- Token mismatch is fixed.
- Backend/network POST path is valid.
- Current blocker is back on the hardware serial/run-loop path before delivery.
- This run is preliminary/noisy only and is not final thesis ML dataset
  evidence.

## M10F Hardware Candidate Data Availability

Status: preliminary hardware data available for candidate LSTM training.

On 2026-06-04, the Raspberry Pi gateway was left running and continued sending
valid hardware rows to the local backend. The gateway, backend, frontend, and
PostgreSQL were not stopped for the training run.

Hardware-valid counts before training:

```text
S1: 1,025 rows, latest 2026-06-03 20:02:36.200559+00
S2: 1,005 rows, latest 2026-06-03 20:02:36.200559+00
Paired minute buckets observed before training: 176
```

ML-worker dry check loaded `2,070` raw hardware rows and produced `218` usable
one-minute rows, `213` labeled rows after the five-minute target shift, and
chronological window counts of train `97`, validation `12`, and test `14`.

After model verification, hardware-valid row counts had continued increasing:

```text
S1: 1,052 rows, latest 2026-06-03 20:07:06.204237+00
S2: 1,032 rows, latest 2026-06-03 20:07:06.204237+00
```

This proves the current local stack had enough hardware data for a small
final-candidate training run, but it does not replace long passive Modbus RTU
collection evidence. The dataset remains preliminary/noisy and limited until
longer stable hardware collection is captured.
