from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timedelta, timezone
from ml_worker.config import Settings, load_settings
from ml_worker.database import connect
from ml_worker.errors import MLWorkerError
from ml_worker.logging_config import configure_logging
from ml_worker.pipeline import evaluate, infer, train


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="EMS Thermal LSTM database-driven ML worker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    train_parser = subparsers.add_parser("train", help="train baselines and LSTM from PostgreSQL readings")
    _add_time_range_arguments(train_parser)
    train_parser.add_argument("--activate", action="store_true", help="activate the new model after training")

    evaluate_parser = subparsers.add_parser("evaluate", help="evaluate the latest or requested saved LSTM model")
    _add_time_range_arguments(evaluate_parser)
    evaluate_parser.add_argument("--version", help="specific model version; defaults to active or latest")

    infer_parser = subparsers.add_parser("infer", help="produce one local prediction from the active/latest model")
    infer_parser.add_argument("--version", help="specific model version; defaults to active or latest")
    infer_parser.add_argument("--end", help="ISO-8601 end timestamp; defaults to now")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        settings = load_settings()
        configure_logging(settings)
        with connect(settings) as connection:
            if args.command == "train":
                start_at, end_at = _time_range(args, settings)
                result = train(connection, settings, start_at, end_at, activate=args.activate)
            elif args.command == "evaluate":
                start_at, end_at = _time_range(args, settings)
                result = evaluate(connection, settings, start_at, end_at, version=args.version)
            else:
                result = infer(connection, settings, _parse_datetime(args.end) or _now(), version=args.version)
    except (MLWorkerError, OSError, ValueError) as exc:
        logging.getLogger(__name__).error("%s", exc)
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, default=str))
    return 0


def _add_time_range_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--start", help="ISO-8601 start timestamp; defaults to ML_HISTORY_HOURS before end")
    parser.add_argument("--end", help="ISO-8601 end timestamp; defaults to now")


def _time_range(args: argparse.Namespace, settings: Settings) -> tuple[datetime, datetime]:
    end_at = _parse_datetime(args.end) or _now()
    start_at = _parse_datetime(args.start) or (end_at - timedelta(hours=settings.history_hours))
    if start_at >= end_at:
        raise ValueError("--start must be before --end")
    return start_at, end_at


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


if __name__ == "__main__":
    raise SystemExit(main())
