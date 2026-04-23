# Backlog priorizado: AI Visibility Reporting App (interno)

## Objetivo del backlog
Entregar rápidamente una app interna capaz de producir reportes confiables sobre prompts, respuestas, citas, competidores y KPIs, con alcance mínimo productivo.

---

## Milestone 0 — Descubrimiento y setup (Día 0-1)
**Resultado esperado:** base del proyecto lista para ejecutar desde Tools Hub.

Tareas:
- Crear carpeta `apps-independientes/ai-visibility-reporting/`.
- Definir `app.manifest.json` compatible con launcher.
- Crear `README.md` operativo (instalación/arranque).
- Definir tipos canónicos de entidades en `lib/types.ts`:
  - `project`, `prompt`, `run`, `response`, `citation`, `competitor`, `tag`, `kpi_snapshot`.

Criterio de salida:
- App detectada por catálogo launcher y arrancable localmente.

---

## Milestone 1 — Ingesta mínima confiable (Día 1-3)
**Resultado esperado:** se pueden registrar datos núcleo de forma consistente.

Tareas:
- CRUD básico para `project` y `prompt`.
- Endpoint de creación de `run` con payload de ejecución.
- Persistencia de `response` asociada a `run`.
- Persistencia de `citation` asociada a `response`.
- Validaciones mínimas de integridad referencial en repositorio.

Criterio de salida:
- Flujo completo manual: project -> prompt -> run -> response -> citations.

---

## Milestone 2 — Competidores y segmentación (Día 3-4)
**Resultado esperado:** segmentación útil para análisis comparativo.

Tareas:
- CRUD de `competitor` por `project`.
- Sistema simple de `tag` (alta/listado y relación con prompt/run).
- Vistas básicas de filtrado por proyecto/tag/modelo.

Criterio de salida:
- Usuario interno puede revisar ejecuciones por segmento y competidor.

---

## Milestone 3 — KPI snapshots y reporte interno (Día 4-6)
**Resultado esperado:** reporte periódico reproducible.

Tareas:
- Motor de agregación para `kpi_snapshot` por periodo cerrado.
- KPIs v1:
  - cobertura de prompts,
  - tasa de respuesta válida,
  - latencia promedio,
  - frecuencia de citación por dominio,
  - share de presencia de competidor.
- Pantalla de reporte con tendencia entre snapshots.
- Export CSV/JSON de snapshot.

Criterio de salida:
- Se genera snapshot y se exporta reporte utilizable por operaciones.

---

## Milestone 4 — Calidad operativa mínima (Día 6-7)
**Resultado esperado:** app interna estable para uso recurrente.

Tareas:
- Pruebas de servicios críticos (agregación KPI y consistencia de entidades).
- Pruebas smoke de endpoints API.
- Manejo explícito de errores y estados parciales.
- Script simple de seed para demo interna.
- Checklist de operación interna (runbook corto).

Criterio de salida:
- Flujo estable y documentado para generar reportes semanalmente.

---

## Milestone 5 — Hardening incremental (post-MVP)
**Resultado esperado:** mayor resiliencia sin cambiar alcance núcleo.

Tareas:
- Job programado para ejecución de runs/snapshots.
- Auditoría de cambios de datos (history log).
- Normalización adicional de citas/dominios.
- Integración opcional con backend principal para vistas consolidadas.

---

## Orden de entrega recomendado
1. M0 + M1 (base funcional y datos trazables)
2. M3 (reporting temprano; valor de negocio rápido)
3. M2 (segmentación y comparativas)
4. M4 (estabilidad operativa)
5. M5 (mejoras)

> Nota: aunque M2 aparece antes en numeración de construcción técnica, para valor de negocio rápido conviene adelantar M3 tras tener datos suficientes de M1.

---

## Definición de “report-ready”
La app está lista para reporting interno cuando:
- Permite registrar y consultar todas las entidades clave.
- Puede generar `kpi_snapshot` de periodo cerrado de manera reproducible.
- Exporta evidencia (runs/responses/citations) y KPIs sin intervención manual compleja.
- Incluye trazabilidad mínima por proyecto y por tag.
