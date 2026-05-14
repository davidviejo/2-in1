# Inventario de uso legacy checklist (pre-retiro 30-jun-2026)

Fecha de corte: **2026-05-14**.

## 1) Pantallas, links e integraciones detectadas

- `GET /checklist` (blueprint legacy): ahora funciona **solo como redirección 302** al hash-route canónico `/#/app/checklist`.
- `GET /checklist/spa`: endpoint puente oficial, mantiene redirección a `/#/app/checklist`.
- `GET /workflow/checklist`: endpoint puente desde workflow, redirige al checklist SPA.
- Navegación legacy (`backend/p2/templates/base.html`) ya apunta a `/workflow/checklist` (puente oficial).

## 2) Alineación API checklist batch/canónica

Se confirma que el contrato operativo batch + análisis está en:

- `POST /api/analyze`
- `POST /api/jobs`
- `GET /api/jobs/<job_id>`
- `GET /api/jobs/<job_id>/items`
- `GET /api/jobs/<job_id>/items/<item_id>/result`
- `POST /api/jobs/<job_id>/pause`
- `POST /api/jobs/<job_id>/resume`
- `POST /api/jobs/<job_id>/cancel`

Implementación verificada en `backend/p2/apps/web/blueprints/api_engine/routes.py` y `backend/p2/apps/web/blueprints/api_engine/job_routes.py`.

## 3) Cierre de deuda legacy aplicado

- Se elimina la dependencia funcional de template legacy para checklist (`backend/p2/templates/checklist/dashboard.html`) al redirigir siempre `/checklist` hacia la SPA.
- Se mantiene compatibilidad de bookmarks en `/checklist` y `/workflow/checklist` mediante redirecciones puente.

## 4) Verificación de regresión esperada

- Backend: pruebas de redirección checklist + resolución de URL canónica.
- Frontend/UX: navegación checklist resuelta por SPA (`/#/app/checklist`) vía puente.

