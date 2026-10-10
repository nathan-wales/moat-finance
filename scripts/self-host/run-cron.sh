#!/bin/sh
# Calls one API cron path with the CRON_SECRET bearer token.
# Invoked by crond inside the `cron` compose service (see crontab).
set -eu
path="$1"
origin="$(cat /run/moat-cron/origin)"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
status="$(curl -sS -o /tmp/cron-last-response -w '%{http_code}' --max-time 900 \
	-H @/run/moat-cron/auth-header "${origin}${path}" || echo "000")"
echo "${started} cron ${path} -> HTTP ${status}" > /proc/1/fd/1
case "$status" in
	2*) exit 0 ;;
	*) echo "${started} cron ${path} failed: $(head -c 300 /tmp/cron-last-response 2>/dev/null)" > /proc/1/fd/2; exit 1 ;;
esac
