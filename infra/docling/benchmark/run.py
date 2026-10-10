from __future__ import annotations

import json
import os
import time
from pathlib import Path

from generate_samples import write_samples


def main() -> None:
    samples = write_samples(Path(__file__).parent / "samples")
    parser_url = os.environ.get("DOCLING_PARSER_URL", "http://127.0.0.1:8080")
    report = []
    for sample in samples:
        started = time.monotonic()
        try:
            import urllib.request

            request = urllib.request.Request(
                f"{parser_url}/v1/parse",
                data=sample.read_bytes(),
                method="POST",
                headers={
                    "content-type": "application/pdf",
                    "x-moat-mime-type": "application/pdf",
                },
            )
            with urllib.request.urlopen(request, timeout=900) as response:
                payload = json.loads(response.read().decode("utf-8"))
            duration_ms = int((time.monotonic() - started) * 1000)
            text = payload.get("text") or ""
            report.append(
                {
                    "sample": sample.name,
                    "pageCount": payload.get("pageCount"),
                    "durationMs": duration_ms,
                    "hasText": bool(text.strip()),
                    "formHints": payload.get("formHints"),
                    "tableCount": len(payload.get("tables") or []),
                    "keyValueCount": len(payload.get("keyValues") or []),
                    "error": None,
                }
            )
        except Exception as error:
            report.append(
                {
                    "sample": sample.name,
                    "pageCount": None,
                    "durationMs": int((time.monotonic() - started) * 1000),
                    "hasText": False,
                    "formHints": [],
                    "tableCount": 0,
                    "keyValueCount": 0,
                    "error": type(error).__name__,
                }
            )
    Path(__file__).parent.joinpath("report.json").write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
