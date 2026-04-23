# Riesgos técnicos principales y mitigación

## Objetivo
Identificar los riesgos que más comprometen una entrega rápida y confiable del internal AI visibility reporting app.

---

## Riesgo 1: Baja trazabilidad entre entidades
**Descripción:** datos desconectados entre `prompt`, `run`, `response` y `citation` impiden auditar KPIs.

**Impacto:** alto (reportes no confiables).

**Mitigación:**
- Forzar claves referenciales obligatorias en capa repositorio.
- Rechazar escrituras parciales que no incluyan IDs requeridos.
- Añadir pruebas de integridad del flujo completo.

---

## Riesgo 2: KPIs no reproducibles por recalculo sobre datos vivos
**Descripción:** si solo se consulta estado actual, un mismo periodo puede arrojar métricas distintas en días diferentes.

**Impacto:** alto (pérdida de confianza en reporting).

**Mitigación:**
- Introducir entidad `kpi_snapshot` inmutable por periodo.
- Versionar fórmula de KPIs en metadata del snapshot.
- Separar claramente “vista live” vs “snapshot reportable”.

---

## Riesgo 3: Extracción inconsistente de citations
**Descripción:** respuestas de modelos tienen formato variable y pueden romper parser.

**Impacto:** alto (sesgo en dominio citado y share competitivo).

**Mitigación:**
- Parser defensivo con fallbacks y estado `citation_extraction_status`.
- Guardar texto bruto de respuesta siempre.
- Marcar citas con `confidence` y permitir revisión manual mínima.

---

## Riesgo 4: Scope creep hacia producto SaaS
**Descripción:** intentar agregar auth avanzada, multi-tenant y UX compleja retrasa entrega.

**Impacto:** alto (no llegar a reporte útil en tiempo).

**Mitigación:**
- Congelar no-objetivos explícitos del MVP.
- Priorizar hitos de “report-ready” sobre mejoras cosméticas.
- Revisar backlog semanal contra criterio de valor interno inmediato.

---

## Riesgo 5: Acoplamiento prematuro con backend principal
**Descripción:** integrar demasiado pronto con `backend/p2` puede bloquear por deuda técnica existente.

**Impacto:** medio-alto (retraso por dependencias cruzadas).

**Mitigación:**
- Lanzar primero como app independiente en `apps-independientes/`.
- Definir contratos internos simples y estables.
- Posponer integración cross-app a post-MVP.

---

## Riesgo 6: Calidad de datos insuficiente para competidores/tags
**Descripción:** taxonomía inconsistente produce comparativas engañosas.

**Impacto:** medio.

**Mitigación:**
- Normalizar `competitor.domain` y catálogo controlado de `tag.type`.
- Validaciones de formato mínimas al alta.
- Reportar porcentaje de datos “sin clasificar”.

---

## Riesgo 7: Fragilidad operativa (arranque/ejecución/reportes)
**Descripción:** fallos de runtime local dificultan uso recurrente por el equipo.

**Impacto:** medio.

**Mitigación:**
- Manifest launcher claro y healthcheck básico.
- Runbook operativo breve para instalación, seed y generación de snapshots.
- Smoke tests de endpoints críticos antes de cada release interna.

---

## Riesgo 8: Seguridad y manejo de secretos
**Descripción:** posible exposición accidental de claves o datos sensibles en logs/responses.

**Impacto:** alto.

**Mitigación:**
- No almacenar secrets en payloads de `run`/`response`.
- Sanitizar logs y exportables.
- Mantener configuración por variables de entorno y respetar `.gitignore`.

---

## Riesgo 9: Falta de observabilidad básica
**Descripción:** sin métricas de errores/latencia de ingestión es difícil estabilizar.

**Impacto:** medio.

**Mitigación:**
- Log estructurado mínimo por endpoint.
- Contadores de errores por etapa (ingesta, parsing, snapshot).
- Panel simple interno de estado (último run, último snapshot, errores recientes).

---

## Riesgo 10: Dependencias nuevas prematuras
**Descripción:** añadir librerías temprano aumenta superficie de mantenimiento y riesgo de bloqueo.

**Impacto:** medio.

**Mitigación:**
- Empezar con stack y librerías existentes en el repo.
- Introducir dependencias solo con caso justificado y medible.
- Evaluar costo/beneficio antes de incorporar cualquier paquete nuevo.
