# Informe de Mejoras Técnicas (Frontend Only)

Tras la refactorización a una arquitectura Frontend-Only, se proponen las siguientes mejoras para la aplicación React.

## 🟠 Prioridad Alta (UX y Frontend)

### 1. Arquitectura de Datos Frontend (React Query)

- **Problema:** La gestión de llamadas API (si las hay a servicios externos) o estado asíncrono se hace manualmente con `useEffect`.
- **Solución:**
  - Implementar **TanStack Query (React Query)** o **SWR** para futuras integraciones de API.
  - Centralizar la lógica de fetching en hooks personalizados.

### 2. Internacionalización (i18n)

- **Problema:** Textos hardcodeados en español en componentes React.
- **Solución:**
  - Implementar **react-i18next**.
  - Extraer textos a archivos JSON (`es.json`, `en.json`).

## 🟡 Prioridad Media (DevOps y Calidad)

### 3. Infraestructura de Testing

- **Problema:** Cobertura de tests baja.
- **Solución:**
  - **Frontend:** Configurar `vitest` para componentes UI críticos y lógica de hooks.
