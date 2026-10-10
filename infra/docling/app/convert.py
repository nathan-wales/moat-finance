from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from .normalize import normalize_docling_document

logger = logging.getLogger("moat-docling")

MAX_FILE_BYTES = int(os.environ.get("MOAT_PARSER_MAX_FILE_BYTES", str(25 * 1024 * 1024)))
MAX_PAGES = int(os.environ.get("MOAT_PARSER_MAX_PAGES", "150"))
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/heic",
    "image/heif",
}
_PAGE_OBJECT = re.compile(rb"/Type\s*/Page(?![sA-Za-z])")

_converter = None
_converter_ocr = None
_parser_version = "unknown"


class ParseLimitError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def parser_version() -> str:
    global _parser_version
    if _parser_version != "unknown":
        return _parser_version
    try:
        from importlib.metadata import version

        _parser_version = version("docling")
    except Exception:
        _parser_version = os.environ.get("DOCLING_PARSER_VERSION", "unknown")
    return _parser_version


def ocr_enabled() -> bool:
    return os.environ.get("MOAT_PARSER_DISABLE_OCR") != "true"


def get_converter():
    global _converter, _converter_ocr
    enable_ocr = ocr_enabled()
    if _converter is not None and _converter_ocr == enable_ocr:
        return _converter

    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = enable_ocr
    pipeline_options.do_table_structure = True
    artifacts = os.environ.get("DOCLING_SERVE_ARTIFACTS_PATH")
    if artifacts:
        pipeline_options.artifacts_path = artifacts

    _converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )
    _converter_ocr = enable_ocr
    logger.info("docling_converter_ready", extra={"parserVersion": parser_version(), "ocr": enable_ocr})
    return _converter


def _count_pdf_pages(path: Path) -> int:
    try:
        data = path.read_bytes()
    except OSError:
        return 0
    return len(_PAGE_OBJECT.findall(data))


def ensure_parse_allowed(data: bytes, mime_type: str) -> None:
    ensure_parse_limits(mime_type=mime_type, byte_size=len(data))


def ensure_parse_limits(*, mime_type: str, byte_size: int) -> None:
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ParseLimitError("unsupported_type", "Unsupported file type")
    if byte_size > MAX_FILE_BYTES:
        raise ParseLimitError("file_too_large", "File exceeds the per-file limit")


def convert_file(path: Path, mime_type: str) -> dict:
    ensure_parse_limits(mime_type=mime_type, byte_size=path.stat().st_size)
    if mime_type == "application/pdf":
        pages = _count_pdf_pages(path)
        if pages > MAX_PAGES:
            raise ParseLimitError("too_many_pages", "Document exceeds the page limit")

    converter = get_converter()
    result = converter.convert(str(path))
    document = result.document
    parsed = normalize_docling_document(document, parser_version())
    if (parsed.get("pageCount") or 0) > MAX_PAGES:
        raise ParseLimitError("too_many_pages", "Document exceeds the page limit")
    return parsed
