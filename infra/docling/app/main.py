from __future__ import annotations

import logging
import os
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .convert import (
    ParseLimitError,
    convert_file,
    ensure_parse_allowed,
    ensure_parse_limits,
    parser_version,
)
from .moat_client import fetch_source, list_pending_jobs, post_result
from .workspace import isolated_workspace

logging.basicConfig(
    level=os.environ.get("MOAT_PARSER_LOG_LEVEL", "INFO"),
    format='{"severity":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
)
logger = logging.getLogger("moat-docling")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
}


@app.exception_handler(ParseLimitError)
async def parse_limit_details(_request: Request, exc: ParseLimitError):
    logger.warning("parse_rejected", extra={"errorCode": exc.code})
    return JSONResponse(status_code=400, content={"error": exc.code})


@app.exception_handler(Exception)
async def hide_exception_details(_request: Request, exc: Exception):
    logger.error(
        "unhandled_parser_error",
        extra={"errorName": type(exc).__name__},
    )
    return JSONResponse(status_code=500, content={"error": "parse_failed"})


@app.get("/health")
def health():
    return {
        "status": "ok",
        "parser": "docling",
        "version": parser_version(),
    }


@app.post("/v1/parse")
async def parse_document(request: Request):
    mime_type = request.headers.get("x-moat-mime-type") or request.headers.get(
        "content-type", "application/octet-stream"
    )
    mime_type = mime_type.split(";")[0].strip()
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit():
        ensure_parse_limits(mime_type=mime_type, byte_size=int(content_length))
    body = await request.body()
    started = time.monotonic()
    parsed = _parse_bytes(body, mime_type)
    logger.info(
        "parse_completed",
        extra={
            "pageCount": parsed.get("pageCount"),
            "durationMs": int((time.monotonic() - started) * 1000),
            "parserVersion": parsed.get("parserVersion"),
        },
    )
    return parsed


@app.post("/v1/drain-jobs")
def drain_jobs():
    jobs = list_pending_jobs()
    processed = 0
    failed = 0
    for job in jobs:
        document_id = str(job.get("documentId") or "")
        user_id = str(job.get("userId") or "")
        if not document_id or not user_id:
            continue
        started = time.monotonic()
        try:
            source_bytes, mime_type = fetch_source(user_id, document_id)
            parsed = _parse_bytes(source_bytes, mime_type)
            post_result(
                {
                    "documentId": document_id,
                    "userId": user_id,
                    "parsed": parsed,
                    "pageCount": parsed.get("pageCount"),
                    "durationMs": int((time.monotonic() - started) * 1000),
                }
            )
            processed += 1
        except Exception as error:
            failed += 1
            logger.error(
                "drain_job_failed",
                extra={
                    "documentId": document_id,
                    "errorName": type(error).__name__,
                    "errorCode": getattr(error, "code", "parse_failed"),
                },
            )
            try:
                post_result(
                    {
                        "documentId": document_id,
                        "userId": user_id,
                        "failed": True,
                        "errorCode": getattr(error, "code", "parse_failed"),
                        "durationMs": int((time.monotonic() - started) * 1000),
                    }
                )
            except Exception:
                logger.error("drain_result_post_failed", extra={"documentId": document_id})
    logger.info(
        "drain_completed",
        extra={"processed": processed, "failed": failed, "claimed": len(jobs)},
    )
    return {"processed": processed, "failed": failed, "claimed": len(jobs)}


def _parse_bytes(data: bytes, mime_type: str) -> dict:
    ensure_parse_allowed(data, mime_type)
    suffix = EXTENSIONS.get(mime_type, ".bin")
    with isolated_workspace() as workspace:
        path = Path(workspace) / f"document{suffix}"
        path.write_bytes(data)
        try:
            return convert_file(path, mime_type)
        finally:
            if path.exists():
                path.unlink()
