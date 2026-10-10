from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

FORM_HINTS = (
    ("W-2", re.compile(r"\bW-?2\b|Wage and Tax Statement", re.I)),
    ("1099-INT", re.compile(r"\b1099-?INT\b", re.I)),
    ("1099-DIV", re.compile(r"\b1099-?DIV\b", re.I)),
    ("1099-B", re.compile(r"\b1099-?B\b", re.I)),
    ("1099-NEC", re.compile(r"\b1099-?NEC\b", re.I)),
    ("1099-MISC", re.compile(r"\b1099-?MISC\b", re.I)),
    ("1099-K", re.compile(r"\b1099-?K\b", re.I)),
    ("1098-E", re.compile(r"\b1098-?E\b", re.I)),
    ("1098-T", re.compile(r"\b1098-?T\b", re.I)),
    ("1098", re.compile(r"\b1098\b(?!-)", re.I)),
    ("5498-SA", re.compile(r"\b5498-?SA\b", re.I)),
    ("5498", re.compile(r"\b5498\b(?!-)", re.I)),
    ("K-1", re.compile(r"\bK-?1\b|Schedule K-1", re.I)),
    ("1040", re.compile(r"\bForm 1040\b|\b1040\b", re.I)),
)

KV_LINE = re.compile(r"^(.{2,80}?)\s*[:–-]\s+(.+)$")


def detect_form_hints(text: str) -> list[str]:
    hints: list[str] = []
    for form, pattern in FORM_HINTS:
        if pattern.search(text) and form not in hints:
            hints.append(form)
    return hints


def _bbox(prov: Any, page: int) -> dict[str, float | int] | None:
    bbox = getattr(prov, "bbox", None)
    if bbox is None:
        return None
    left = getattr(bbox, "l", None)
    top = getattr(bbox, "t", None)
    right = getattr(bbox, "r", None)
    bottom = getattr(bbox, "b", None)
    if None in (left, top, right, bottom):
        return None
    return {
        "page": page,
        "left": float(left),
        "top": float(top),
        "right": float(right),
        "bottom": float(bottom),
    }


def _first_prov(item: Any) -> Any | None:
    prov = getattr(item, "prov", None)
    if not prov:
        return None
    return prov[0]


def _table_payload(item: Any, page: int, bbox: dict[str, float | int] | None) -> dict[str, Any]:
    headers: list[str] = []
    rows: list[list[str]] = []
    try:
        frame = item.export_to_dataframe()
        headers = [str(column) for column in frame.columns.tolist()]
        rows = [[str(cell) for cell in row] for row in frame.astype(str).values.tolist()]
    except Exception:
        data = getattr(item, "data", None)
        grid = getattr(data, "grid", None) if data is not None else None
        if grid:
            for index, grid_row in enumerate(grid):
                cells = [str(getattr(cell, "text", cell) or "") for cell in grid_row]
                if index == 0:
                    headers = cells
                else:
                    rows.append(cells)
    return {"headers": headers, "rows": rows, "page": page, "bbox": bbox}


def assemble_parsed_tax_document(
    *,
    blocks: list[dict[str, Any]],
    tables: list[dict[str, Any]],
    parser_name: str,
    parser_version: str,
    page_count: int,
    confidence: float | None = None,
) -> dict[str, Any]:
    pages: dict[int, list[str]] = {}
    key_values: list[dict[str, Any]] = []
    source_locations: list[dict[str, Any]] = []
    texts: list[str] = []

    for block in blocks:
        text = str(block.get("text") or "").strip()
        if not text:
            continue
        page = int(block.get("page") or 1)
        texts.append(text)
        pages.setdefault(page, []).append(text)
        source_locations.append(
            {
                "page": page,
                "label": block.get("type") or "text",
                "text": text,
                "bbox": block.get("bbox"),
            }
        )
        match = KV_LINE.match(text)
        if match:
            key_values.append(
                {
                    "key": match.group(1).strip(),
                    "value": match.group(2).strip(),
                    "page": page,
                    "confidence": block.get("confidence"),
                }
            )

    for table in tables:
        page = table.get("page")
        if page is not None:
            source_locations.append(
                {
                    "page": page,
                    "label": "table",
                    "text": " | ".join(table.get("headers") or []),
                    "bbox": table.get("bbox"),
                }
            )

    full_text = "\n".join(texts)
    return {
        "text": full_text,
        "pages": [
            {"page": page, "text": "\n".join(lines)}
            for page, lines in sorted(pages.items())
        ],
        "tables": tables,
        "keyValues": key_values,
        "formClassification": None,
        "extractedFields": {item["key"]: item["value"] for item in key_values},
        "confidence": confidence if confidence is not None else (0.75 if texts else 0.0),
        "sourceLocations": source_locations,
        "blocks": blocks,
        "formHints": detect_form_hints(full_text),
        "parserName": parser_name,
        "parserVersion": parser_version,
        "parsedAt": datetime.now(timezone.utc).isoformat(),
        "pageCount": page_count,
    }


def normalize_docling_document(document: Any, parser_version: str) -> dict[str, Any]:
    blocks: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []

    iterate = getattr(document, "iterate_items", None)
    items = iterate() if callable(iterate) else []
    for item, _level in items:
        prov = _first_prov(item)
        page = int(getattr(prov, "page_no", 1) or 1)
        bbox = _bbox(prov, page) if prov is not None else None
        item_type = type(item).__name__
        if item_type == "TableItem" or item.__class__.__name__ == "TableItem":
            tables.append(_table_payload(item, page, bbox))
            continue
        text = str(getattr(item, "text", "") or "").strip()
        if not text:
            continue
        blocks.append(
            {
                "page": page,
                "text": text,
                "type": item_type,
                "bbox": bbox,
            }
        )

    page_count = len(getattr(document, "pages", {}) or {})
    if page_count == 0:
        page_count = max((int(block["page"]) for block in blocks), default=0)

    return assemble_parsed_tax_document(
        blocks=blocks,
        tables=tables,
        parser_name="docling",
        parser_version=parser_version,
        page_count=page_count,
    )
