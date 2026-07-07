from __future__ import annotations

import argparse
import sys

from gateway.config import ConfigError, load_config
from gateway.diagnostics import diagnose_ports, diagnose_raw, diagnose_sensor
from gateway.http_sender import DeliveryError, HTTPSender
from gateway.logger import configure_logging
from gateway.main import GatewayRuntime
from gateway.models import AppConfig
from gateway.payload_builder import build_send_test_payload
from gateway.simulator import SimulatorOptions, duration_to_seconds, run_simulator


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="EMS Thermal LSTM Raspberry Pi gateway")
    subparsers = parser.add_subparsers(dest="command", required=True)

    diagnose_parser = subparsers.add_parser("diagnose", help="run hardware diagnostics")
    diagnose_subparsers = diagnose_parser.add_subparsers(dest="diagnose_command", required=True)
    diagnose_subparsers.add_parser("ports", help="list serial ports")

    raw_parser = diagnose_subparsers.add_parser("raw", help="read raw Modbus holding registers")
    _add_config_argument(raw_parser)
    raw_parser.add_argument("--slave-id", type=int, required=True)
    raw_parser.add_argument("--address", type=int, required=True)
    raw_parser.add_argument("--count", type=int, required=True)
    raw_parser.add_argument(
        "--register-type",
        choices=("holding", "input"),
        help="Modbus register type; defaults to modbus.register_type from config",
    )

    sensor_parser = diagnose_subparsers.add_parser("sensor", help="read one configured sensor")
    _add_config_argument(sensor_parser)
    sensor_parser.add_argument("--sensor-code", required=True)

    send_test_parser = subparsers.add_parser("send-test", help="submit development test readings")
    _add_config_argument(send_test_parser)

    run_parser = subparsers.add_parser("run", help="run the periodic hardware gateway loop")
    _add_config_argument(run_parser)

    simulate_parser = subparsers.add_parser("simulate", help="run realtime simulator readings for end-to-end tests")
    _add_config_argument(simulate_parser)
    simulate_parser.add_argument(
        "--scenario",
        choices=("random-smooth", "heat-cycle", "normal"),
        default="random-smooth",
    )
    simulate_parser.add_argument("--interval", type=float, default=10.0, help="send interval in seconds")
    simulate_parser.add_argument("--duration", default="30m", help="duration, for example 300s, 30m, 1h, or forever")
    simulate_parser.add_argument("--seed", type=int, default=42)
    simulate_parser.add_argument("--drop-sensor", choices=("S1", "S2"), help="omit one sensor after --drop-after")
    simulate_parser.add_argument("--drop-after", default="0s", help="when to start dropping --drop-sensor")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "diagnose" and args.diagnose_command == "ports":
        return diagnose_ports()

    try:
        config = load_config(args.config)
    except ConfigError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if args.command == "diagnose" and args.diagnose_command == "raw":
        return diagnose_raw(config, args.slave_id, args.address, args.count, args.register_type)
    if args.command == "diagnose" and args.diagnose_command == "sensor":
        return diagnose_sensor(config, args.sensor_code)
    if args.command == "send-test":
        return _send_test(config)
    if args.command == "run":
        configure_logging(config.logging)
        runtime = GatewayRuntime(config)
        try:
            runtime.run_forever()
        except KeyboardInterrupt:
            print("Gateway stopped.")
        return 0
    if args.command == "simulate":
        configure_logging(config.logging)
        return run_simulator(
            config,
            SimulatorOptions(
                scenario=args.scenario,
                interval_seconds=args.interval,
                duration_seconds=duration_to_seconds(args.duration),
                seed=args.seed,
                drop_sensor=args.drop_sensor,
                drop_after_seconds=duration_to_seconds(args.drop_after) if args.drop_sensor else None,
            ),
        )
    return 2


def _send_test(config: AppConfig) -> int:
    sender = HTTPSender(config.backend)
    try:
        response = sender.send_readings(build_send_test_payload(config.gateway.id))
    except DeliveryError as exc:
        print(f"ERROR: Backend delivery failed: {exc}", file=sys.stderr)
        print("Check BACKEND_BASE_URL, backend availability, and BACKEND_TOKEN.", file=sys.stderr)
        return 1
    finally:
        sender.close()
    print("Test payload accepted by backend.")
    if response:
        print(response)
    return 0


def _add_config_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--config", help="path to config YAML; defaults to GATEWAY_CONFIG or ./config.yaml")


if __name__ == "__main__":
    raise SystemExit(main())
