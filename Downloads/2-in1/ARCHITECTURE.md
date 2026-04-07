# ARCHITECTURE.md

## Taxonomía operativa de dominios

| Dominio | Alcance | Frontend ownership | Backend ownership |
|---|---|---|---|
| `client-management` | Roadmap, kanban, snapshot de clientes/proyectos. | Team Client Core (`src/features/client-management/*`). | Team Client Core (`apps/web/blueprints/project_api.py`, `project_manager.py`). |
| `seo-engine` | Checklist IA, análisis de visibilidad y ejecución de motor SEO. | Team SEO Intelligence (`src/features/seo-engine/*`). | Team SEO Intelligence (`apps/web/blueprints/ai_routes.py`, `api_engine/*`). |
| `portal-auth` | Login de portal y autorización por rol/proyecto. | Team Platform Identity (`src/pages/portal/*` y servicios auth). | Team Platform Identity (`apps/web/auth_bp.py`, `apps/web/portal_bp.py`). |
| `legacy-tools` | Herramientas SEO históricas que aún no migran a dominios nuevos. | Team SEO Ops Legacy (`src/pages/ToolsHub.tsx` y utilidades). | Team SEO Ops Legacy (`apps/web/blueprints/*_tool.py`). |

## Reorganización frontend (feature-first)

Se estandarizó `src/features/*` por dominio para los módulos del roadmap:

- `src/features/client-management/roadmap`
  - `api/roadmapApi.ts`
  - `types/roadmapTypes.ts`
- `src/features/client-management/kanban`
  - `api/projectSnapshotApi.ts`
  - `types/kanbanTypes.ts`
- `src/features/seo-engine/checklist`
  - `api/checklistAiApi.ts`
  - `types/checklistAiTypes.ts`
- `src/features/seo-engine/visibility`
  - `api/visibilityApi.ts`
  - `types/visibilityTypes.ts`

Los servicios legacy en `src/services/*` quedaron como capa de compatibilidad (re-export) para no romper imports existentes durante la migración incremental.

## Reorganización backend por dominio

Se agregó registro de blueprints por dominio con prefijos versionados:

- Taxonomía y prefijos: `backend/p2/apps/web/domains/taxonomy.py`.
- Registro dominio→blueprints: `backend/p2/apps/web/domains/registry.py`.
- Activación en app factory: `backend/p2/apps/web/__init__.py` mediante `register_domain_blueprints(app)`.

Prefijos activos:

- `/api/v1/client-management/*`
- `/api/v1/seo-engine/*`
- `/api/v1/portal-auth/*`
- `/api/v1/legacy-tools/*` (reservado para migración progresiva)

## Ownership operativo y reglas

1. **Cada PR debe declarar dominio principal** (uno de la taxonomía) y equipo owner.
2. **Cambios cross-domain** requieren al menos 1 reviewer por cada dominio afectado.
3. **Versionado de APIs**: nuevas rutas deben publicarse bajo prefijo de dominio + versión.
4. **Compatibilidad**: rutas legacy se mantienen temporalmente hasta completar migración de consumidores.
5. **Plan de retirada**: mover endpoints `legacy-tools` a dominios objetivo antes de eliminar alias legacy.
