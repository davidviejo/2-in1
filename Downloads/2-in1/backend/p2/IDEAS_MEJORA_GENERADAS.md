# Nuevas Ideas de Mejora Generadas (2025)

Tras un análisis exhaustivo del código base actual, se han identificado las siguientes áreas críticas de mejora, complementando los planes anteriores.

## 1. Arquitectura y Estructura del Proyecto

### 🏗️ Reorganización del Directorio `apps/`
**Estado Actual:** El directorio `apps/` contiene más de 60 archivos mezclando Blueprints, lógica de negocio y utilidades.
**Propuesta:** Implementar una estructura jerárquica:
- `apps/web/`: Blueprints y rutas HTTP (antiguos `*_tool.py`).
- `apps/services/`: Lógica de negocio reutilizable (e.g., `llm_service.py`, `scraper_core.py`).
- `apps/core/`: Infraestructura base (`database.py`, `config.py`, `logging.py`).
- `apps/models/`: Modelos de datos y esquemas.

### 🔌 Eliminación de "Side Effects" en Importación
**Estado Actual:** `apps/database.py` ejecuta `init_db()` y `apps/__init__.py` ejecuta `start_monitor()` al momento de importarse.
**Propuesta:**
- Mover inicializaciones a funciones explícitas llamadas desde `run.py` o comandos CLI.
- Esto permitirá importar módulos individualmente para testing sin detonar conexiones a BD o hilos en segundo plano.

### 🔍 Auto-descubrimiento de Blueprints
**Estado Actual:** `apps/__init__.py` importa y registra manualmente docenas de blueprints.
**Propuesta:** Crear un cargador dinámico que registre automáticamente los blueprints dentro de `apps/web/`, reduciendo el ruido en el archivo de fábrica.

## 2. Frontend y Experiencia de Usuario

### 🎨 Unificación de Frameworks CSS
**Estado Actual:** Uso mixto de **Bootstrap 5** (CSS) y **Tailwind CSS** (vía CDN script), lo que genera inconsistencias y carga doble.
**Propuesta:**
- Estandarizar en **Tailwind CSS** para todo el proyecto.
- Eliminar Bootstrap progresivamente.

### 📦 Independencia de CDNs (Modo Offline)
**Estado Actual:** Dependencia crítica de CDNs externos para Tailwind, Fuentes y Bootstrap.
**Propuesta:**
- Implementar un proceso de compilación de assets (npm/bun).
- Servir archivos CSS/JS desde `static/` localmente.
- Esto mejorará la velocidad y permitirá el uso en entornos sin internet.

## 3. Configuración y Seguridad

### 🔑 Gestión de Secretos
**Estado Actual:** `config.py` depende de variables de entorno pero no carga archivos `.env`.
**Propuesta:** Integrar `python-dotenv` para cargar configuración desde un archivo `.env` local, facilitando el desarrollo y despliegue.

### 🛡️ Validación Centralizada
**Estado Actual:** Validación dispersa en cada ruta.
**Propuesta:** Implementar esquemas de validación (usando `pydantic` o `marshmallow`) para las entradas JSON de las APIs, asegurando tipos correctos antes de llegar a la lógica de negocio.

## 4. DevOps y Mantenimiento

### 📌 Pinning de Dependencias
**Estado Actual:** `requirements.txt` no tiene versiones fijas.
**Propuesta:** Migrar a `pip-tools` para generar un `requirements.txt` con hashes y versiones exactas, garantizando reproducibilidad.

### 📝 Documentación de API
**Estado Actual:** Falta de documentación formal de los endpoints.
**Propuesta:** Integrar **Swagger/OpenAPI** (vía `flasgger` o similar) para generar documentación interactiva automática de los endpoints de la API.

## 5. Testing

### 🧪 Tests Unitarios Puros
**Estado Actual:** Dificultad para testear componentes aislados debido al acoplamiento.
**Propuesta:** Refactorizar servicios clave (`scraper_core`, `llm_service`) para inyección de dependencias, facilitando el uso de mocks en los tests.
