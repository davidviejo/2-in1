# Guía de Buenas Prácticas: Creación de Código y Conexiones Frontend/Backend

## 1) Objetivo y alcance

Este documento centraliza criterios para:
- Escribir código mantenible en el ecosistema **2-in-1**.
- Gestionar integraciones entre el **frontend principal** (`frontend/m3`) y el **backend principal** (`backend/p2`).
- Evitar acoplamientos accidentales con **apps independientes** (`apps-independientes/*`).

## 2) Mapa operativo (fuente de verdad)

- Monorepo activo: `Downloads/2-in1/`.
- Frontend principal (SPA): `frontend/m3`.
- Backend principal (Flask): `backend/p2`.
- Apps independientes: `apps-independientes/*`.
- Scripts de arranque conjunto: `scripts/dev.sh` y `scripts/dev.ps1`.
- Runbook de entornos y despliegue: `docs/RUNBOOK.md`.

> Regla base: no asumir integración automática de apps independientes al core. Toda integración debe ser explícita, documentada y validada.

## 3) Principios de diseño para crear código

1. **Separación de responsabilidades**
   - UI y estado de interfaz en frontend.
   - Reglas de negocio, seguridad y acceso a datos en backend.
   - Evitar lógica sensible o secretos en cliente.

2. **Contratos antes que implementaciones**
   - Definir el contrato API (payloads, códigos, errores y versionado) antes de codificar consumidor y productor.
   - Evitar “normalizaciones legacy” duplicadas en frontend si el backend ya entrega formato canónico.

3. **Cambios pequeños, trazables e invertibles**
   - PRs acotadas por objetivo.
   - Commits atómicos con mensajes claros.
   - Mantener posibilidad de rollback rápido.

4. **Compatibilidad y migración progresiva**
   - Cuando haya campos nuevos, mantener degradación elegante.
   - No romper consumidores existentes sin plan de transición.

5. **Documentación viva**
   - Si cambian rutas, scripts, variables o responsabilidades entre frontend/backend/apps, actualizar `docs/` en el mismo cambio.

## 4) Estándares de implementación por capa

## 4.1 Frontend principal (`frontend/m3`)

- Stack esperado: React + Vite + TypeScript.
- Convenciones:
  - Componentes/páginas en `PascalCase`.
  - Hooks con prefijo `use*`.
  - Servicios en `camelCase` con sufijos `Service`/`Client`/`Repository`.
  - Imports con alias `@/`.
- UI:
  - Evitar colores hardcodeados en páginas.
  - Preferir componentes semánticos del design system (`src/components/ui`).
- Datos:
  - Centralizar llamadas API en capa de servicios.
  - Tipar request/response con interfaces/types explícitos.
  - Manejar loading, error y empty states consistentemente.

## 4.2 Backend principal (`backend/p2`)

- Stack esperado: Flask + Blueprints + Python 3.11.
- Arquitectura:
  - Entrada por `run.py` y factory app en `apps/web/__init__.py`.
  - Endpoints organizados por blueprint y dominio.
- Reglas:
  - Validar entrada en borde de API (tipos, obligatoriedad, rango).
  - Mantener lógica de negocio en servicios/core, no en controladores extensos.
  - Respuestas consistentes (estructura y códigos HTTP).
- Seguridad:
  - Credenciales/API keys siempre server-side.
  - CORS restringido por configuración (`FRONTEND_URL`/`MEDIAFLOW_FRONTEND_URL`), no abrir `*` sin justificación.

## 4.3 Apps independientes (`apps-independientes/*`)

- Tratar cada app como dominio aislado (puertos, deps, `.env`, pipelines).
- No reutilizar automáticamente clientes API del core sin adaptación y documentación.
- Si una app migra al ecosistema principal:
  - Definir destino (frontend principal, backend principal o ambos).
  - Crear plan de deprecación del módulo origen.
  - Documentar el impacto técnico y operativo.

## 5) Buenas prácticas de conexión frontend ↔ backend

1. **Diseñar contrato explícito**
   - Endpoint, método, schema de request/response, errores, timeouts y paginación.

2. **Versionar y estabilizar**
   - Si cambias shape de datos: soportar transición (compat capa backend o feature flags).

3. **Evitar acoplamiento al detalle interno**
   - Frontend no debe depender de estados internos/legacy sin mapear del backend.

4. **Observabilidad mínima**
   - Logging estructurado en backend.
   - Trazas de error útiles en frontend (sin exponer secretos).

5. **Resiliencia de red**
   - Timeouts y reintentos controlados para errores transitorios.
   - Mensajería de error clara para usuario y telemetría para soporte.

6. **Consistencia de entornos**
   - Variables de entorno alineadas entre local, staging y producción.
   - Evitar “works on my machine” usando scripts oficiales de orquestación.

## 6) Gestión de configuración y secretos

- Nunca commitear `.env`, bases locales, `venv`, `node_modules`, `dist`.
- Mantener `.env.example` actualizado cuando se agrega configuración nueva.
- Toda clave sensible debe residir en backend o gestor de secretos del proveedor.
- Revisar `.gitignore` al introducir nuevos artefactos.

## 7) Flujo recomendado de desarrollo (end-to-end)

1. Definir historia técnica + alcance.
2. Diseñar/confirmar contrato API.
3. Implementar backend (endpoint + validación + tests).
4. Implementar frontend (cliente + UI states + tests).
5. Ejecutar lint/typecheck/tests del ecosistema afectado.
6. Validar flujo funcional local (idealmente con `scripts/dev.sh` o equivalente).
7. Documentar cambios en `docs/`.
8. Preparar PR con evidencia (logs/tests/screenshot si hay UI).

## 8) Checklist de Definition of Done (DoD)

Antes de merge:

- [ ] Build/ejecución correcta en el ecosistema afectado.
- [ ] Tests relevantes pasan.
- [ ] Lint/typecheck ejecutados donde existan comandos oficiales.
- [ ] Validación visual (si hubo cambios UI).
- [ ] Sin secretos ni artefactos locales en commit.
- [ ] Documentación actualizada si cambian integraciones o responsabilidades.

## 9) Matriz rápida de “qué tocar” según tipo de cambio

- **Nuevo endpoint**:
  - Backend: blueprint + servicio/core + test.
  - Frontend: client/service + tipos + manejo de estados.
  - Docs: contrato o runbook según impacto.

- **Nuevo módulo UI conectado a datos**:
  - Frontend: componente/página + hooks + tests.
  - Backend: verificar endpoint estable y permisos.
  - QA: screenshot + validación de errores.

- **Integración de app independiente al core**:
  - Arquitectura: decisión formal de destino.
  - Migración: plan por fases y deprecación.
  - Operación: variables, puertos, build y despliegue documentados.

## 10) Anti-patrones a evitar

- Duplicar lógica de negocio en frontend y backend.
- Hardcodear URLs/puertos/credenciales en código.
- Romper contratos API sin estrategia de transición.
- Acoplar apps independientes al core sin diseño explícito.
- Subir artefactos locales o secretos al repositorio.

## 11) Referencias internas sugeridas

- `docs/RUNBOOK.md` (entornos, orquestación y despliegue).
- `docs/ENGINE_BATCH_API_CONTRACT.md` (ejemplo de contrato canónico).
- `docs/architecture.md` (criterios de separación e integración).
