#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[backup] ERROR: DATABASE_URL is required."
  echo "[backup] Example: export DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&schema=public"
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTFILE="${1:-$BACKUP_DIR/ai-visibility-$STAMP.dump}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[backup] ERROR: pg_dump is not installed or not in PATH."
  exit 1
fi

echo "[backup] Creating backup at $OUTFILE"
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file "$OUTFILE" \
  "$DATABASE_URL"

echo "[backup] Done."
echo "[backup] Verify with: pg_restore --list $OUTFILE | head"
