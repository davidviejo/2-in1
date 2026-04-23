# GSC incremental analysis pipeline

## Objetivo
Escalar el análisis SEO de GSC sin bloquear UI ni truncar agresivamente datasets grandes.

## Arquitectura
1. `useGSCData` sigue descargando datasets completos para dashboard/export (`queryPageData`, `comparisonQueryPageData`).
2. El análisis de insights usa `runAnalysisInWorker` en modo incremental:
   - divide filas en chunks (`WORKER_ANALYSIS_CHUNK_SIZE`).
   - envía mensajes `INIT` + múltiples `CHUNK` + `FINALIZE`.
3. El worker agrega por clave `query||page` en mapas acumuladores (current/previous), reduciendo presión de memoria durante el stream.
4. En `FINALIZE`, se ejecuta `analyzeGSCInsights` contra filas agregadas, no contra lotes crudos gigantes en un único mensaje.
5. El progreso se reporta con eventos `PROGRESS` y se expone en `syncProgress.analysis` para UI.

## Resiliencia
- Si falla el pipeline incremental en cualquier punto, se retorna `EMPTY_INSIGHTS`.
- El dashboard conserva datos brutos y no se rompe.
- Se mantiene deduplicación de toasts para evitar loops de render.

## Guardarraíl
- El antiguo límite fijo de 120k por período se reemplaza por chunking.
- Se conserva un guardarraíl extremo (`WORKER_ANALYSIS_EXTREME_ROW_GUARDRAIL`) para evitar escenarios patológicos de memoria.
