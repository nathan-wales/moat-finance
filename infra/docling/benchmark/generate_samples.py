from __future__ import annotations

from pathlib import Path

SAMPLES = {
    "w2-born-digital": "Form W-2 Wage and Tax Statement 2025 Box 1 Wages: 50000.00 Box 2 Federal income tax withheld: 6200.00",
    "w2-scanned": "W-2 Wage and Tax Statement scanned copy Box 1 Wages: 48000.00",
    "w2-rotated": "Rotated W-2 Wage and Tax Statement Box 1 Wages: 51000.00",
    "1099-int": "Form 1099-INT Interest Income Interest income: 123.45",
    "1099-div": "Form 1099-DIV Dividends and Distributions Ordinary dividends: 88.10 Qualified dividends: 70.00",
    "1099-b": "Form 1099-B Proceeds from Broker and Barter Exchange Transactions Proceeds: 1000.00 Cost or other basis: 800.00",
    "consolidated-1099": "Consolidated Form 1099-INT 1099-DIV 1099-B Interest income: 12.00 Ordinary dividends: 34.00",
    "1098": "Form 1098 Mortgage Interest Statement Mortgage interest: 9400.00",
    "5498-sa": "Form 5498-SA HSA, Archer MSA, or Medicare Advantage MSA Information HSA contributions: 3600.00",
    "k1": "Schedule K-1 Form 1065 Partner's Share of Income Ordinary business income: 25000.00",
    "1040": "Form 1040 U.S. Individual Income Tax Return Taxable income: 90000.00",
    "brokerage-statement": "Account statement page 1 of 12 Form 1099-B Proceeds: 15000.00",
    "low-quality-scan": "W2 faint scan Box 1 Wages 42500.00 Box 2 Federal income tax withheld 4100.00",
}


def minimal_pdf(text: str) -> bytes:
    escaped = (
        text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")[:180]
    )
    stream = f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET".encode("latin-1", "replace")
    obj4 = (
        f"4 0 obj<< /Length {len(stream)} >>stream\n".encode("ascii")
        + stream
        + b"\nendstream\nendobj\n"
    )
    objects = [
        b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
        b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
        b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
        obj4,
        b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
    ]
    pieces = [b"%PDF-1.4\n"]
    offsets = [0]
    cursor = 9
    for obj in objects:
        offsets.append(cursor)
        pieces.append(obj)
        cursor += len(obj)
    xref_entries = ["0000000000 65535 f "]
    xref_entries.extend(f"{offset:010d} 00000 n " for offset in offsets[1:])
    xref = "xref\n0 6\n" + "\n".join(xref_entries) + "\n"
    trailer = f"trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n{cursor}\n%%EOF\n"
    return b"".join(pieces) + xref.encode("ascii") + trailer.encode("ascii")


def write_samples(output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for name, text in SAMPLES.items():
        path = output_dir / f"{name}.pdf"
        path.write_bytes(minimal_pdf(text))
        written.append(path)
    return written


if __name__ == "__main__":
    write_samples(Path(__file__).parent / "samples")
    print("wrote synthetic samples")
