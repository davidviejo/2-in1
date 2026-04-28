# Deployment Runbook (Staging + Production)

This document describes a vendor-neutral way to deploy **ai-visibility** and operate it safely.

## 1) Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 14+ (or managed equivalent)
- Network access from app runtime to PostgreSQL
- Credentials for optional providers (OpenAI, Gemini, DataForSEO)

## 2) Required environment variables

Minimum required for app startup and auth:

- `DATABASE_URL` (PostgreSQL connection string)
- `AUTH_SESSION_SECRET` (random secret for signing auth cookie)
- `NEXT_PUBLIC_APP_NAME` (display name only)

Optional provider variables (needed only for live analysis modes):

- `OPENAI_API_KEY`
- `OPENAI_DEFAULT_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_DEFAULT_MODEL`
- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `DATAFORSEO_LOCATION_CODE`

> Use `.env.example` as a key reference and set real values through your secret manager, not in Git.

## 3) Build + release flow

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
3. Run quality gate before deploy:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run test:smoke
   npm run db:check:migrations
   ```
4. Build artifact:
   ```bash
   npm run build
   ```
5. Promote artifact to target environment.

## 3.1) Docker Compose (local/staging quickstart)

For containerized execution of the app:

1. Create env file from template:
   ```bash
   cp .env.docker.example .env.docker
   ```
2. Review secrets (`AUTH_SESSION_SECRET`, provider keys).
3. Build and start services:
   ```bash
   docker compose up --build
   ```
4. Stop services:
   ```bash
   docker compose down
   ```

By default, Compose runs:
- `ai-visibility` app on `http://localhost:3000`
- `postgres` on `localhost:5434`

The app container executes `npm run db:migrate:deploy` before `npm run start`.

## 4) Database migration process

Use Prisma migrations from `prisma/migrations`.

### Deploy migrations

```bash
npm run db:migrate:deploy
```

This applies pending migrations in order and is safe for CI/CD pipelines.

### Validate migration integrity (no drift between schema and SQL migrations)

```bash
npm run db:check:migrations
```

Run this in PR checks and before release.

## 5) Seeding strategy

- Development/demo seed script: `npm run db:seed`
- For staging/prod, seed only deterministic baseline records needed for app operation (avoid synthetic analytics noise).
- Recommended approach:
  - Keep seed logic idempotent.
  - Separate "required baseline" seed from "demo/sample" seed.
  - Run seed only on first environment bootstrap or when explicitly required.

## 6) Staging vs production notes

### Staging

- Use isolated database and credentials.
- Use lower-cost provider models where possible.
- Run full CI checks + smoke tests on every PR merge.
- Allow test/demo data seeding with clear labels.

### Production

- Use dedicated DB with stricter retention and access controls.
- Require manual approval after staging validation.
- Lock down who can run migrations.
- Enable regular backups and restore drills (see `docs/backup-restore.md`).
- Do not run demo seed datasets.

## 7) Post-deploy validation

1. Verify health endpoint:
   ```bash
   curl -fsS https://<your-host>/api/health
   ```
2. Run a lightweight smoke:
   - login flow
   - list projects
   - open Overview and Prompts
3. Confirm DB writes:
   - create/update one record in staging
   - verify in UI and DB

## 8) Rollback basics

If deployment fails:

1. Revert app artifact to previous stable version.
2. If migration introduced a breaking change:
   - restore database from backup snapshot,
   - re-deploy previous app version.
3. Document incident timeline and corrective action in runbook/ops notes.
