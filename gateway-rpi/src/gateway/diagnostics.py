from __future__ import annotations

from serial.tools import list_ports

from gateway.models import AppConfig
from gateway.modbus_client import GatewayModbusClient, ModbusReadError
from gateway.sensor_reader import SensorReadError, SensorReader


POSSIBLE_CAUSES = (
    "wrong serial port",
    "wrong slave ID",
    "wrong baudrate",
    "A/B cable reversed",
    "sensor not powered",
    "wrong register address",
)


def serial_ports() -> list[str]:
    return [port.device for port in list_ports.comports()]


def diagnose_ports() -> int:
    ports = serial_ports()
    if not ports:
        print("No serial ports detected. Connect the USB RS485 adapter and retry.")
        return 0
    print("Serial ports detected:")
    for port in ports:
        print(f"- {port}")
    return 0


def diagnose_raw(
    config: AppConfig,
    slave_id: int,
    address: int,
    count: int,
    register_type: str | None = None,
) -> int:
    client = GatewayModbusClient(config.modbus)
    register_type = register_type or config.modbus.register_type
    print(
        "Reading raw register: "
        f"register_type={register_type} slave_id={slave_id} address={address} count={count}"
    )
    try:
        values = client.read_registers(slave_id, address, count, register_type)
    except ModbusReadError as exc:
        _print_read_error(
            f"Failed to read register_type={register_type} slave_id={slave_id} "
            f"address={address} count={count}: {exc}"
        )
        return 1
    finally:
        client.close()
    print(f"raw={values}")
    return 0


def diagnose_sensor(config: AppConfig, sensor_code: str) -> int:
    try:
        sensor = config.sensor_by_code(sensor_code)
    except KeyError as exc:
        print(f"ERROR: {exc}")
        return 1
    if not sensor.enabled:
        print(f"ERROR: {sensor.code} is disabled in configuration")
        return 1

    client = GatewayModbusClient(config.modbus)
    reader = SensorReader(client, config.validation)
    print(f"Reading configured sensor: sensor_code={sensor.code} slave_id={sensor.slave_id}")
    try:
        reading = reader.read(sensor)
    except SensorReadError as exc:
        _print_read_error(str(exc))
        return 1
    finally:
        client.close()
    print(f"temperature={reading.temperature:g}")
    print(f"humidity={reading.humidity:g}")
    return 0


def _print_read_error(message: str) -> None:
    print(f"ERROR: {message}")
    print("Possible causes:")
    for cause in POSSIBLE_CAUSES:
        print(f"- {cause}")
