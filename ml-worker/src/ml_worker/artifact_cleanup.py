from __future__ import annotations

import shutil
from pathlib import Path
from typing import Iterable

from psycopg import Connection

from ml_worker.config import Settings
from ml_worker.repository import referenced_model_artifact_paths


def cleanup_orphan_artifacts(
    connection: Connection,
    settings: Settings,
    *,
    apply: bool = False,
) -> dict[str, object]:
    referenced = referenced_model_artifact_paths(connection)
    candidates = find_orphan_artifact_dirs(
        settings.artifact_dir,
        settings.report_dir,
        settings.model_name,
        referenced,
    )
    if apply:
        for candidate in candidates:
            shutil.rmtree(candidate)
    return {
        "mode": "applied" if apply else "dry_run",
        "orphan_count": len(candidates),
        "paths": [str(path) for path in candidates],
    }


def find_orphan_artifact_dirs(
    artifact_root: Path,
    report_root: Path,
    model_name: str,
    referenced_paths: Iterable[Path],
) -> list[Path]:
    artifact_root = artifact_root.resolve()
    report_root = report_root.resolve()
    referenced_names = {
        path.resolve().relative_to(artifact_root).parts[0]
        for path in referenced_paths
        if _is_within(path.resolve(), artifact_root)
    }
    prefix = f"{model_name}_v"
    candidates: list[Path] = []
    for root in (artifact_root, report_root):
        if not root.is_dir():
            continue
        for child in root.iterdir():
            resolved = child.resolve()
            if (
                child.is_dir()
                and child.name.startswith(prefix)
                and child.name not in referenced_names
                and resolved.parent == root
            ):
                candidates.append(resolved)
    return sorted(candidates)


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False
