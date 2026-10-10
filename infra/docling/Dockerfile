FROM ghcr.io/docling-project/docling-serve-cpu:v1.31.0

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    DOCLING_SERVE_ENABLE_UI=false \
    DOCLING_SERVE_ENABLE_REMOTE_SERVICES=false \
    DOCLING_SERVE_ENABLE_MANAGEMENT_ENDPOINTS=false \
    DOCLING_SERVE_DEBUG_ERROR_DETAILS=false \
    DOCLING_SERVE_LOAD_MODELS_AT_BOOT=true \
    DOCLING_SERVE_LOG_FORMAT=json \
    DOCLING_SERVE_LOG_LEVEL=WARNING \
    UVICORN_WORKERS=1 \
    MOAT_PARSER_SCRATCH=/scratch \
    MOAT_PARSER_MAX_FILE_BYTES=26214400 \
    MOAT_PARSER_MAX_PAGES=150 \
    PORT=8080

USER root
RUN mkdir -p /scratch /opt/app-root/src/moat_parser \
    && (id -u 1001 >/dev/null 2>&1 && chown -R 1001:0 /scratch /opt/app-root/src/moat_parser || true)
COPY app /opt/app-root/src/moat_parser/app
ENV PYTHONPATH=/opt/app-root/src/moat_parser
WORKDIR /opt/app-root/src/moat_parser
EXPOSE 8080
USER 1001

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "warning"]
