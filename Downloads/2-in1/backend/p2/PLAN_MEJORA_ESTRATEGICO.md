# Plan de Mejora Estratégico - MediaFlow SEO Suite (2025)

Este documento consolida las iniciativas clave para transformar la aplicación actual en un sistema robusto, seguro y escalable. Las propuestas se basan en un análisis profundo del código existente y planes previos.

## 1. Victorias Rápidas (Quick Wins)
*Mejoras de alto impacto y bajo esfuerzo para estabilizar el sistema inmediatamente.*

### 🛑 Eliminar "Side Effects" en Importaciones
**Problema:** El módulo `apps/database.py` ejecuta `init_db()` automáticamente al ser importado. Esto impide importar el módulo en tests sin crear una base de datos real.
**Solución:**
- Eliminar la llamada `init_db()` del final de `apps/database.py`.
- Invocar `init_db()` explícitamente en `create_app()` dentro de `apps/__init__.py`.

### 🔒 Gestión de Secretos (.env)
**Problema:** La configuración (`config.py`) depende de variables de entorno del sistema (`os.environ`) pero no carga un archivo local, dificultando el desarrollo.
**Solución:**
- Instalar `python-dotenv`.
- Configurar `config.py` para cargar automáticamente variables desde un archivo `.env`.

### 📌 Fijar Dependencias (Pinning)
**Problema:** `requirements.txt` lista librerías sin versiones específicas (e.g., `flask`, `pandas`), lo que garantiza roturas futuras cuando se publiquen nuevas versiones incompatibles.
**Solución:**
- Crear un `requirements.in` con las dependencias directas.
- Usar `pip-compile` (de `pip-tools`) para generar un `requirements.txt` con versiones exactas y hashes SHA.

---

## 2. Salud Estructural (Arquitectura)
*Refactorización necesaria para hacer el código mantenible y testearlo.*

### 🏗️ Reorganización del Directorio `apps/`
**Problema:** El directorio `apps/` es plano y contiene más de 60 archivos mezclando controladores web (Blueprints), lógica de negocio, y utilidades de infraestructura.
**Solución:** Implementar una arquitectura por capas:
- `apps/web/`: Solo rutas y Blueprints (e.g., `seo_bp.py`, `dashboard_bp.py`).
- `apps/services/`: Lógica de negocio pura (e.g., `audit_service.py`, `scraper_service.py`).
- `apps/core/`: Infraestructura (Base de datos, Config, Logging).
- `apps/models/`: Definiciones de datos (Data Classes, Pydantic Models).

### 🔍 Inyección de Dependencias
**Problema:** Los servicios instancian sus dependencias directamente (e.g., conexiones a BD, clientes HTTP), haciendo imposible el testing unitario aislado.
**Solución:** Pasar dependencias explícitamente a las funciones o clases, permitiendo inyectar Mocks durante los tests.

---

## 3. Experiencia de Usuario (Frontend)
*Modernización de la interfaz y eliminación de deuda técnica visual.*

### 🎨 Unificación CSS (Tailwind vs Bootstrap)
**Problema:** `templates/base.html` carga tanto Bootstrap 5 (CSS) como Tailwind (CDN Script). Esto duplica el peso de la página y crea conflictos de estilos.
**Solución:**
- Estandarizar **Tailwind CSS** como único framework.
- Eliminar referencias a Bootstrap gradualmente.
- Reemplazar clases de Bootstrap (`btn-primary`, `container`) por utilidades de Tailwind.

### 📦 Modo Offline (Sin CDNs)
**Problema:** La aplicación depende de internet para cargar fuentes, iconos y estilos. Si la conexión falla, la UI se rompe.
**Solución:**
- Implementar un paso de construcción (build step) para generar el CSS final.
- Descargar fuentes y scripts JS a la carpeta `static/`.
- Servir todos los assets localmente.

---

## 4. Calidad y DevOps
*Procesos para asegurar que el código funcione y sea seguro.*

### 🛡️ Validación de Tipos y Datos
**Problema:** Validación dispersa y manual de entradas JSON.
**Solución:**
- Usar **Pydantic** para validar los cuerpos de las peticiones (Request Bodies).
- Añadir Type Hints (tipado estático) a las funciones críticas y verificar con `mypy`.

### 🧪 Estrategia de Testing Aislado
**Problema:** Los tests actuales requieren conexión a internet y tocan la base de datos real.
**Solución:**
- Usar `sqlite3.connect(':memory:')` para tests de integración rápidos.
- Mockear todas las llamadas externas (`requests`, `playwright`) usando `pytest-mock`.

### ⚡ Scraping Asíncrono
**Problema:** El scraping bloquea los hilos del servidor web.
**Solución:** Migrar tareas pesadas a **Playwright Async** y ejecutarlas en procesos de fondo (Background Workers) separados del servidor Flask principal.
