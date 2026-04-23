# AI Visibility (Scaffold)

Minimal application shell for an internal analytics app.

## Stack

- Next.js + TypeScript (App Router)
- Tailwind CSS
- PostgreSQL (via environment variables)
- Prisma (schema + client scaffolding)
- Vitest for lightweight tests

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env variables:
   ```bash
   cp .env.example .env.local
   ```
3. Start PostgreSQL locally and ensure `DATABASE_URL` points to your database.
4. (Optional) Generate Prisma client:
   ```bash
   npx prisma generate
   ```
5. Run the app:
   ```bash
   npm run dev
   ```

Default URL: `http://localhost:3000`

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run start` – run production server
- `npm run lint` – lint checks (Next.js ESLint)
- `npm run typecheck` – TypeScript checks
- `npm run test` – run tests once
- `npm run test:watch` – run tests in watch mode

## Notes

- This commit is scaffold-only. No business logic or database models are implemented yet.
- Routes included as placeholders: Overview, Prompts, Responses, Citations, Competitors, Tags, Settings.
