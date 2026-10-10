from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

logger = logging.getLogger("moat-docling")


def _identity_token(audience: str) -> str:
    request = urllib.request.Request(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"
        f"?audience={urllib.parse.quote(audience, safe='')}",
        headers={"Metadata-Flavor": "Google"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.read().decode("utf-8")


def moat_api_origin() -> str:
    return os.environ.get("MOAT_API_URL", "").rstrip("/")


def authorized_request(
    method: str,
    path: str,
    *,
    data: bytes | None = None,
    content_type: str = "application/json",
    timeout: int = 60,
) -> tuple[int, bytes, str]:
    origin = moat_api_origin()
    if not origin:
        raise RuntimeError("MOAT_API_URL is not configured")
    url = f"{origin}{path}"
    headers = {
        "Authorization": f"Bearer {_identity_token(origin)}",
        "Content-Type": content_type,
    }
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return (
                response.status,
                response.read(),
                response.headers.get("content-type", ""),
            )
    except urllib.error.HTTPError as error:
        logger.warning("moat_api_http_error", extra={"status": error.code, "path": path})
        return error.code, error.read(), error.headers.get("content-type", "")


def list_pending_jobs() -> list[dict[str, Any]]:
    status, body, _ = authorized_request("GET", "/api/internal/tax-parse/pending")
    if status != 200:
        raise RuntimeError(f"pending jobs request failed ({status})")
    payload = json.loads(body.decode("utf-8"))
    jobs = payload.get("jobs")
    return jobs if isinstance(jobs, list) else []


def fetch_source(user_id: str, document_id: str) -> tuple[bytes, str]:
    query = urllib.parse.urlencode({"userId": user_id, "documentId": document_id})
    status, body, content_type = authorized_request(
        "GET",
        f"/api/internal/tax-parse/source?{query}",
        timeout=120,
    )
    if status != 200:
        raise RuntimeError(f"source request failed ({status})")
    return body, content_type.split(";")[0] or "application/octet-stream"


def post_result(payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload).encode("utf-8")
    status, _body, _ = authorized_request(
        "POST",
        "/api/internal/tax-parse/result",
        data=encoded,
        timeout=120,
    )
    if status != 200:
        raise RuntimeError(f"result request failed ({status})")
