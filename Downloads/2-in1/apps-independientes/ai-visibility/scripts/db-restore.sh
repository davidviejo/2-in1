#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "[restore] ERROR: pass the backup file path."
  echo "[restore] Usage: scripts/db-restore.sh <backup.dump>"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[restore] ERROR: backup file not found: $BACKUP_FILE"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[restore] ERROR: DATABASE_URL is required."
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "[restore] ERROR: pg_restore is not installed or not in PATH."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[restore] ERROR: psql is not installed or not in PATH."
  exit 1
fi

echo "[restore] Target database: $DATABASE_URL"
echo "[restore] Backup file: $BACKUP_FILE"
echo "[restore] This process drops and recreates schema 'public'."

psql "$DATABASE_URL" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

pg_restore \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --dbname "$DATABASE_URL" \
  "$BACKUP_FILE"

echo "[restore] Re-applying Prisma migrations to ensure metadata consistency..."
npx prisma migrate deploy

echo "[restore] Done. Validate with: npm run test:smoke"
