# Raspberry Pi Gateway

Hardware-first Python gateway for Raspberry Pi 3 and two XY-MD02 sensors over
USB RS485. The gateway reads S1 ambient and S2 hotspot values, validates them,
sends readings to the EMS backend, and reports gateway/sensor status.

## Features

- YAML configuration with environment overrides for secrets and deployment paths.
- Serial-port discovery and raw Modbus holding-register diagnostics.
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

Edit `config.yaml` for the actual RS485 adapter, XY-MD02 slave IDs, and register
addresses. Put the real backend token in `.env`, not in YAML:

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
python -m gateway.cli run
```

Use `--config ./path/to/config.yaml` after `raw`, `sensor`, `send-test`, or `run`
to override `GATEWAY_CONFIG`. Test S2 with `--slave-id 2` and `--sensor-code S2`.

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

Gateway heartbeat/status reports are separate from readings and default to every
60 seconds. Failed status reports are logged and retried on later cycles.

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
