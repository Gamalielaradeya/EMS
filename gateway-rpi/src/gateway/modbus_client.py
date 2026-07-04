from __future__ import annotations

from collections.abc import Sequence

from pymodbus.client import ModbusSerialClient

from gateway.models import ModbusConfig


class ModbusReadError(RuntimeError):
    """Raised when the RS485 adapter or Modbus sensor cannot be read."""


class GatewayModbusClient:
    def __init__(self, config: ModbusConfig) -> None:
        self._config = config
        self._client = ModbusSerialClient(
            port=config.port,
            baudrate=config.baudrate,
            bytesize=config.bytesize,
            parity=config.parity,
            stopbits=config.stopbits,
            timeout=config.timeout_seconds,
        )

    def read_registers(self, slave_id: int, address: int, count: int, register_type: str) -> list[int]:
        normalized = register_type.strip().lower()
        if normalized == "holding":
            return self._read_registers(slave_id, address, count, register_type="holding")
        if normalized == "input":
            return self._read_registers(slave_id, address, count, register_type="input")
        raise ModbusReadError("register_type must be holding or input")

    def read_holding_registers(self, slave_id: int, address: int, count: int) -> list[int]:
        return self._read_registers(slave_id, address, count, register_type="holding")

    def read_input_registers(self, slave_id: int, address: int, count: int) -> list[int]:
        return self._read_registers(slave_id, address, count, register_type="input")

    def _read_registers(self, slave_id: int, address: int, count: int, *, register_type: str) -> list[int]:
        if slave_id <= 0:
            raise ModbusReadError("slave ID must be positive")
        if address < 0 or count <= 0:
            raise ModbusReadError("register address must be non-negative and count must be positive")
        if not self._client.connect():
            raise ModbusReadError(f"cannot open Modbus serial port {self._config.port}")
        try:
            method = (
                self._client.read_input_registers
                if register_type == "input"
                else self._client.read_holding_registers
            )
            try:
                response = method(address, count=count, slave=slave_id)
            except TypeError:
                response = method(address, count=count, device_id=slave_id)
        except Exception as exc:
            raise ModbusReadError(
                "Modbus request failed for "
                f"register_type={register_type} slave_id={slave_id} address={address} count={count}: {exc}"
            ) from exc
        if response.isError():
            raise ModbusReadError(
                f"Modbus error for register_type={register_type} "
                f"slave_id={slave_id} address={address} count={count}: {response}"
            )
        registers: Sequence[int] | None = getattr(response, "registers", None)
        if not registers or len(registers) < count:
            raise ModbusReadError(
                f"incomplete Modbus response for slave_id={slave_id} address={address} count={count}"
            )
        return [int(value) for value in registers]

    def close(self) -> None:
        self._client.close()
