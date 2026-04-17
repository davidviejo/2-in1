# Especificación funcional resumida (implementada en PoC)

## Definición
Motor de auditorías puntuales de SEO local asistido por IA para consultores y agencias.

## Alcance implementado
- Entrada de auditoría (negocio, web, keyword principal/secundarias, ubicación, categoría, sector).
- Ingesta simulada de datos normalizados en esquema interno.
- Clasificación competitiva: directo/parcial/irrelevante.
- Scoring por bloques.
- Motor de evidencias y separación de hechos/inferencias.
- Capa narrativa IA simulada para informe técnico y comercial.
- Dashboard interno con salida accionable.

## Fuera de alcance actual
- Scraping de Google Maps.
- Tracking continuo.
- CRM.
- Directorio masivo.
- Integraciones reales DataForSEO/Google Places (dejadas para siguiente fase).

## Reglas de negocio codificadas
1. No todo resultado es competidor.
2. Toda recomendación requiere evidencia.
3. La capa IA no sustituye el motor de análisis.
4. Hechos e inferencias se muestran separados.
5. Auditoría puntual por caso.

## Criterios de aceptación internos de la PoC
- Genera auditoría de extremo a extremo.
- Produce scoring y plan 7/30/90.
- Muestra competidores relevantes y excluye irrelevantes.
- Muestra política de datos/compliance en resultado.
