from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import datetime, timedelta, timezone
from ml_worker.config import Settings, load_settings
from ml_worker.database import connect
from ml_worker.early_warning import build_early_warning_report
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

    warning_parser = subparsers.add_parser(
        "early-warning-report",
        help="audit matched predictions, transition episodes, and baseline promotion quality",
    )
    _add_time_range_arguments(warning_parser)
    warning_parser.add_argument("--version", help="specific model version; defaults to active or latest")
    warning_parser.add_argument(
        "--max-baseline-ratio",
        type=float,
        default=1.0,
        help="maximum allowed LSTM MAE/RMSE ratio versus the best baseline (default: 1.0)",
    )

    infer_parser = subparsers.add_parser("infer", help="produce one local prediction from the active/latest model")
    infer_parser.add_argument("--version", help="specific model version; defaults to active or latest")
    infer_parser.add_argument("--end", help="ISO-8601 end timestamp; defaults to now")

    infer_loop_parser = subparsers.add_parser(
        "infer-loop",
        help="run periodic active-model inference and submit each prediction to the backend",
    )
    infer_loop_parser.add_argument("--version", help="specific model version; defaults to active or latest")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        settings = load_settings()
        configure_logging(settings)
        if args.command == "infer-loop":
            return run_infer_loop(settings, version=args.version)
        with connect(settings) as connection:
            if args.command == "train":
                start_at, end_at = _time_range(args, settings)
                result = train(connection, settings, start_at, end_at, activate=args.activate)
            elif args.command == "evaluate":
                start_at, end_at = _time_range(args, settings)
                result = evaluate(connection, settings, start_at, end_at, version=args.version)
            elif args.command == "early-warning-report":
                start_at, end_at = _time_range(args, settings)
                result = build_early_warning_report(
                    connection,
                    start_at,
                    end_at,
                    version=args.version,
                    max_baseline_ratio=args.max_baseline_ratio,
                )
            else:
                result = infer(connection, settings, _parse_datetime(args.end) or _now(), version=args.version)
    except (MLWorkerError, OSError, ValueError) as exc:
        logging.getLogger(__name__).error("%s", exc)
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, default=str))
    return 0


def run_infer_loop(settings: Settings, version: str | None = None) -> int:
    logger = logging.getLogger(__name__)
    logger.info("Starting ML infer-loop interval_seconds=%s", settings.infer_interval_seconds)
    print(f"infer-loop started interval_seconds={settings.infer_interval_seconds}", flush=True)
    try:
        while True:
            started_at = _now()
            try:
                with connect(settings) as connection:
                    result = infer(connection, settings, started_at, version=version)
                backend_prediction = result.get("backend_prediction") or {}
                cycle = {
                    "predicted_at": started_at.isoformat(),
                    "predicted_for": result.get("predicted_for"),
                    "predicted_temperature_s2": result.get("predicted_temperature_s2"),
                    "backend_prediction_id": backend_prediction.get("id"),
                    "backend_thermal_status": backend_prediction.get("thermal_status"),
                    "backend_final_status": backend_prediction.get("final_status"),
                    "submit_result": result.get("mode"),
                }
                logger.info(
                    "Inference submitted predicted_for=%s predicted_s2=%.4f thermal_status=%s final_status=%s",
                    cycle["predicted_for"],
                    cycle["predicted_temperature_s2"],
                    cycle["backend_thermal_status"],
                    cycle["backend_final_status"],
                )
                print(json.dumps(cycle, default=str), flush=True)
            except (MLWorkerError, OSError, ValueError) as exc:
                logger.warning("Inference cycle failed: %s", exc)
                print(f"WARN: inference cycle failed: {exc}", file=sys.stderr, flush=True)
            except Exception as exc:  # Defensive loop guard: one bad cycle must not stop future inference.
                logger.exception("Unexpected inference cycle failure")
                print(f"ERROR: unexpected inference cycle failure: {exc}", file=sys.stderr, flush=True)
            time.sleep(settings.infer_interval_seconds)
    except KeyboardInterrupt:
        logger.info("ML infer-loop stopped by operator")
        print("infer-loop stopped", flush=True)
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
