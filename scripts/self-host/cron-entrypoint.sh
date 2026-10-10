#!/bin/sh
# Entrypoint for the `cron` compose service: runs the jobs in apps/api/vercel.json `crons` (via the generated crontab).
set -eu
if [ -z "${CRON_SECRET:-}" ]; then
	echo "cron: CRON_SECRET is not set; refusing to start (run scripts/self-host/generate-secrets.sh)" >&2
	exit 1
fi
mkdir -p /run/moat-cron
chmod 700 /run/moat-cron
# Keep the secret out of process args: curl reads the header from a file.
printf 'Authorization: Bearer %s\n' "$CRON_SECRET" > /run/moat-cron/auth-header
printf '%s' "${CRON_API_ORIGIN:-http://api:3001}" > /run/moat-cron/origin
chmod 600 /run/moat-cron/auth-header
crontab /self-host/crontab
echo "cron: installed $(grep -c '^[^#]' /self-host/crontab) jobs against ${CRON_API_ORIGIN:-http://api:3001}"
exec crond -f -l 8
