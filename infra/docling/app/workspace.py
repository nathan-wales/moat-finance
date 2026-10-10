from __future__ import annotations

import os
import shutil
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


def scratch_root() -> Path:
    configured = os.environ.get("MOAT_PARSER_SCRATCH", "/scratch")
    path = Path(configured)
    try:
        path.mkdir(parents=True, exist_ok=True)
        return path
    except OSError:
        fallback = Path("/tmp/moat-parser")
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


@contextmanager
def isolated_workspace() -> Iterator[Path]:
    root = scratch_root()
    path = Path(tempfile.mkdtemp(prefix="parse-", dir=str(root)))
    try:
        yield path
    finally:
        shutil.rmtree(path, ignore_errors=True)
