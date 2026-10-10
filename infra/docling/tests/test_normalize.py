import unittest

from app.normalize import assemble_parsed_tax_document, detect_form_hints


class NormalizeTests(unittest.TestCase):
    def test_assembles_pages_tables_and_hints(self):
        parsed = assemble_parsed_tax_document(
            blocks=[
                {
                    "page": 1,
                    "text": "Form W-2 Wage and Tax Statement",
                    "type": "title",
                    "bbox": {"page": 1, "left": 1, "top": 2, "right": 3, "bottom": 4},
                },
                {"page": 1, "text": "Wages: $12,345.67", "type": "text"},
            ],
            tables=[
                {
                    "headers": ["Box", "Amount"],
                    "rows": [["1", "12345.67"]],
                    "page": 1,
                }
            ],
            parser_name="docling",
            parser_version="1.31.0",
            page_count=1,
        )
        self.assertIn("W-2", parsed["formHints"])
        self.assertEqual(parsed["keyValues"][0]["value"], "$12,345.67")
        self.assertEqual(parsed["pages"][0]["page"], 1)
        self.assertEqual(parsed["tables"][0]["headers"], ["Box", "Amount"])
        self.assertEqual(parsed["parserName"], "docling")
        self.assertEqual(parsed["sourceLocations"][0]["bbox"]["left"], 1)

    def test_detects_brokerage_form_family(self):
        text = "Consolidated Form 1099-B Proceeds from Broker and Barter Exchange"
        self.assertIn("1099-B", detect_form_hints(text))


if __name__ == "__main__":
    unittest.main()
