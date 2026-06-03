# M10B Hardware Validation Log - EMS Thermal LSTM

## Status

**Blocked - stage-one validation attempted**

Raspberry Pi access and USB RS485 adapter detection were validated on
2026-06-03, but no XY-MD02 reading was validated. M10B is not complete and is
not marked Partial because the connected single sensor did not respond to raw
Modbus reads.

## Confirmed Stage-One Values

| Item | Result |
|---|---|
| Raspberry Pi SSH target | `gamaliel@192.168.18.33` |
| Hostname | `lmnop` |
| Gateway repository | `/home/gamaliel/EMS/gateway-rpi` |
| Gateway commit on Pi | `dfe966a milestone-10c: validate tensorflow training runtime` |
| Gateway virtual environment | Present and usable |
| Laptop IP | `192.168.18.9` |
| Backend target from Pi | `http://192.168.18.9:8081/api/v1` |
| Serial port | `/dev/ttyUSB0` |
| USB adapter | FT232 / FTDI USB Serial Device |
| Modbus mode | RTU |
| Baudrate | `9600` |
| Data bits | `8` |
| Parity | `N` |
| Stop bits | `1` |
| Timeout | `1` second |
| Connected sensor count | One XY-MD02 sensor |
| Assumed slave ID | `1` |

Gateway `config.yaml` and `.env` were created/updated on the Raspberry Pi as
ignored local runtime files. Tokens were not printed and must not be committed.

## Laptop EMS Result

| Item | Result |
|---|---|
| PostgreSQL | Passed: Docker PostgreSQL running on host port `55432` |
| Database schema | Passed: migrations and seed applied to `ems_thermal_lstm` |
| Backend | Passed: built and running on `APP_PORT=8081` |
| Local backend health | Passed: `GET http://localhost:8081/api/v1/health` returned `success` |
| Laptop LAN self-check | Passed: `GET http://192.168.18.9:8081/api/v1/health` returned `success` from the laptop |
| Frontend | Passed: Vite dashboard running on `http://localhost:5173` |
| Pi-to-laptop health | Blocked: Pi `curl http://192.168.18.9:8081/api/v1/health` timed out |
| Firewall rule attempt | Blocked: non-admin shell could not create Windows inbound rule for port `8081` |

Direct backend delivery from the Raspberry Pi is blocked by laptop inbound
network/firewall access on port `8081`. This must be fixed before gateway
`send-test` and live delivery can pass using the approved LAN backend URL.

## Raspberry Pi Environment Evidence

| Check | Evidence |
|---|---|
| SSH | Passed: passwordless SSH works with `ssh gamaliel@192.168.18.33` |
| OS | Debian GNU/Linux 13 `trixie` |
| Python | `Python 3.13.5` |
| Git | `git version 2.47.3` |
| Serial device | `crw-rw---- root dialout /dev/ttyUSB0` |
| User groups | `gamaliel` is in `dialout` |
| FT232 evidence | `Future Technology Devices International, Ltd FT232 Serial (UART) IC` |
| Gateway CLI | `python -m gateway.cli --help` works |

## Hardware Risk

Raspberry Pi undervoltage was detected and must be treated as a hardware risk:

```text
throttled=0x50000
Undervoltage detected!
Voltage normalised
```

Undervoltage can cause unstable USB serial behavior and should be corrected
with a better Raspberry Pi power supply before final evidence collection.

## Commands Run From Raspberry Pi

### Backend Connectivity

```bash
curl -sS -m 5 http://192.168.18.9:8081/api/v1/health
```

Result:

```text
curl: (28) Connection timed out after 5002 milliseconds
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

### Raw Modbus Read - Slave 1 Address 0

```bash
python -m gateway.cli diagnose raw --slave-id 1 --address 0 --count 2
```

Result:

```text
Reading raw register: slave_id=1 address=0 count=2
ERROR: Failed to read slave_id=1 address=0 count=2: Modbus request failed for slave_id=1 address=0 count=2: Modbus Error: [Input/Output] No response received after 3 retries, continue with next request
Possible causes:
- wrong serial port
- wrong slave ID
- wrong baudrate
- A/B cable reversed
- sensor not powered
- wrong register address
No response received after 3 retries, continue with next request
```

### Raw Modbus Read - Slave 1 Address 1

```bash
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
```

Result:

```text
Reading raw register: slave_id=1 address=1 count=2
ERROR: Failed to read slave_id=1 address=1 count=2: Modbus request failed for slave_id=1 address=1 count=2: Modbus Error: [Input/Output] No response received after 3 retries, continue with next request
Possible causes:
- wrong serial port
- wrong slave ID
- wrong baudrate
- A/B cable reversed
- sensor not powered
- wrong register address
No response received after 3 retries, continue with next request
```

### Slave-ID Check - Slave 2 Address 0

```bash
python -m gateway.cli diagnose raw --slave-id 2 --address 0 --count 2
```

Result:

```text
Reading raw register: slave_id=2 address=0 count=2
ERROR: Failed to read slave_id=2 address=0 count=2: Modbus request failed for slave_id=2 address=0 count=2: Modbus Error: [Input/Output] No response received after 3 retries, continue with next request
```

### Port Lock and USB Kernel Evidence

No process was holding `/dev/ttyUSB0` after diagnostics. Kernel messages showed
the FT232 adapter attached:

```text
FTDI USB Serial Device converter detected
Detected FT232R
FTDI USB Serial Device converter now attached to ttyUSB0
```

### Send-Test

```bash
python -m gateway.cli send-test
```

Result:

```text
HTTP POST failed endpoint=/readings attempt=1/2 error=timed out
HTTP POST failed endpoint=/readings attempt=2/2 error=timed out
ERROR: Backend delivery failed: POST /readings failed after 2 attempt(s): timed out
Check BACKEND_BASE_URL, backend availability, and BACKEND_TOKEN.
```

## Commands Not Run

The following commands were intentionally not run because raw Modbus reads did
not succeed:

```bash
python -m gateway.cli diagnose sensor --sensor-code S1
python -m gateway.cli run
```

No sensor diagnostic success, hardware reading insert, dashboard realtime
update, or 3-5 minute live gateway run is claimed.

## Current Blockers

1. **Raw Modbus no response**
   - `/dev/ttyUSB0` exists and user has `dialout`.
   - No process is holding the serial port.
   - Slave IDs `1` and `2` did not respond to safe raw reads.
   - Likely next checks: RS485 A/B polarity, sensor power, sensor slave ID,
     baudrate, register map, and Raspberry Pi power stability.

2. **Pi cannot reach laptop backend over LAN**
   - Laptop backend is healthy locally on `8081`.
   - Pi `curl` to `192.168.18.9:8081` timed out.
   - Non-admin shell could not add a Windows Firewall inbound rule.
   - Next fix: allow inbound TCP `8081` on the laptop firewall or use a
     documented SSH tunnel only as a temporary development workaround.

3. **Raspberry Pi undervoltage**
   - `vcgencmd get_throttled` returned `0x50000`.
   - Kernel logs contain repeated undervoltage events.
   - Correct power supply before final Bab 4 evidence capture.

## Continue Checklist

- [ ] Correct Raspberry Pi power supply and confirm no new undervoltage events.
- [ ] Confirm sensor power at the XY-MD02 terminals.
- [ ] Recheck RS485 A/B polarity and termination if present.
- [ ] Confirm actual slave ID using known-good Modbus Poll setup or controlled
      slave-ID scan.
- [ ] Confirm XY-MD02 register map and function code.
- [ ] Retest:

```bash
python -m gateway.cli diagnose raw --slave-id 1 --address 0 --count 2
python -m gateway.cli diagnose raw --slave-id 1 --address 1 --count 2
```

- [ ] Fix laptop inbound access to `192.168.18.9:8081`.
- [ ] Retest from Pi:

```bash
curl http://192.168.18.9:8081/api/v1/health
```

- [ ] If raw read succeeds, update `config.yaml` register addresses and run:

```bash
python -m gateway.cli diagnose sensor --sensor-code S1
python -m gateway.cli send-test
python -m gateway.cli run
```

- [ ] Add the second XY-MD02 sensor and validate S2 before marking M10B done.
