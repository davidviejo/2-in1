# Reporting Export Pack (MVP)

## Objetivo

Generar un bundle reusable por analistas fuera de la UI para **1 proyecto + 1 rango de fechas**.

## Dataset

Se habilita `dataset=report_pack` en el pipeline de exports.

- Formato soportado: `xlsx`
- Formato no soportado: `csv` (para preservar estructura multi-tab)
- Nombre de archivo estable: `report-pack_<projectId>_<from>_<to>.xlsx`

## Tabs estables del bundle

1. `summary_kpis`
2. `timeseries`
3. `prompts_performance`
4. `responses`
5. `citations`
6. `competitors_comparison`
7. `narrative_draft` (opcional)

## Narrative insights helper (opcional)

Activación: `filters.includeNarrativeInsights = true`.

Salida: bullets de asistencia de analista (no conclusiones finales) para:

- strongest prompts
- source opportunities
- competitor pressure
- model differences

Reglas:

- cada insight incluye los valores métricos utilizados;
- texto marcado como borrador: prefijo `Analyst draft:`;
- no se inventan claims fuera de los datasets del pack.
