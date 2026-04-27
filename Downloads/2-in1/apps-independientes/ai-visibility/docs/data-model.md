# Data model (MVP) — AI Visibility

Este documento describe el esquema núcleo para reporting interno de visibilidad AI. Está pensado para trazabilidad completa desde KPI -> run -> response -> evidencia.

## Objetivos de modelado

- Garantizar reportes por **project**, **date range**, **model**, **prompt**, **competitor** y **source domain**.
- Soportar ejecuciones **manuales hoy** y **programadas/importadas** en fases siguientes.
- Separar entidades maestras (configuración/catálogos) de entidades transaccionales (runs/responses/citations).
- Preservar histórico auditable: evitar borrado físico en entidades donde rompería el contexto analítico.

## ERD (texto)

```text
user 1---n project
user 1---n prompt (created_by)
user 1---n run (triggered_by)
user 1---n export_job (requested_by)

project 1---n brand_alias
project 1---n competitor
project 1---n tag
project 1---n prompt
project 1---n run
project 1---n response_brand_mention
project 1---n kpi_snapshot
project 1---n export_job

prompt n---n tag (via prompt_tag)
prompt 1---n run
prompt 1---n kpi_snapshot

run 1---n response
response 1---n citation
response 1---n response_brand_mention

competitor 1---n response_brand_mention
competitor 1---n kpi_snapshot
brand_alias 1---n response_brand_mention
```

## Responsabilidad por tabla

### `user`
Catálogo de usuarios internos que crean prompts, disparan runs o solicitan exports.

- Soft delete: `deleted_at` para conservar autoría histórica sin perder integridad.
- Índices: `email` único, `is_active`.

### `project`
Unidad principal de reporting y segmentación de datos.

- FK: `owner_user_id -> user.id`.
- Soft delete: justificado para mantener histórico de runs/snapshots aun si el proyecto se “retira”.
- Índices por owner/estado para listar y filtrar rápido.

### `brand_alias`
Lista de alias de la marca del proyecto para detección de menciones propias.

- FK: `project_id -> project.id`.
- Único compuesto: `(project_id, normalized_alias)`.

### `competitor`
Catálogo de competidores por proyecto (nombre, dominio, categoría).

- FK: `project_id -> project.id`.
- Soft delete: justificado para no romper comparativos históricos.
- Índices por proyecto y dominio.

### `tag`
Etiquetas de clasificación de prompts y análisis (topic/intent/market/campaign/custom).

- FK: `project_id -> project.id`.
- Soft delete: justificado para retirar etiquetas sin eliminar histórico.
- Único compuesto: `(project_id, type, name)`.

### `prompt`
Plantillas de prompts auditables por proyecto.

- FK: `project_id -> project.id`, `created_by_user_id -> user.id`.
- Campos de scheduling: `schedule_cron`, `schedule_timezone`, `is_schedule_active`.
- Soft delete: justificado para desactivar prompts preservando runs históricos.

### `prompt_tag`
Tabla pivote many-to-many entre prompt y tag.

- PK compuesta: `(prompt_id, tag_id)`.
- FKs con `on delete cascade` desde prompt/tag.

### `run`
Registro de cada ejecución del prompt (núcleo operacional).

- FK: `project_id`, `prompt_id`, `triggered_by_user_id`.
- Soporte manual/import/scheduled/API: `trigger_type`, `source`, `import_batch_key`, `scheduled_for`.
- Fechas clave: `executed_at`, `started_at`, `completed_at`.
- Índices orientados a reporting: proyecto+fecha, proyecto+modelo+fecha, prompt+fecha.

### `response`
Salida de cada run con métricas técnicas.

- FK: `run_id`.
- `ordinal` permite más de una respuesta por run.
- Métricas de coste/rendimiento: `token_in`, `token_out`, `latency_ms`, flags de error.

### `response_brand_mention`
Hechos de mención extraídos de la respuesta para share de marca/competencia.

- FK: `response_id`, `project_id`, opcional a `competitor_id` y `brand_alias_id`.
- `mention_type` distingue marca propia vs competidor.
- Índices por proyecto/tipo y por competidor.

### `citation`
Fuentes citadas por respuesta.

- FK: `response_id`.
- Campos analíticos: `source_domain`, `position`, `confidence`, `published_at`.
- Índice principal para reportes de fuente: `(source_domain, created_at)`.

### `kpi_snapshot`
Snapshot inmutable de métricas calculadas para periodos cerrados.

- FK: `project_id`, opcional `prompt_id`, `competitor_id`.
- Dimensiones de reporte: `model`, `source_domain`, `period_start`, `period_end`, `granularity`.
- `metrics_json` guarda payload agregado reproducible.
- Índices compuestos por proyecto + rango temporal + dimensión.

### `export_job`
Control de exportaciones asíncronas de reportes (CSV/JSON/XLSX).

- FK: `project_id`, `requested_by_user_id`.
- Estado de pipeline: `queued/running/succeeded/failed/canceled`.
- `filters_json` permite almacenar filtros usados en export.

## Estrategia de soft delete

Se aplica solo en entidades maestras donde el borrado lógico evita romper histórico:

- `user`
- `project`
- `competitor`
- `tag`
- `prompt`

No se aplica en hechos transaccionales (`run`, `response`, `citation`, `kpi_snapshot`, `export_job`, `response_brand_mention`, `prompt_tag`) para conservar trazabilidad lineal y simplificar agregaciones.

## Consultas de reporting soportadas

- Por proyecto y rango de fechas: índices en `run(project_id, executed_at)` y `kpi_snapshot(project_id, period_start, period_end)`.
- Por modelo: índice en `run(project_id, model, executed_at)` y dimensión `model` en snapshots.
- Por prompt: índice en `run(prompt_id, executed_at)` y FK opcional en snapshots.
- Por competidor: `response_brand_mention(competitor_id)` y snapshots con `competitor_id`.
- Por source domain: `citation(source_domain, created_at)` y snapshots con `source_domain`.

## Convenciones adicionales

- Todas las tablas principales incluyen timestamps de auditoría (`created_at`, `updated_at` donde aplica).
- FKs usan `on delete restrict` en entidades maestras para evitar pérdida accidental de historia.
- `on delete set null` se usa en relaciones opcionales (autor/trigger/competidor puntual) para preservar hechos.

## Dimensiones de análisis AI (P401 correction)

En `run` la app distingue explícitamente:

- `provider`: propietario del sistema (`openai`, `google`, `other`).
- `surface`: superficie de respuesta (`chatgpt`, `gemini`, `google_search`, `other`).
- `analysis_mode`: modo analítico de reporte (`chatgpt`, `gemini`, `ai_mode`, `ai_overview`, `other`).
- `model` (`model_label` lógico): etiqueta de modelo cuando se conoce; para AI Mode/AI Overview puede ir `unknown`.
- `capture_method`: cómo se capturó (`manual_import`, `api`, `browser_capture`, `other`).
- `environment`: entorno de captura (ej. `web-logged-in`, `web-incognito`).
- `country` y `language`: contexto geo/idioma del run.

Estas dimensiones son aditivas y no reemplazan reglas KPI existentes.
