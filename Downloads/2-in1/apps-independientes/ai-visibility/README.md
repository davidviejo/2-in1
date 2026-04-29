# AI Visibility (Internal Analytics Shell)

Bootstrap de una app interna con **Next.js + TypeScript + Tailwind + Prisma + Supabase Postgres**.

## Prerrequisitos

- Node.js 20+
- npm 10+
- Proyecto de Supabase con credenciales de Postgres

## Setup local (nuevo desarrollador)

```bash
npm install
cp .env.example .env
```

## Arranque local en un comando

```bash
npm run dev:local
```

Este comando:
1. Genera el cliente de Prisma.
2. Aplica migraciones pendientes en la base de datos configurada.
3. Arranca Next.js en `http://localhost:3000`.

> Requiere `DATABASE_URL`/`DIRECT_URL` apuntando a Supabase antes de iniciar.

Si es la primera vez que levantas el entorno, después de `dev:local` ejecuta en otra terminal:

```bash
npm run db:seed
```

Esto carga un proyecto demo para que `GET /api/projects` devuelva datos desde el inicio.

## Setup con Docker

```bash
cp .env.docker.example .env.docker
# editar variables sensibles (AUTH_SESSION_SECRET y llaves de providers)
docker compose up --build
```

Esto levanta:
- App Next.js en `http://localhost:3000`
- PostgreSQL local en `localhost:5434`

La app ejecuta `prisma migrate deploy` al iniciar el contenedor para aplicar migraciones pendientes.

## Variables de entorno

Copia `.env.example` y ajusta valores si necesitas cambiar puertos/credenciales:

- `NEXT_PUBLIC_APP_NAME`
- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SESSION_SECRET` (recomendado para firmar sesión; si no existe usa fallback local de desarrollo)
- `OPENAI_API_KEY` / `OPENAI_DEFAULT_MODEL` (ChatGPT real API)
- `GEMINI_API_KEY` / `GEMINI_DEFAULT_MODEL` (Gemini real API)
- `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` / `DATAFORSEO_LOCATION_CODE` (Google AI Mode + AI Overview vía DataForSEO)

> Nota: sin Docker, `DATABASE_URL` sigue siendo obligatoria y normalmente apunta a Supabase. Con Docker Compose puedes usar PostgreSQL local (`postgres`).

## Auth MVP (internal-tool friendly)

La app usa autenticación por cookie HttpOnly firmada y roles básicos para autorización:

- `admin`
- `editor`
- `viewer`

### Protección de rutas de app

- Todas las páginas de aplicación (`/`, `/prompts`, `/responses`, etc.) requieren sesión.
- Usuarios sin sesión son redirigidos a `/login`.
- `/login` es pública y muestra usuarios seed de desarrollo.

### Usuarios seed para desarrollo local

| Role | Email | Password |
| --- | --- | --- |
| admin | `admin@internal.local` | `admin123` |
| editor | `editor@internal.local` | `editor123` |
| viewer | `viewer@internal.local` | `viewer123` |

> Estas credenciales son solo para entorno local interno.

### Reutilización de autorización (API/server)

Helpers en `lib/auth/authorization.ts`:

- `hasRole(user, requiredRole)`
- `requireRole(user, requiredRole)`
- `canAccessProject(user, { projectId, requiredRole? })`
- `requireProjectAccess(...)`

El guard de proyecto es intencionalmente simple para MVP (shape listo para evolucionar a memberships reales).

## Health check

Ruta: `GET /api/health`

Ejemplo de respuesta OK:

```json
{
  "status": "ok",
  "app": "up",
  "db": "up",
  "timestamp": "2026-04-23T00:00:00.000Z"
}
```

Si la base de datos no está disponible, responde `503` con `db: "down"`.


### Prisma 7 vs Prisma 5 (Windows / npx)

Si ejecutas `npx prisma ...` sin versión fijada, `npx` puede descargar Prisma 7 y verás el error `P1012` sobre `url/directUrl` en `schema.prisma`.

Para este proyecto usa Prisma 5.22.0 (alineado con el repo):

```bash
npm install
npm run prisma:generate
npm run db:migrate:deploy
```

Si quieres comando directo, fija versión explícita:

```bash
npx prisma@5.22.0 generate
npx prisma@5.22.0 migrate deploy
```

`ERR_MODULE_NOT_FOUND: @prisma/client` normalmente indica que faltó `npm install` o no se generó el cliente todavía.

## Troubleshooting rápido: error en `/api/projects`

Si en el navegador ves error en la API de proyectos (normalmente `500`), revisa este orden:

1. **Variables de entorno**: confirma que `DATABASE_URL` y `DIRECT_URL` existen y apuntan al Postgres correcto.
2. **Migraciones**: ejecuta `npm run db:migrate:deploy` (si no usaste `dev:local`, este paso es obligatorio).
3. **Datos iniciales**: ejecuta `npm run db:seed` para crear al menos un proyecto demo.
4. **Autenticación**: inicia sesión en `/login` con usuarios seed (`admin@internal.local`, etc.).
5. **Health**: valida `GET /api/health`; si devuelve `db: "down"` el problema es conectividad DB.

## Comandos

```bash
npm run dev        # desarrollo en http://localhost:3000
npm run build      # build de producción
npm run start      # ejecutar build
npm run lint       # eslint (Next.js)
npm run typecheck  # tsc --noEmit
npm run test       # vitest (run)
npm run test:watch # vitest modo watch
npm run db:seed    # carga dataset demo de reporting (1 proyecto dental + data histórica)
npm run db:migrate:deploy # aplica migraciones pendientes (CI/prod)
npm run db:check:migrations # valida drift schema vs migraciones SQL
npm run db:backup     # backup PostgreSQL (requiere DATABASE_URL + pg_dump)
npm run db:restore -- <file.dump> # restore DB (destructivo sobre schema public)
npm run dev:local  # db + prisma + app
```

## Base de datos (Prisma)

```bash
npm run prisma:generate
```

> Prisma schema y migraciones están activas y alineadas con el flujo de reporting/export actual.

## Rutas placeholder incluidas

- `/` (Overview)
- `/prompts`
- `/responses`
- `/citations`
- `/competitors`
- `/tags`
- `/settings`
- `/login`

## Analysis modes first-class

La app soporta como modos de análisis de primer nivel:

- `chatgpt`
- `gemini`
- `ai_mode`
- `ai_overview`

`provider`, `surface`, `analysisMode`, `model`(model_label), `captureMethod`, `country` y `language` se almacenan en `run` y pueden usarse para reporting y filtros.

## Live analysis (real provider APIs)

- Desde **Prompts**, cada prompt incluye acción **Run live**.
- El selector **Live analysis mode** permite elegir `chatgpt`, `gemini`, `ai_mode` o `ai_overview`.
- El backend ejecuta:
  - OpenAI official API (`/v1/responses`) para `chatgpt`.
  - Gemini official API (`models.generateContent`) para `gemini`.
  - DataForSEO API (`/v3/serp/google/ai_mode/live/advanced`) para `ai_mode` y `ai_overview`.
- Cada ejecución persiste `run`, `response`, `citations` y detección de `brand_mentions` para alimentar dashboard y reportes.


## Operación y despliegue

- Runbook de despliegue: `docs/deployment.md`
- Estrategia de backup/restore: `docs/backup-restore.md`
- CI de PR: `.github/workflows/ci.yml`


## Report-ready export pack (MVP)

Endpoint: `POST /api/projects/:projectId/exports` con `dataset=report_pack` y `format=xlsx`.

El pack exporta un bundle consistente para **1 proyecto + 1 date range**, con tabs estables:

1. `summary_kpis`
2. `timeseries`
3. `prompts_performance`
4. `responses`
5. `citations`
6. `competitors_comparison`
7. `narrative_draft` (opcional, si `filters.includeNarrativeInsights=true`)

Notas:
- `report_pack` no soporta `csv` para evitar pérdida de estructura multi-sección.
- Los datasets de detalle (`responses`/`citations`) respetan el rango `from`/`to` del pack.
- El contenido está pensado para uso externo por analistas sin SQL manual.

### Narrative-insights helper (asistencia de analista)

El helper genera bullets borrador sobre:
- strongest prompts
- source opportunities
- competitor pressure
- model differences

Cada bullet empieza con `Analyst draft:` y reporta explícitamente los valores métricos usados (sin claims inventados).
