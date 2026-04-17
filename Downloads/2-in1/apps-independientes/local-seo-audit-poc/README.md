# Local SEO Audit PoC (independiente)

Aplicación de prueba **totalmente independiente** del frontend y backend existentes del repo.

## Objetivo
Construir un motor de auditorías puntuales de SEO local asistido por IA para consultoría:

- Briefing de auditoría (negocio, keyword, ubicación)
- Selección competitiva (directo / parcial / irrelevante)
- Scoring por bloques
- Evidencias y separación hecho vs inferencia
- Recomendaciones priorizadas (7 / 30 / 90 días)
- Salida en formato dashboard interno (esta PoC)

## Stack usado
- Next.js 14 + TypeScript
- API Route local (`/api/audit`) para orquestar pipeline
- Dataset mock de listings para demostrar el flujo extremo a extremo

## Ejecución
```bash
cd Downloads/2-in1/local-seo-audit-poc
npm install
npm run dev
```
Abrir `http://localhost:3000`.

## Pipeline implementado
1. **Datos**: se reciben inputs del briefing.
2. **Normalización**: dataset simulado a esquema común (`Listing`).
3. **Clasificación competitiva**: afinidad por categoría + distancia geográfica.
4. **Scoring**: completitud, reputación, cobertura operativa y consistencia.
5. **Reglas**: hallazgos y priorización por impacto/dificultad.
6. **IA (simulada)**: redacción de diagnóstico técnico/comercial sobre datos calculados.
7. **Informe**: resumen ejecutivo, comparativa, hallazgos y plan accionable.

## Compliance incorporado en diseño
- Sin scraping directo de Google Maps.
- Uso de fuentes mock con nota de política para futura integración real.
- Preparado para integración futura con DataForSEO v3 como capa principal y Places API (FieldMask) como complemento controlado.

## Estructura
- `app/`: UI y endpoint API local
- `components/`: formulario y visualización del resultado
- `lib/`: tipos, clasificación, scoring, report builder y datos mock

## Estado
PoC funcional para validación de producto y flujo de auditoría puntual.
No incluye aún: persistencia, PDF real, colas asíncronas, auth, ni integraciones de API en producción.
