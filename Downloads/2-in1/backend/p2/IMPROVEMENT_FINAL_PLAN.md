# Plan Final de Mejoras - SEO Suite Ultimate

Este documento sintetiza las mejores ideas de propuestas anteriores y añade hallazgos recientes del análisis del código actual (v17).

## 1. Reestructuración Arquitectónica (Prioridad: Inmediata)

El análisis de `apps/__init__.py` revela una estructura plana insostenible con más de 60 Blueprints registrados en un solo archivo.

### 🏗️ Organización por Dominios
**Problema:** `apps/` contiene 52+ archivos mezclados.
**Solución:** Mover los archivos a sub-paquetes temáticos.

```text
apps/
├── core/               # Lógica Base
│   ├── database.py     # Gestión de BD
│   ├── config.py       # Configuración (mover de root)
│   ├── monitor.py      # monitor_daemon.py
│   └── usage.py        # usage_tracker.py
├── tools/              # Herramientas SEO
│   ├── content/        # nlp_tool.py, gap_tool.py, draft_tool.py
│   ├── technical/      # audit_tool.py, wpo_tool.py, schema_tool.py
│   ├── backlinks/      # link_graph.py, link_opps.py
│   └── serp/           # scraper_core.py, serp_scanner.py
├── web/                # Capa Web
│   ├── blueprints/     # Definición de Blueprints agrupados
│   └── templates/      # (Mantenido en root o movido aquí)
└── utils/              # Funciones auxiliares
    └── tools_extra.py
```

### 🗄️ Centralización de Datos
**Problema:** Bases de datos dispersas (`projects.db` en root, `api_usage.db` en `apps/`).
**Solución:**
- Crear directorio `data/` en la raíz.
- Mover todos los `.db` y `.json` a `data/`.
- Actualizar `Config` para apuntar a estas nuevas rutas.

## 2. Calidad y Mantenibilidad del Código

### 🧹 Limpieza y Estandarización
**Problema:** Uso inconsistente de `print` vs `logging`, falta de tipado.
**Solución:**
- **Logging**: Reemplazar todos los `print()` en producción por `logger.info()` o `logger.error()`.
- **Linting**: Implementar `flake8` y `black`.
- **Typing**: Añadir Type Hints a las funciones core (ej. `scraper_core.py`).

### 🧩 Desacoplamiento de `scraper_core.py`
**Problema:** "God Object" que maneja lógica de navegador, red y parseo.
**Solución:**
- Separar en clases: `BrowserService` (Playwright), `RequestService` (Requests), `GoogleParser`.
- Eliminar variables globales `_BROWSER` para mejorar la seguridad en hilos.

## 3. Rendimiento y Escalabilidad

### ⚡ Gestión de Tareas (Workers)
**Problema:** Uso de `concurrent.futures` en memoria (se pierden tareas al reiniciar).
**Solución:**
- Implementar una cola persistente basada en SQLite (para no añadir Redis aún) o usar `RQ` si se permite Redis.
- Separar el proceso "Worker" del proceso "Web" (Flask).

### 🚀 Optimización del Frontend
**Problema:** Carga pesada y mezcla de estilos.
**Solución:**
- Unificar en **Tailwind CSS**.
- Usar **Server-Sent Events (SSE)** para actualizaciones en tiempo real en lugar de polling.

## 4. DevOps y Seguridad

### 📦 Gestión de Dependencias
**Problema:** `requirements.txt` básico.
**Solución:**
- Usar **Poetry** para gestionar dependencias y entornos virtuales de forma determinista.

### 🛡️ Seguridad
**Problema:** Secretos en código o generados al vuelo sin persistencia.
**Solución:**
- Forzar el uso de variables de entorno para `SECRET_KEY` y claves de API en producción.
- Validar rigurosamente los archivos subidos (actualmente se hace, pero reforzar).

---

## Plan de Ejecución Inmediata (Siguientes Pasos)

1. **Fase 1 (Limpieza)**: Crear carpetas `apps/core`, `apps/tools`, etc., y mover archivos. Actualizar imports.
2. **Fase 2 (Datos)**: Mover bases de datos a `data/`.
3. **Fase 3 (Calidad)**: Instalar `black` y formatear todo el proyecto.
