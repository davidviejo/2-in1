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
