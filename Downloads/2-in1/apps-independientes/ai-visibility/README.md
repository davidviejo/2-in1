# AI Visibility (Internal Analytics Shell)

Bootstrap de una app interna con **Next.js + TypeScript + Tailwind + Prisma + PostgreSQL**.

## Prerrequisitos

- Node.js 20+
- npm 10+
- Docker (para PostgreSQL local)

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
1. Levanta PostgreSQL local con `docker compose`.
2. Genera el cliente de Prisma.
3. Arranca Next.js en `http://localhost:3000`.

Si prefieres levantar solo la base:

```bash
npm run db:up
```

## Variables de entorno

Copia `.env.example` y ajusta valores si necesitas cambiar puertos/credenciales:

- `NEXT_PUBLIC_APP_NAME`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT`
- `DATABASE_URL`
- `AUTH_SESSION_SECRET` (recomendado para firmar sesión; si no existe usa fallback local de desarrollo)

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

## Comandos

```bash
npm run dev        # desarrollo en http://localhost:3000
npm run build      # build de producción
npm run start      # ejecutar build
npm run lint       # eslint (Next.js)
npm run typecheck  # tsc --noEmit
npm run test       # vitest (run)
npm run test:watch # vitest modo watch
npm run db:up      # levanta PostgreSQL local
npm run db:seed    # carga dataset demo de reporting (1 proyecto dental + data histórica)
npm run dev:local  # db + prisma + app
```

## Base de datos (Prisma)

```bash
npx prisma generate
```

> Nota: se incluye `prisma/schema.prisma` como base de scaffold. No hay lógica de negocio implementada todavía.

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
