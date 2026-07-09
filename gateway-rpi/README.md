# Raspberry Pi Gateway

Hardware-first Python gateway for Raspberry Pi 3 and two XY-MD02 sensors over
USB RS485. The gateway reads S1 ambient and S2 hotspot values, validates them,
sends readings to the EMS backend, and reports gateway/sensor status.

## Features

- YAML configuration with environment overrides for secrets and deployment paths.
- Serial-port discovery and raw Modbus input/holding-register diagnostics.
- Configured S1/S2 sensor diagnostics with clear RS485 troubleshooting output.
- Bearer-authenticated readings and heartbeat/status delivery.
- One retry only, then bounded local JSONL buffering.
- Small throttled replay batches after current realtime readings succeed.
- Local file logging and a basic periodic hardware run loop.

The gateway does not train models, run LSTM inference, or replace the PostgreSQL
backend. `send-test` uses simulator-tagged values only as a development transport
check. Thesis evidence must use validated hardware readings.

## Raspberry Pi Setup

```bash
cd gateway-rpi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.yaml config.yaml
cp .env.example .env
```

Edit `config.yaml` for the actual RS485 adapter, XY-MD02 slave IDs, register
addresses, and register type. Put the real backend token in `.env`, not in YAML:

```env
GATEWAY_CONFIG=./config.yaml
BACKEND_TOKEN=<gateway-token>
BACKEND_BASE_URL=http://<backend-ip>:8080/api/v1
MODBUS_PORT=/dev/ttyUSB0
```

Neither `.env` nor `config.yaml` is committed. The root `.gitignore` also excludes
the virtual environment, logs, `__pycache__`, and `failed_payloads.jsonl`.

USB RS485 adapters commonly appear as `/dev/ttyUSB0`. Check permissions before
starting the gateway:

```bash
ls /dev/ttyUSB*
sudo usermod -aG dialout "$USER"
```

Log out and back in after adding the `dialout` group.

## Canonical CLI

Run commands from `gateway-rpi/` with the virtual environment active:

```bash
python -m gateway.cli diagnose ports
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
python -m gateway.cli diagnose sensor --sensor-code S1
python -m gateway.cli send-test
python -m gateway.cli simulate --scenario random-smooth --duration 30m
python -m gateway.cli run
```

Use `--config ./path/to/config.yaml` after `raw`, `sensor`, `send-test`,
`simulate`, or `run` to override `GATEWAY_CONFIG`. Test S2 with `--slave-id 2`
and `--sensor-code S2`.
Use `--register-type input` or `--register-type holding` with `diagnose raw` to
override the configured default for a single diagnostic read.

The current XY-MD02 hardware validation uses function `04` / input registers.
Set either the global Modbus default or each register to input:

```yaml
modbus:
  register_type: "input"

sensors:
  - code: "S1"
    registers:
      temperature:
        address: 1
        count: 1
        scale: 0.1
        register_type: "input"
      humidity:
        address: 2
        count: 1
        scale: 0.1
        register_type: "input"
```

For older devices that use function `03`, set `register_type: "holding"`.

When an adapter or sensor is unavailable, diagnostics return a clear error with
likely causes: serial port, slave ID, baudrate, wiring polarity, sensor power, or
register address. Physical sensor success is not required on a development laptop.

## Configuration Overrides

Supported environment overrides:

```text
GATEWAY_CONFIG
GATEWAY_ID
BACKEND_BASE_URL
BACKEND_TOKEN
GATEWAY_TOKEN
MODBUS_PORT
MODBUS_REGISTER_TYPE
MODBUS_INTER_READ_DELAY_MS
SAMPLING_INTERVAL_SECONDS
HEARTBEAT_INTERVAL_SECONDS
BUFFER_FILE_PATH
LOG_LEVEL
LOG_FILE_PATH
```

`BACKEND_TOKEN` is preferred. `GATEWAY_TOKEN` is accepted for compatibility with
the backend bootstrap environment name.

## Runtime Delivery

The basic run loop reads enabled sensors every 10 seconds. A failure from one
sensor is reported as trouble without stopping the other sensor. Current readings
are always sent before replay work. A failed readings request is retried once; if
the retry also fails, the payload is written to bounded JSONL storage. Replay sends
small batches at the configured interval so old data does not block realtime data.
Enabled sensors are read sequentially with `modbus.inter_read_delay_ms` between
sensor transactions. The default is `300` ms, which gives shared RS485 devices a
short settling gap while keeping the 10-second sampling cycle intact.

Gateway heartbeat/status reports are separate from readings and default to every
60 seconds. Failed status reports are logged and retried on later cycles.

## Realtime Simulator for End-to-End Tests

`simulate` sends smooth S1/S2 readings to the backend as `source=simulator`.
It does not read Modbus and should not run at the same time as the hardware
gateway, otherwise dashboard/latest status will mix hardware and simulator rows.
The `random-smooth` scenario starts with a joint S1/S2 heat episode after a
30-60 second stable period, then rotates shuffled S1-only, S2-only, and joint
episodes.

Examples:

```bash
python -m gateway.cli simulate --scenario random-smooth --duration 30m --interval 10
python -m gateway.cli simulate --scenario heat-cycle --duration 20m
python -m gateway.cli simulate --scenario normal --duration 10m
python -m gateway.cli simulate --scenario random-smooth --duration forever
python -m gateway.cli simulate --scenario random-smooth --duration 10m --drop-sensor S2 --drop-after 2m
python -m gateway.cli simulate --scenario random-smooth --duration forever --drop-sensor S2 --drop-after 30s --drop-for 90s --recover-for 120s
python -m gateway.cli simulate --scenario random-smooth --duration forever --drop-sensor alternate --drop-after 60s --drop-for 330s --recover-for 120s
```

Use it for frontend/backend/SSE/event/Telegram behavior tests. Do not use
simulator rows as thesis hardware evidence or as validation/test data for ML.

For repeated Trouble/Recovery testing, use `--drop-for` and `--recover-for`.
Without those two options, `--drop-sensor` keeps the selected sensor omitted
after `--drop-after`. The `alternate` mode cycles S1 drop, recovery, S2 drop,
and recovery. Use a drop duration longer than `sensor_timeout_minutes` to create
real backend Trouble events.

Runtime files default to:

```text
./logs/gateway.log
./data/failed_payloads.jsonl
```

## Systemd Example

`systemd/ems-thermal-lstm-gateway.service.example` is documentation only. Review
its user and `/opt/ems-thermal-lstm` paths before copying it to
`/etc/systemd/system/`. Install it only after manual diagnostics pass.

## Local Verification

Windows PowerShell:

```powershell
py -3.10 -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt
./.venv/Scripts/python.exe -m compileall src
./.venv/Scripts/python.exe -m unittest discover -s tests -v
./.venv/Scripts/python.exe -m gateway.cli --help
./.venv/Scripts/python.exe -m gateway.cli diagnose ports
```
