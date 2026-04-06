# Lista de Mejoras Propuestas (Roadmap Técnico - Frontend Only)

Tras un análisis exhaustivo del código, he identificado las siguientes áreas de mejora clasificadas por prioridad e impacto.

## 🏗 Arquitectura y Refactorización (Prioridad Alta)

1.  **Migración a Context API (`ClientContext` & `ProjectContext`)** [COMPLETADO]
    - **Estado:** Implementado en `ProjectContext`. `App.tsx` refactorizado.

2.  **Implementación del Patrón Strategy para Verticales** [COMPLETADO]
    - **Estado:** Implementado en `strategies/StrategyFactory.ts` y clases de estrategia.

3.  **Capa de Abstracción de Datos (Repository Pattern)** [PARCIALMENTE COMPLETADO]
    - **Estado:** `SettingsRepository` y `ClientRepository` existen.
    - **Mejora Pendiente:** Refactorizar `useGSCAuth` y otros hooks para usar `SettingsRepository` en lugar de acceder directamente a `localStorage`.

4.  **Custom Hooks para Lógica Compleja** [COMPLETADO]
    - **Estado:** `useGSCAuth` y `useGSCData` implementados.

5.  **React Query / SWR (Data Fetching)** [COMPLETADO]
    - **Estado:** Implementado en `hooks/useGSCData.ts` usando `@tanstack/react-query`.
    - **Mejora:** Extender uso a futuras integraciones de API.

6.  **Eliminación de Prop Drilling en App.tsx** [PENDIENTE - CRÍTICO]
    - **Problema:** `App.tsx` pasa props (`modules`, `clients`, etc.) manualmente a través de rutas y layouts.
    - **Solución:** Refactorizar `AppRoutes` y componentes hijos para consumir `useProject()` directamente desde el contexto, simplificando la jerarquía de componentes.

7.  **Code Splitting y Lazy Loading** [PENDIENTE - PERFORMANCE]
    - **Problema:** Todas las páginas se importan estáticamente en `App.tsx`, aumentando el tamaño del bundle inicial.
    - **Solución:** Implementar `React.lazy()` y `Suspense` para cargar rutas bajo demanda (`pages/Dashboard`, `pages/ModuleDetail`, etc.).

8.  **Estandarización de Estructura de Carpetas** [PENDIENTE]
    - **Problema:** Estructura plana en la raíz (`App.tsx`, `types.ts`, `pages/` en root).
    - **Solución:** Mover código fuente a un directorio `src/` (`src/components`, `src/pages`, `src/context`, etc.) para seguir convenciones estándar de React/Vite.

9.  **Persistencia Robusta (IndexedDB)** [PENDIENTE]
    - **Problema:** `localStorage` tiene límite de 5MB y es síncrono.
    - **Solución:** Migrar a **IndexedDB** (usando `Dexie.js`) para manejar grandes volúmenes de datos (imágenes, logs extensos) sin bloquear el hilo principal.

## 🚀 Funcionalidades Nuevas (Valor para el Usuario)

10. **Sistema de Importación/Exportación (JSON)** [COMPLETADO]
    - **Estado:** Implementado en `DataManagementPanel`.

11. **Internationalization (i18n)** [COMPLETADO]
    - **Estado:** Implementado con `react-i18next`. Textos migrados a `locales/`.

12. **Streaming de IA (Respuesta en tiempo real)** [COMPLETADO]
    - **Estado:** Soportado en `services/aiTaskService.ts` (`onUpdate` callback) y utilizado en la funcionalidad "Vitaminizar".

13. **Progressive Web App (PWA)** [PENDIENTE]
    - **Mejora:** Habilitar capacidades offline completas y botón "Instalar app".

14. **Historial de Cambios (Undo/Redo)** [PENDIENTE]
    - **Mejora:** Implementar un stack de acciones para revertir cambios accidentales en roadmaps.

15. **Modo "Zen" o Foco**
    - **Mejora:** Una vista de detalle de tarea simplificada.

## 🎨 UX/UI y Calidad de Código

16. **Strict Typing (TypeScript)**
    - **Mejora:** Definir interfaces estrictas para `Task`, `LogEntry` y eliminar todos los `any`.

17. **Error Boundaries (Límites de Error)**
    - **Estado:** Parcialmente implementado.
    - **Mejora:** Envolver componentes críticos adicionales.

18. **Feedback de Carga Mejorado (Skeletons)**
    - **Mejora:** Implementar `Skeleton` screens para cargas de datos (GSC, AI) en lugar de spinners simples.

19. **Testing Unitario (Vitest)** [PRIORIDAD MEDIA]
    - **Estado:** Infraestructura básica presente.
    - **Mejora:** Añadir tests para lógica de negocio crítica:
      - `utils/gscInsights.ts` (Algoritmos de análisis)
      - `strategies/StrategyFactory.ts`

20. **Linting y Formateo** [COMPLETADO]
    - **Estado:** Configurado (ESLint + Prettier). scripts `lint` y `format` en `package.json`.

21. **Validación de Formularios**
    - **Mejora:** Usar `zod` o validación manual robusta.

### Reportes

- **Exportación Avanzada (PDF/CSV):** Añadir opciones de exportación profesional.

## 🌟 Nuevas Propuestas (Feb 2025)

22. **Memoria del Proyecto (Contexto Global IA)** [PENDIENTE]
    - **Mejora:** Permitir definir tono de marca, audiencia y competidores en Ajustes para inyectarlos en todos los prompts de IA.

23. **Tablero Kanban Global** [PENDIENTE]
    - **Mejora:** Vista unificada de tareas arrastrables (To Do, Doing, Done) independiente de los módulos.

24. **Monitor de Content Decay** [PENDIENTE]
    - **Mejora:** Algoritmo en `useGSCData` que compare periodos para detectar URLs con pérdida significativa de tráfico.

## 🎨 Guía visual mínima (Design Layer compartida)

### Tokens de marca

Se definieron tokens globales en:

- `tailwind.config.js` (mapeo Tailwind → variables CSS)
- `src/index.css` (`:root` / `.dark`)

Variables principales disponibles:

- Colores: `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--color-surface`, `--color-border`, `--color-foreground`, etc.
- Radios: `--radius-sm`, `--radius-md`, `--radius-lg`
- Sombras: `--shadow-card`, `--shadow-brand`
- Tipografía: `--font-sans`
- Espaciado: `--space-18`

### Componentes semánticos (`src/components/ui/`)

- `Button` (`primary | secondary | ghost | danger`)
- `Badge` (`primary | success | warning | danger | neutral`)
- `Card`
- `Input`
- `Modal`

### Ejemplos rápidos

```tsx
<Button variant="primary">Guardar</Button>
<Button variant="danger">Eliminar</Button>

<Badge variant="success">Activo</Badge>

<Card>
  <h3 className="section-title">Bloque</h3>
  <Input placeholder="Buscar..." />
</Card>

<Modal isOpen={open} onClose={() => setOpen(false)} title="Detalle">
  Contenido del modal
</Modal>
```

### Regla de revisión obligatoria

- ✅ En páginas (`src/pages/**`) **evitar clases de color directas** (`bg-blue-*`, `text-red-*`, etc.) para nuevos desarrollos.
- ✅ Usar primero componentes semánticos (`Button`, `Badge`, `Card`, `Input`, `Modal`) y tokens (`primary`, `surface`, `border`, `foreground`).
- ✅ Si se necesita un nuevo estado visual, extender tokens/variantes en la capa UI compartida en lugar de estilizar ad-hoc en la página.
