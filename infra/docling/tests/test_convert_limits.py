import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from app.convert import ParseLimitError, convert_file, ensure_parse_allowed

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "benchmark"))


class ConvertLimitTests(unittest.TestCase):
    def test_rejects_unsupported_type_before_conversion(self):
        with self.assertRaises(ParseLimitError) as raised:
            ensure_parse_allowed(b"%PDF-1.4", "application/zip")
        self.assertEqual(raised.exception.code, "unsupported_type")

    def test_rejects_oversize_payload_before_conversion(self):
        with self.assertRaises(ParseLimitError) as raised:
            ensure_parse_allowed(b"x" * (25 * 1024 * 1024 + 1), "application/pdf")
        self.assertEqual(raised.exception.code, "file_too_large")

    def test_convert_file_rejects_unsupported_type(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "document.bin"
            path.write_bytes(b"not-a-pdf")
            with self.assertRaises(ParseLimitError) as raised:
                convert_file(path, "application/octet-stream")
            self.assertEqual(raised.exception.code, "unsupported_type")

    def test_pdf_always_uses_docling_even_when_ocr_is_disabled(self):
        from generate_samples import minimal_pdf

        document = Mock()
        document.pages = {1: object()}
        document.iterate_items.return_value = []
        converter = Mock()
        converter.convert.return_value = Mock(document=document)

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "w2.pdf"
            path.write_bytes(
                minimal_pdf("Form W-2 Wage and Tax Statement Box 1 Wages: 50000.00")
            )
            os.environ["MOAT_PARSER_DISABLE_OCR"] = "true"
            try:
                with patch("app.convert.get_converter", return_value=converter):
                    parsed = convert_file(path, "application/pdf")
            finally:
                os.environ.pop("MOAT_PARSER_DISABLE_OCR", None)

        converter.convert.assert_called_once()
        self.assertEqual(parsed["parserName"], "docling")
        self.assertNotEqual(parsed["parserName"], "pypdfium2")


if __name__ == "__main__":
    unittest.main()
