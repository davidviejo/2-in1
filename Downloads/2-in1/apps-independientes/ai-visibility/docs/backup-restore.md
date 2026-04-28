# Database Backup and Restore (Reporting Data Protection)

This app stores reporting history and analysis runs in PostgreSQL. Use this guide to protect and recover data.

## Scope

Protect at minimum:

- project metadata
- runs and responses
- citations and tags
- KPI snapshots / historical reporting data

## Tools provided

- `scripts/db-backup.sh`
- `scripts/db-restore.sh`
- npm wrappers:
  - `npm run db:backup`
  - `npm run db:restore -- <backup-file>`

## Prerequisites

- `DATABASE_URL` exported to target environment.
- PostgreSQL client tools installed in runtime/ops machine:
  - `pg_dump`
  - `pg_restore`
  - `psql`

## Backup process

### 1) Create a backup

```bash
export DATABASE_URL='postgresql://user:pass@host:5432/ai_visibility?schema=public'
npm run db:backup
```

Default output folder: `./backups`.

Optional custom output path:

```bash
npm run db:backup -- ./backups/pre-release-2026-04-28.dump
```

### 2) Verify backup integrity

```bash
pg_restore --list ./backups/<file>.dump | head
```

If command prints schema/table entries, the backup is readable.

## Restore process (recovery flow)

> Warning: restore flow drops and recreates `public` schema in target database.

### 1) Confirm target and maintenance window

- validate environment (staging vs production)
- stop or scale down app writers if needed

### 2) Execute restore

```bash
export DATABASE_URL='postgresql://user:pass@host:5432/ai_visibility?schema=public'
npm run db:restore -- ./backups/<file>.dump
```

This command:

1. drops current `public` schema,
2. restores from dump,
3. runs `prisma migrate deploy` to ensure migration metadata is consistent.

### 3) Validate recovery

Run post-restore checks:

```bash
npm run test:smoke
curl -fsS https://<your-host>/api/health
```

And manually confirm historical reporting pages load expected data.

## Operational recommendations

- Frequency:
  - staging: daily backup
  - production: at least daily + pre-release backup
- Retention:
  - staging: 7-14 days
  - production: 30-90 days (policy-dependent)
- Keep backups encrypted at rest and in transit.
- Test restore at least monthly in staging.
- Record each backup/restore in an operations log (time, operator, DB target, outcome).
