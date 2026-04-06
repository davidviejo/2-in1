# Plan de Mejora Integral para SEO Suite Ultimate (2025)

Este documento consolida y expande las ideas de mejora generadas previamente, incorporando nuevos hallazgos tras un análisis reciente del código base. El objetivo es transformar el proyecto en una aplicación robusta, segura y mantenible.

## 1. Arquitectura y Estructura del Proyecto

### 🏗️ Reorganización del Directorio `apps/`
**Diagnóstico:** El directorio `apps/` es una estructura plana con más de 60 archivos que mezclan responsabilidades (rutas web, lógica de negocio, utilidades).
**Acción:** Reestructurar en sub-paquetes semánticos:
- `apps/web/`: Blueprints y rutas HTTP (e.g., `audit_bp.py`, `dashboard_bp.py`).
- `apps/services/`: Lógica de negocio pura y servicios (e.g., `llm_service.py`, `scraper_core.py`).
- `apps/core/`: Infraestructura base (`database.py`, `config.py`, `logger.py`).
- `apps/models/`: Definiciones de datos y esquemas.
- `apps/utils/`: Funciones auxiliares genéricas.

### 🔌 Eliminación de "Side Effects" en Importación
**Diagnóstico:** Archivos como `apps/database.py` inicializan conexiones y `apps/__init__.py` inicia hilos de monitoreo al momento de ser importados, dificultando los tests aislados.
**Acción:**
- Mover lógica de inicialización a una función `create_app()` o `init_resources()`.
- Usar el patrón "Application Factory" de Flask de forma estricta.

### 🗄️ Centralización de Datos
**Diagnóstico:** Archivos SQLite (`projects.db`) y reportes se generan dispersos en la raíz o carpetas relativas.
**Acción:** Definir un directorio `data/` centralizado para persistencia, gestionado via configuración.

## 2. Frontend y Experiencia de Usuario (UX)

### 🎨 Unificación de Frameworks CSS
**Diagnóstico:** Uso híbrido de Bootstrap 5 (CSS) y Tailwind CSS (CDN Script), causando carga doble, conflictos de estilo y dependencia online.
**Acción:**
- Estandarizar el uso de **Tailwind CSS** como framework principal.
- Eliminar progresivamente Bootstrap.
- Reemplazar el script CDN de Tailwind por un proceso de compilación (build step) que genere un archivo CSS optimizado.

### 📦 Modo "Offline" y Assets Locales
**Diagnóstico:** Dependencia crítica de CDNs para fuentes, iconos y estilos. La aplicación no funciona sin internet.
**Acción:** Descargar y servir todos los assets (fuentes, JS, CSS) desde la carpeta `static/` local.

## 3. Seguridad y Configuración

### 🔑 Gestión Segura de Configuración (.env)
**Diagnóstico:** `config.py` usa `os.environ` pero no carga variables desde un archivo, requiriendo configuración manual del entorno.
**Acción:** Integrar `python-dotenv` para cargar automáticamente variables desde un archivo `.env` local.

### 🛡️ Validación de Entradas y Protección SSRF
**Diagnóstico:** Validación dispersa y manual. Riesgos de SSRF en herramientas que procesan URLs externas.
**Acción:**
- Implementar validación de esquemas con **Pydantic** para todos los endpoints JSON.
- Aplicar la función `is_safe_url` (ya existente) de forma obligatoria en *todas* las peticiones salientes.
- Usar `werkzeug.utils.secure_filename` estrictamente para cualquier manejo de archivos.

## 4. DevOps y Mantenimiento

### 📌 Pinning de Dependencias
**Diagnóstico:** `requirements.txt` sin versiones fijas, riesgo alto de roturas por actualizaciones de librerías.
**Acción:** Generar un `requirements.txt` (o `requirements.lock`) con versiones exactas y hashes usando `pip-tools`.

### 📝 Documentación Viva (Swagger)
**Diagnóstico:** Falta de documentación de API.
**Acción:** Integrar **Flasgger** o similar para generar documentación OpenAPI/Swagger automática desde los docstrings.

## 5. Testing y Calidad (QA)

### 🧪 Estrategia de Testing "Offline"
**Diagnóstico:** Tests existentes requieren conexión a internet y claves API reales.
**Acción:**
- Mockear agresivamente todas las llamadas de red (`requests`, `playwright`) y APIs de terceros.
- Usar base de datos en memoria para tests de integración.

### 📏 Estándares y Tipado
**Diagnóstico:** Código inconsistente y falta de tipos.
**Acción:**
- Aplicar **Black** y **Isort** para formateo.
- Añadir **Type Hints** graduales y verificar con **MyPy**.

## 6. Rendimiento

### ⚡ Scraping Asíncrono
**Diagnóstico:** Cuellos de botella por uso de hilos y bloqueos en scraping síncrono.
**Acción:** Migrar scraping intensivo a **Playwright Async API** y gestionar trabajos largos con colas (Redis/RQ o similar).
