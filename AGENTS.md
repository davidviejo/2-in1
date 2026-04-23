# AGENTS.md

Guía operativa para trabajar en el ecosistema **2-in-1** (suite principal + backend + apps independientes).

## 1) Mapa real del monorepo

> ⚠️ En `/workspace/2-in1` hay metadatos. El código activo vive dentro de `Downloads/2-in1/`.

- **Raíz de trabajo real**: `Downloads/2-in1/`
- **Frontend principal (SPA)**: `Downloads/2-in1/frontend/m3` (React + Vite + TypeScript)
- **Backend principal**: `Downloads/2-in1/backend/p2` (Flask + Blueprints)
- **Apps independientes**: `Downloads/2-in1/apps-independientes/`
  - `local-seo-audit-poc` (Next.js 14 + TS, ejecución propia)
- **Scripts de orquestación/verificación**: `Downloads/2-in1/scripts/`
- **Runbook general**: `Downloads/2-in1/docs/RUNBOOK.md`
- **Histórico legado**: `Downloads/2-in1/Tendencias-medios-main` (referencia; no flujo canónico actual)

---

## 2) Ecosistema Frontend (principal)

### Ubicación y stack
- Ruta: `Downloads/2-in1/frontend/m3`
- Stack: React 19 + Vite 6 + TypeScript + Tailwind + React Query + Vitest + Playwright.

### Comandos oficiales
Desde `Downloads/2-in1/frontend/m3`:
- `npm install`
- `npm run dev` (default: `http://localhost:5173`)
- `npm run build`
- `npm run preview`
- `npm run test` (Vitest)
- `npm run test:e2e` (Playwright)
- `npm run lint`
- `npx tsc --noEmit` (typecheck; no script npm dedicado)

### Variables de entorno relevantes
- `VITE_API_URL`
- `VITE_API_PORT` (fallback default 5000)
- `VITE_PYTHON_ENGINE_URL`
- `VITE_GOOGLE_CLIENT_ID`

### Convenciones frontend
- Componentes/páginas: `PascalCase` (`src/components`, `src/pages`).
- Hooks: prefijo `use*` (`src/hooks`).
- Servicios: `camelCase` con sufijos `Service` / `Client` / `Repository`.
- Alias de imports: `@/`.
- En páginas, evitar colores hardcodeados (`text-slate-*`, `bg-blue-*`, etc.); usar componentes semánticos de `src/components/ui` y utilidades del design system.

### Nota de integración de Trends Media
- El módulo de tendencias/editorial ya está integrado en la SPA (`/#/app/trends-media`).
- No arrancar el proyecto legacy por separado para flujo normal.

---

## 3) Ecosistema Backend (principal)

### Ubicación y stack
- Ruta: `Downloads/2-in1/backend/p2`
- Stack: Python 3.11 + Flask + SQLite + Blueprints + pytest.

### Arranque local
Desde `Downloads/2-in1/backend/p2`:
- `python -m venv venv && source venv/bin/activate`
- `pip install -r requirements.txt`
- `python -m spacy download es_core_news_sm`
- `python run.py` (default: `http://127.0.0.1:5000`)

### Comandos de calidad/backend
- `pytest` o `make test`
- `make lint` (Ruff)
- `make format` (Ruff format, cuando aplique)
- `mypy run.py` (baseline actual; ver `pyproject.toml`)

### Arquitectura backend (guía rápida)
- Entrada: `run.py`
- Factory app: `apps/web/__init__.py`
- Blueprints: `apps/web/blueprints/**`
- Núcleo y utilidades: `apps/core/**`
- Datos/reportes/snapshots: `data/`, `reports/`, `snapshots/`

### Config/env sensible
- Mantener CORS y orígenes vía configuración (ej. `FRONTEND_URL`/`MEDIAFLOW_FRONTEND_URL`).
- Credenciales IA/API siempre server-side (no exponer secretos al frontend).

---

## 4) Ecosistema de Apps Independientes

### 4.1 `local-seo-audit-poc`
- Ruta: `Downloads/2-in1/apps-independientes/local-seo-audit-poc`
- Naturaleza: PoC **independiente** (no acoplada al frontend principal ni al backend Flask).
- Stack: Next.js 14 + React 18 + TypeScript.

Comandos:
- `npm install`
- `npm run dev` (default: `http://localhost:3000`)
- `npm run build`
- `npm run start`
- `npm run lint`

Estructura:
- `app/` (UI + API route local)
- `components/`
- `lib/` (tipos, scoring, reglas, report builder, mocks)

### 4.2 Criterio operativo para apps independientes
- No asumir integración automática con `frontend/m3` o `backend/p2`.
- Tratar puertos, dependencias y `.env` de cada app de forma aislada.
- Si una app independiente migra al core, documentar explícitamente ruta destino y estado de deprecación.

---

## 5) Orquestación full-stack del ecosistema principal

Desde `Downloads/2-in1`:
- Linux/Mac: `./scripts/dev.sh`
- PowerShell: `./scripts/dev.ps1`

Estos scripts son el punto recomendado para levantar frontend + backend principal juntos.

---

## 6) Seguridad y DO-NOT

- No commitear secretos ni artefactos locales: `.env`, `*.db`, `venv/`, `node_modules/`, `dist/`, `__pycache__/`.
- No hardcodear API keys o credenciales en código cliente/servidor.
- Mantener `.gitignore` al día si se agregan nuevos artefactos de build.
- Evitar abrir CORS con `*` sin justificación técnica y aprobación explícita.

---

## 7) Definición de Done (DoD)

Un cambio está “done” cuando:
1. Build/ejecución correcta en el ecosistema afectado.
2. Tests relevantes pasan en el alcance del cambio.
3. Lint/typecheck ejecutados donde existan comandos oficiales.
4. Si hay UI, validación visual realizada.
5. Sin secretos ni archivos locales en commit/PR.
6. Documentación actualizada cuando cambian rutas, scripts o responsabilidades entre frontend/backend/apps independientes.

---

## 8) Validación visual (cuando aplica UI)

Para cambios de interfaz:
- Levantar app afectada y validar flujo en navegador.
- Ejecutar E2E o scripts de verificación disponibles cuando aplique.
- Adjuntar screenshot/captura en la PR final.

---

## 9) Pendientes abiertos (sin inventar)

- Estandarizar comando oficial de typecheck backend completo.
- Formalizar alcance mínimo obligatorio de tests por tipo de cambio.
- Definir política única para promoción de apps independientes al ecosistema principal.
