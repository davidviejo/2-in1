# Arquitectura propuesta: Internal AI Visibility Reporting App

## 1) Objetivo y criterio de diseño
Construir una app interna de reporting de visibilidad en LLM/IA, enfocada en **confiabilidad, trazabilidad y velocidad de entrega**, no en UX SaaS avanzada.

Principios:
- **Mínimo alcance productivo**: solo lo necesario para generar reportes útiles y repetibles.
- **Evidencia primero**: cada KPI debe poder rastrearse hasta prompts/responses/citations.
- **Reutilizar plataforma existente**: integrar en `apps-independientes/` + launcher runtime ya disponible.
- **Evolución por fases**: primero ingesta y reportes internos; después mejoras de automatización.

---

## 2) Qué ya existe en el repo y se puede reutilizar

### 2.1 Plataforma principal (monorepo operativo)
- Backend Flask modular en `backend/p2` con Blueprints y APIs existentes.
- Frontend React/Vite en `frontend/m3` con catálogo de herramientas internas.
- Infra de runtime para apps integradas (`launcher_catalog` + `launcher_runtime`) lista para detectar/arrancar apps en `apps-independientes/`.

### 2.2 Patrón ya validado para apps independientes
- Existe `apps-independientes/local-seo-audit-poc` como referencia de app separada con su `app.manifest.json`.
- Tools Hub puede detectar y operar apps de `apps-independientes/<app>/app.manifest.json`.

### 2.3 Implicación para esta nueva app
La forma más rápida y segura de entrega es crear una nueva app independiente:
- `apps-independientes/ai-visibility-reporting/`
- Manifest para launcher.
- API interna dentro de la misma app para MVP (sin acoplarla todavía al backend principal), con opción futura de integración.

---

## 3) Límites y responsabilidades (Boundaries)

## 3.1 Dominio de la nueva app (scope MVP)
La app **sí** cubre:
- Registro de `project`.
- Catálogo de `prompt` por proyecto.
- Ejecuciones (`run`) con metadatos de modelo/proveedor.
- Almacenamiento de `response` y sus métricas básicas.
- Captura de `citation` estructurada por respuesta.
- Registro de `competitor` y comparación simple de share/cobertura.
- Etiquetado (`tag`) para segmentación.
- Snapshots de KPIs (`KPI snapshot`) para reportes periódicos.

La app **no** cubre en MVP:
- Integraciones complejas externas (APIs de terceros de pago).
- Automatización masiva con colas distribuidas.
- Multi-tenant SaaS ni permisos finos avanzados.

## 3.2 Relación con backend/frontend principales
- **Fase inicial**: app aislada en `apps-independientes` y accesible desde Tools Hub.
- **Fase posterior**: exponer endpoints de resumen al backend principal si se requiere consolidación transversal.

---

## 4) Modelo de entidades canónico (MVP)

## 4.1 Entidades requeridas
1. **project**
   - id, name, owner, status, created_at.
2. **prompt**
   - id, project_id, text, objective, language, tags[].
3. **run**
   - id, project_id, prompt_id, model, provider, executed_at, environment, status.
4. **response**
   - id, run_id, raw_text, normalized_text, token_in, token_out, latency_ms.
5. **citation**
   - id, response_id, source_url, source_domain, snippet, position, confidence.
6. **competitor**
   - id, project_id, name, domain, category.
7. **tag**
   - id, name, type (`topic`, `intent`, `market`, `campaign`).
8. **kpi_snapshot**
   - id, project_id, period_start, period_end, generated_at, metrics_json.

## 4.2 Reglas mínimas de consistencia
- Un `run` pertenece a un `project` y a un `prompt`.
- Un `response` pertenece a un único `run`.
- Una `citation` pertenece a un único `response`.
- `kpi_snapshot` siempre referencia periodo cerrado y es inmutable una vez generado.

---

## 5) Flujo de datos recomendado

## 5.1 Flujo operativo
1. Operador define/selecciona `project`.
2. Crea o reutiliza `prompt` (con `tag`).
3. Ejecuta `run` (manual al inicio, programado después).
4. Se guarda `response` con métricas técnicas.
5. Parser extrae `citation` (dominio, URL, snippet, orden).
6. Sistema agrega KPIs y genera `kpi_snapshot`.
7. Vista de reporting muestra evolución, competencia y fuentes citadas.

## 5.2 KPIs iniciales (report-ready)
- Cobertura de prompts ejecutados por periodo.
- Tasa de respuestas válidas (no error/no vacía).
- Latencia promedio por modelo.
- Frecuencia de citación por dominio.
- Share de presencia de `competitor` en citas/respuestas.
- Tendencia de métricas por `tag` y por proyecto.

---

## 6) Arquitectura técnica mínima (sin nuevas dependencias)

## 6.1 Opción recomendada para enviar rápido
Mantener stack del patrón existente en app independiente (Next.js + TypeScript como en el PoC), con:
- UI + API routes en la misma app para MVP.
- Persistencia inicial en almacenamiento local simple (archivo JSON o SQLite embebido si ya está disponible sin añadir librerías).
- Export de reportes en CSV/JSON desde servidor.

## 6.2 Estructura sugerida
```text
apps-independientes/ai-visibility-reporting/
  app/
    page.tsx
    projects/page.tsx
    reports/page.tsx
    api/
      projects/route.ts
      prompts/route.ts
      runs/route.ts
      snapshots/route.ts
  lib/
    types.ts
    repository.ts
    kpi.ts
    citations.ts
  data/
    ai_visibility.db   # o json store (según implementación final)
  app.manifest.json
  README.md
```

## 6.3 Contratos internos (MVP)
- `POST /api/projects`
- `POST /api/prompts`
- `POST /api/runs`
- `GET /api/runs?project_id=...`
- `POST /api/snapshots/generate`
- `GET /api/snapshots?project_id=...`

---

## 7) Decisiones clave
1. **App independiente primero** para no bloquearse por refactors del backend principal.
2. **Modelo de datos explícito y auditable** desde el día 1.
3. **Snapshot de KPI como unidad de reporte** para estabilidad histórica.
4. **Automatización gradual**: empezar manual confiable, luego scheduling.

---

## 8) No-objetivos explícitos (MVP)
- No crear motor de crawling avanzado ni adquisición automática masiva.
- No construir RBAC enterprise completo.
- No diseñar branding/UI sofisticado; solo panel interno funcional.

