# AGENTS.md

Guía rápida para trabajar en este repo **2-in-1** (gestión de cliente + suite interna SEO).

## 1) Estructura real del repo
- Código principal: `Downloads/2-in1/`
  - Frontend SPA (React + Vite + TS): `Downloads/2-in1/frontend/m3`
  - Backend (Flask): `Downloads/2-in1/backend/p2`
  - Scripts de arranque/verificación: `Downloads/2-in1/scripts`
  - Runbook: `Downloads/2-in1/docs/RUNBOOK.md`
- Nota: en la raíz (`/workspace/2-in1`) casi no hay código de app; entrar siempre a `Downloads/2-in1`.

## 2) Levantar el proyecto
Desde `Downloads/2-in1`:
- Full stack (Linux/Mac): `./scripts/dev.sh`
- Full stack (PowerShell): `./scripts/dev.ps1`

Manual:
- Backend:
  - `cd backend/p2 && python -m venv venv && source venv/bin/activate`
  - `pip install -r requirements.txt`
  - `python -m spacy download es_core_news_sm`
  - `python run.py` (por defecto `:5000`)
- Frontend:
  - `cd frontend/m3 && npm install && npm run dev` (por defecto `:5173`)

## 3) Build, test, lint, typecheck
### Frontend (`frontend/m3`)
- Build: `npm run build`
- Unit tests (Vitest): `npm run test`
- E2E (Playwright): `npm run test:e2e`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit` (**no hay script npm dedicado**)

### Backend (`backend/p2`)
- Run: `python run.py`
- Tests: `pytest` (o `make test`)
- Lint: **TODO (no hay herramienta configurada en comandos oficiales)**
- Typecheck: **TODO (no hay herramienta configurada en comandos oficiales)**

## 4) Convenciones observadas en el código
- Frontend:
  - Componentes/páginas: `PascalCase` (`src/components`, `src/pages`).
  - Hooks: prefijo `use*` en `src/hooks`.
  - Servicios: `camelCase` con sufijo `Service`/`Client`/`Repository` en `src/services`.
  - Imports con alias `@/` habilitado en Vite/TS.
  - UI/tokens: usar componentes semánticos de `src/components/ui` y utilidades semánticas; en páginas evitar clases de color directas (`text-slate-*`, `bg-blue-*`, etc.) según `frontend/m3/README.md`.
- Backend:
  - Arquitectura modular con Flask Blueprints en `apps/web/blueprints`.
  - Entrada principal en `backend/p2/run.py` y factory en `apps/web/__init__.py`.

## 5) Seguridad y DO-NOT
- No commitear secretos ni archivos locales: `.env`, `*.db`, `venv/`, `node_modules/`, `dist/`, `__pycache__/` (ver `.gitignore`).
- No hardcodear credenciales/API keys en frontend ni backend; usar variables de entorno.
- Mantener CORS/orígenes controlados vía configuración (`FRONTEND_URL`) y no abrir comodines sin justificación.

## 6) Definición de Done (DoD)
Un cambio está “done” cuando:
1. Compila/build correcto en el ecosistema afectado.
2. Tests relevantes pasan (frontend: Vitest/E2E si aplica; backend: pytest en alcance).
3. Lint/typecheck ejecutados donde existan.
4. Si hay UI, validación visual realizada.
5. Sin secretos ni artefactos locales en el commit.

## 7) Validación visual
Para cambios de interfaz en `frontend/m3`:
- Ejecutar app y validar flujo en navegador.
- Usar E2E (`npm run test:e2e`) o scripts de verificación existentes (`frontend/m3/verify_frontend.py`, `scripts/verify_layout.py`) cuando aplique.
- Adjuntar captura/screenshot del estado final en la PR.

## Pendientes por validar (sin inventar)
- TODO: estandarizar comando oficial de **lint backend**.
- TODO: estandarizar comando oficial de **typecheck backend**.
- TODO: definir set mínimo obligatorio de tests por tipo de cambio (smoke vs suite completa).
