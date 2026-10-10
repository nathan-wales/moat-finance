# Private Docling tax parser

Pinned Cloud Run wrapper around `ghcr.io/docling-project/docling-serve-cpu:v1.31.0`.

The official Docling Serve process is not exposed. This image runs a Moat-owned FastAPI wrapper that:

- converts files with local Docling only
- returns `ParsedTaxDocument`
- drains pending parse jobs from the Moat API
- writes files only to an ephemeral scratch directory and deletes them afterward

## Local

```bash
docker build -t moat-docling-tax-parser infra/docling
docker run --rm -p 18081:8080 \
  -e MOAT_PARSER_SCRATCH=/tmp \
  -e HF_HUB_OFFLINE=1 \
  moat-docling-tax-parser
curl http://127.0.0.1:18081/health
```

Map the container's 8080 to host **18081**. Host 8080 is commonly taken by other local services; the API will refuse to send tax files until `/health` reports `"parser":"docling"`.

Local API integration (no Google IAM):

```
DOCLING_PARSER_URL=http://127.0.0.1:18081
DOCLING_PARSER_ALLOW_INSECURE_LOCAL=true
```

If Docling/OpenCV crashes on this machine (`SIGILL` in `cv2`), disable OCR **inside Docling** — do not switch parsers:

```
docker run --rm -p 18081:8080 \
  -e MOAT_PARSER_SCRATCH=/tmp \
  -e HF_HUB_OFFLINE=1 \
  -e MOAT_PARSER_DISABLE_OCR=true \
  moat-docling-tax-parser
```

Hosted Cloud Run must leave OCR enabled so layout and tables run. `MOAT_PARSER_DISABLE_OCR` is a local workaround, not the production path.

## Tests

```bash
cd infra/docling
python -m unittest tests/test_normalize.py tests/test_convert_limits.py
```

## Benchmark

Synthetic, non-sensitive PDFs only:

```bash
python infra/docling/benchmark/run.py
```
