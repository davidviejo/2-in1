# Plan de Mejora Técnica Detallada (2025)

Este documento complementa el plan estratégico con acciones técnicas concretas para resolver la deuda técnica identificada en el frontend, backend y flujos de trabajo.

## 1. Frontend: Arquitectura Dinámica y Limpieza

### 🧩 Navegación Dinámica (Configuration-Driven UI)
**Problema:**
El archivo `templates/base.html` contiene más de **200 líneas de código HTML hardcodeado** para el menú lateral. Esto hace que añadir nuevas herramientas sea propenso a errores y difícil de mantener.

**Solución Propuesta:**
1. Crear `apps/config/navigation.py`:
   ```python
   SIDEBAR_MENU = [
       {"category": "Estrategia", "items": [
           {"name": "Cluster & SERP", "icon": "🚀", "url": "/seo"},
           {"name": "KW Intent", "icon": "🧠", "url": "/kw_intent"}
       ]},
       # ...
   ]
   ```
2. Inyectar esta variable globalmente en Flask (`context_processor`).
3. Refactorizar `base.html` para iterar sobre esta estructura:
   ```jinja2
   {% for category in menu %}
     <div class="sidebar-header-custom">{{ category.category }}</div>
     {% for item in category.items %}
       <a href="{{ item.url }}" class="nav-item-custom">...</a>
     {% endfor %}
   {% endfor %}
   ```

### 🧹 Eliminación de Deuda Bootstrap
**Problema:**
El proyecto carga **Bootstrap 5 (JS/CSS)** completo solo para mantener compatibilidad legacy, mientras usa **Tailwind** para lo nuevo. Esto causa conflictos CSS (`collapse`, `hidden`) y aumenta el tiempo de carga.

**Solución Propuesta:**
1. Identificar componentes legacy (Grids, Modales, Navbars).
2. Reemplazarlos por equivalentes en Tailwind (e.g., `grid-cols-12`, `dialog`).
3. Eliminar las etiquetas `<link>` y `<script>` de Bootstrap en `base.html`.

---

## 2. Backend: Escalabilidad y Concurrencia

### ⚡ Sistema de Colas Asíncronas (Task Queue)
**Problema:**
`apps/scraper_core.py` utiliza `threading.Lock` y variables globales (`_BROWSER_LOCK`) para gestionar Playwright. Esto es:
- **No escalable:** Bloquea los workers de Gunicorn/Flask.
- **Frágil:** Si un proceso muere, puede dejar el lock en estado inconsistente.

**Solución Propuesta:**
1. Introducir **Celery** o **RQ (Redis Queue)**.
2. Mover las tareas pesadas (`fetch_url_hybrid`, `scrape_google_serp`) a background workers.
3. El endpoint HTTP devuelve un `task_id` inmediatamente (202 Accepted) y el frontend hace polling para ver el progreso.

### 🧬 Patrón Strategy para Scraping
**Problema:**
La lógica de scraping es un script monolítico con múltiples `if/else` para manejar fallos y cookies.

**Solución Propuesta:**
Implementar una interfaz común `ScraperProvider`:
```python
class ScraperProvider(ABC):
    def fetch(self, url: str) -> str: pass

class PlaywrightProvider(ScraperProvider): ...
class ZenRowsProvider(ScraperProvider): ... # Futura integración
class RequestsProvider(ScraperProvider): ...
```
Esto permite cambiar de proveedor de scraping (e.g., usar proxies rotatorios externos) sin tocar el código de los controladores.

---

## 3. Calidad de Código y DevOps

### 🛑 Pre-commit Hooks
**Problema:**
El estilo de código varía entre archivos (comillas, indentación, imports no usados).

**Solución Propuesta:**
Instalar `pre-commit` con la siguiente configuración `.pre-commit-config.yaml`:
- `ruff`: Para linting rápido y corrección de imports.
- `black`: Para formateo de código estricto.
- `check-yaml`: Para validar archivos de configuración.

### 📌 Pinning Estricto de Dependencias
**Problema:**
`requirements.txt` tiene `flask`, `pandas`, `playwright` sin versión. Una actualización automática podría romper la app.

**Solución Propuesta:**
1. Crear `requirements.in` con dependencias de alto nivel.
2. Usar `pip-compile` para generar un `requirements.txt` con versiones congeladas (e.g., `flask==3.0.0`).

---

## Estado de adopción (Backend Quality Gate)

**Estado:** ✅ **Adoptado**

Se adopta un estándar mínimo de calidad para `backend/p2` con los siguientes componentes:

1. **Linting** con Ruff.
2. **Formateo** con Ruff formatter.
3. **Typecheck** con mypy.
4. **Testing** con pytest.
5. **CI por PR** ejecutando lint + typecheck + tests.

### Criterios de salida (Definition of Exit)

Se considera completada la adopción cuando en cada PR al menos se cumpla:

- `make lint` en verde.
- `make typecheck` en verde.
- `make test` en verde.
- Configuración centralizada en `pyproject.toml`.
- Documentación operativa en `backend/p2/README.md` con comandos de ejecución.
- Workflow de CI versionado en `.github/workflows/`.

### Criterio de mantenimiento

- Cualquier regla nueva debe añadirse en `pyproject.toml` y reflejarse en README.
- El workflow CI debe mantenerse como gate obligatorio para merge.
