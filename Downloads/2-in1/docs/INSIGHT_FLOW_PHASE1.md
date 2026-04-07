# Flujo unificado consultor -> cliente (Fase 1)

## Objetivo
Implementar un flujo incremental y retrocompatible:

`hallazgo -> insight -> oportunidad/riesgo -> acción recomendada -> tarea -> evidencia -> impacto`

Conexión funcional mínima: **Dashboard SEO (consultor) -> Insight detail -> creación de tarea en roadmap/kanban (cliente)**.

## 1) Modelo de datos común (Task.flow)
Se añade un campo opcional `flow` en `Task` (frontend) y normalización equivalente en `project_api` (backend).

Estructura:
- `finding`: hallazgo concreto (query principal)
- `insight`: objeto resumido (`id`, `title`, `summary`, `reason`)
- `opportunityOrRisk`: `opportunity | risk`
- `recommendedAction`: acción recomendada
- `evidence[]`: evidencias combinadas (insight + fila GSC)
- `impact`: score/confidence/opportunity/businessValue
- `source`: herramienta origen (`seo_dashboard_gsc_insights`) + query/url
- `phase`: marcador de versión (`phase1`)

Compatibilidad hacia atrás:
- Campo opcional, no rompe tareas previas.
- El backend sólo serializa `flow` si viene como objeto.

## 2) Servicios/acciones necesarias
- Nuevo servicio `insightFlowService`:
  - `buildInsightFlowTrace(insight, row)`
  - `buildTaskFromInsight(insight, row)`
- Acción `addTask` en `ProjectContext` ampliada con `options` opcionales:
  - `isInCustomRoadmap?: boolean`
  - `flow?: InsightFlowTrace`

## 3) Cambios mínimos viables
Frontend:
- `types.ts`: añade `InsightFlowTrace` y `Task.flow?`
- `InsightDetailModal.tsx`: al convertir insight en tarea:
  - usa `buildTaskFromInsight`
  - inserta tarea con `isInCustomRoadmap: true` para visibilidad en roadmap/kanban

Backend:
- `project_api.py`: preserva `flow` en normalización de tareas para snapshot remoto

## 4) Implementación inicial entregada
- Se puede crear una tarea desde un insight con trazabilidad completa.
- La tarea aparece en el ecosistema cliente (roadmap/kanban) sin reescribir el producto.
- El flujo queda persistido local/remoto dentro del snapshot de proyecto.

## 5) Tests de integración del flujo (Fase 1)
- Frontend (`insightFlowService.test.ts`): valida mapeo insight+row -> flow -> task.
- Backend (`test_project_api_insight_flow.py`): valida persistencia y lectura de `Task.flow` vía API de snapshot/tasks.

## 6) Migraciones pendientes
1. Backfill opcional de tareas históricas para añadir `flow.phase='legacy'`.
2. Índice/consulta dedicada en backend para filtrar tareas por `flow.source.tool` y `opportunityOrRisk`.
3. Endpoint dedicado de ingestión (`/insight-flow/tasks`) para evitar sincronización por snapshot completo.
4. Vinculación bidireccional evidencia<->resultado (estado de implementación e impacto real post-ejecución).
5. Normalización de catálogos de herramientas del consultor para múltiples fuentes más allá de GSC.

## Fase 2 (explícito)
- Medición de impacto real (antes/después clicks/ctr/posición) y cierre automático del ciclo.
- Reglas de deduplicación/merge de hallazgos repetidos.
- Timeline de evidencia en la tarjeta kanban (event sourcing ligero).
