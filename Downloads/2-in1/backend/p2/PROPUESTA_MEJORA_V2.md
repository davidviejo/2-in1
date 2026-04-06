# Propuesta de Mejora V2 - SEO Suite Ultimate

Este documento presenta una síntesis actualizada y detallada de las áreas de mejora críticas para el proyecto, diseñada para transformar la base de código actual en una solución robusta, escalable y mantenible.

## 1. Arquitectura y Organización (Prioridad Alta)

### 📂 Modularización de `apps/`
**Estado Actual:** El directorio `apps/` es una estructura plana con más de 60 archivos, mezclando lógica de negocio, acceso a datos y controladores web (Blueprints).
**Propuesta:** Reestructurar en sub-paquetes semánticos:
- `apps/blueprints/`: Contenedor para todos los controladores web (`*_tool.py`).
- `apps/core/`: Lógica esencial del sistema (`scraper_core.py`, `database.py`, `config.py`, `extensions.py`).
- `apps/services/`: Procesos de larga duración y background jobs (`monitor_daemon.py`, `autopilot.py`, `queue_manager.py`).
- `apps/utils/`: Funciones auxiliares puras y validadores (`utils.py`, `security.py`).

### 🏭 Patrón "Application Factory" Puro
**Estado Actual:** `apps/__init__.py` inicia hilos (`start_monitor()`) y `apps/database.py` inicializa la BD (`init_db()`) al momento de la importación. Esto causa efectos secundarios graves en testing.
**Propuesta:**
- Eliminar llamadas a `start_monitor()` y `init_db()` del nivel global.
- Mover la inicialización explícita dentro de `create_app()` o comandos de CLI dedicados (e.g., `flask init-db`).

## 2. Estabilidad y Concurrencia (Crítico)

### 🔒 Thread-Safety en Scraping (`scraper_core.py`)
**Estado Actual:** Uso de variables globales (`_BROWSER`, `_PLAYWRIGHT`) para gestionar la instancia de Playwright. Esto no es seguro en entornos multi-hilo (como Flask por defecto).
**Propuesta:**
- Implementar clase `BrowserManager` (Singleton thread-safe).
- Usar un pool de contextos de navegador o garantizar aislamiento total por request.
- Considerar mover el scraping pesado a un servicio separado (microservicio) o workers de Celery/RQ.

### 🗄️ Centralización de Persistencia
**Estado Actual:** Archivos SQLite (`projects.db`, `trends_jobs.db`, etc.) dispersos en la raíz o subcarpetas.
**Propuesta:**
- Crear directorio `data/` en la raíz.
- Centralizar todos los archivos de estado persistente allí.
- Configurar rutas dinámicas en `config.py` en lugar de rutas relativas hardcodeadas (`os.path.dirname`).

## 3. DevOps y Calidad de Código

### 📦 Gestión de Dependencias
**Estado Actual:** `requirements.txt` contiene librerías sin versión (e.g., `flask`, `pandas`), lo que garantiza roturas futuras.
**Propuesta:**
- Fijar versiones mayores/menores (e.g., `flask~=3.0.0`).
- Evaluar uso de **Poetry** o **pip-tools** para lockfiles deterministas.

### 🧪 Estrategia de Testing
**Estado Actual:** Tests unitarios escasos y con dependencia de red real (lentos y frágiles).
**Propuesta:**
- Implementar `pytest-mock` obligatoriamente para tests de scraping.
- Crear fixtures para bases de datos temporales en memoria.
- Testear la "Application Factory" sin iniciar demonios de monitoreo.

### 📝 Observabilidad
**Estado Actual:** Mezcla de `print()` y `logging`. Excepciones silenciadas en algunos módulos.
**Propuesta:**
- Estandarizar `logging` con formato JSON o estructurado.
- Evitar `except Exception: pass` silenciosos; registrar siempre el stack trace.

## 4. Mejoras Funcionales Rápidas ("Quick Wins")

1. **Configuración Tipada:** Migrar `config.py` a clases Pydantic o usar `python-dotenv` para mejor validación de variables de entorno.
2. **Validación de Entradas:** Extender el uso de `apps.utils.is_safe_url` a todos los inputs de usuario que toquen red (SSRF protection).
3. **ORM Ligero:** Migrar consultas SQL crudas en `database.py` a SQLAlchemy Core o un ORM ligero para prevenir inyecciones y facilitar migraciones.
