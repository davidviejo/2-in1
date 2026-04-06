# Propuestas de Implementación (Análisis Técnico)

Basado en el análisis actual del código (v0.0.0), estas son las 4 implementaciones recomendadas para mejorar la escalabilidad, funcionalidad y valor del producto.

## 1. Migración a IndexedDB (Prioridad Alta - Arquitectura)

**Problema Actual:**
El proyecto usa `localStorage` en `services/clientRepository.ts`. Esto tiene un límite de ~5MB y bloquea el hilo principal (síncrono), lo que causará problemas de rendimiento a medida que crezcan los roadmaps y los logs de IA.

**Propuesta:**
Migrar la capa de persistencia a **IndexedDB** utilizando una librería ligera como **Dexie.js**.

**Pasos de Implementación:**

1.  Instalar `dexie`: `npm install dexie`.
2.  Crear `services/db.ts`: Definir el esquema de la base de datos (tablas: `clients`, `settings`, `aiLogs`).
3.  Refactorizar `ClientRepository` para usar métodos asíncronos (`db.clients.toArray()`, `db.clients.put()`).
4.  Migrar datos existentes de `localStorage` a `IndexedDB` en el primer arranque.

**Beneficio:**

- Almacenamiento ilimitado (hasta GBs).
- Operaciones asíncronas (UI no se congela).
- Soporte para blobs/imágenes en el futuro.

---

## 2. Memoria del Proyecto / Contexto Global de IA (Prioridad Media - Feature IA)

**Problema Actual:**
Cada vez que el usuario usa "Vitaminizar" o genera un Roadmap, debe introducir el contexto manualmente (o usar uno genérico). La IA no "recuerda" el tono de marca, el público objetivo o los competidores del cliente.

**Propuesta:**
Crear un sistema de **"Project Memory"** en los Ajustes del Cliente.

**Pasos de Implementación:**

1.  Actualizar la interfaz `Client` en `types.ts` para incluir un objeto `aiContext`:
    ```typescript
    aiContext: {
      brandTone: string; // Ej: "Profesional, cercano"
      targetAudience: string; // Ej: "PYMES de tecnología"
      competitors: string[];
      auditSummary: string; // Resumen técnico
    }
    ```
2.  Crear una nueva sección en la configuración del cliente para editar estos campos.
3.  Modificar `services/aiTaskService.ts` y `aiRoadmapService.ts` para inyectar automáticamente este contexto en el `systemPrompt` de todas las llamadas a OpenAI/Mistral/Gemini.

**Beneficio:**

- Generaciones de IA mucho más precisas y alineadas con la marca sin reescribir prompts.
- Experiencia de usuario más fluida ("Configúralo una vez, úsalo siempre").

---

## 3. Tablero Kanban Global (Prioridad Media - UX/Workflow)

**Problema Actual:**
Las tareas están fragmentadas en módulos (`/module/1`, `/module/2`). No existe una vista unificada para ver "qué está en progreso" o "qué está pendiente" a nivel de todo el proyecto.

**Propuesta:**
Implementar una vista de **Tablero Kanban** global.

**Pasos de Implementación:**

1.  Crear nueva ruta `/kanban` y componente `pages/KanbanBoard.tsx`.
2.  Utilizar `@hello-pangea/dnd` (ya instalado) para crear columnas: `To Do`, `In Progress`, `Review`, `Done`.
3.  Permitir arrastrar tareas entre estados.
4.  Persistir el cambio de estado en `ProjectContext`.

**Beneficio:**

- Gestión visual del flujo de trabajo.
- Mejor priorización de tareas entre diferentes módulos.

---

## 4. Monitor de "Content Decay" (Prioridad Media - SEO)

**Problema Actual:**
La integración de Search Console muestra "Estancamiento" pero no identifica explícitamente URLs que han **perdido** tráfico recientemente (Content Decay), una métrica crítica para SEO.

**Propuesta:**
Crear un algoritmo de detección de caída de tráfico.

**Pasos de Implementación:**

1.  Modificar `useGSCData.ts` para realizar dos peticiones a la API:
    - Periodo Actual (últimos 28 días).
    - Periodo Anterior (28 días previos).
2.  Comparar clics/impresiones por URL.
3.  Identificar URLs con una caída > 20% (ajustable).
4.  Mostrar estas URLs en un nuevo Widget de "Alerta de Decaimiento" en el Dashboard.

**Beneficio:**

- Insight accionable de alto valor para recuperación de tráfico.
- Diferenciador clave frente a herramientas básicas de GSC.
