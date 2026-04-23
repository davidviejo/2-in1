# AI Visibility (Internal Analytics Shell)

Bootstrap de una app interna con **Next.js + TypeScript + Tailwind + Prisma + PostgreSQL**.

## Prerrequisitos

- Node.js 20+
- npm 10+
- PostgreSQL 14+

## Setup local

```bash
npm install
cp .env.example .env
```

Ajusta `DATABASE_URL` en `.env` según tu instancia local de PostgreSQL.

## Comandos

```bash
npm run dev        # desarrollo en http://localhost:3000
npm run build      # build de producción
npm run start      # ejecutar build
npm run lint       # eslint (Next.js)
npm run typecheck  # tsc --noEmit
npm run test       # vitest (run)
npm run test:watch # vitest modo watch
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
