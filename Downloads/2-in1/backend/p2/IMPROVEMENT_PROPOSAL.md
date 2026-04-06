# Propuesta Consolidada de Mejoras - SEO Suite Ultimate

Este documento unifica y expande las propuestas anteriores (`IMPROVEMENT_PLAN.md`, `IMPROVEMENT_IDEAS.md`) junto con nuevos hallazgos técnicos. Se presentan en orden de prioridad e impacto.

## 1. Arquitectura y Mantenibilidad (Prioridad Alta)

El estado actual del proyecto presenta una estructura plana y componentes "God Object" que dificultan el mantenimiento.

### 🏗️ Reorganización Modular
Actualmente `apps/` contiene más de 50 archivos planos.
**Propuesta:** Reestructurar en sub-paquetes lógicos.
```text
apps/
├── core/               # Lógica esencial (database.py, config, exceptions)
├── scraping/           # Lógica de scraping (scraper_core.py refactorizado)
├── tools/              # Herramientas de SEO (content, technical, backlinks)
│   ├── content/        # nlp_tool.py, content_gap.py
│   ├── technical/      # audit_tool.py, wpo_tool.py
│   └── analysis/       # trends_economy.py
├── services/           # Servicios de fondo (monitor_daemon.py)
└── web/                # Blueprints y rutas de la API/UI
```

### 🧩 Desacoplamiento de `scraper_core.py`
El módulo actual mezcla lógica de navegador (Playwright), peticiones HTTP (Requests) y parseo específico de Google.
**Propuesta:** Implementar patrón Strategy.
- `BrowserManager`: Singleton para gestionar instancias de Playwright.
- `FetcherInterface`: Interfaz común para `RequestsFetcher` y `PlaywrightFetcher`.
- `ParserStrategy`: Clases separadas para parsear Google, Bing, o HTML genérico.

### 🗄️ Centralización de Datos
Actualmente las bases de datos están dispersas:
- `projects.db` (Root)
- `trends_jobs.db` (Root)
- `apps/api_usage.db` (Inside `apps/`)
**Propuesta:**
- Mover todos los archivos SQLite y JSON de datos a una carpeta `data/`.
- Definir `DATA_DIR` en `config.py` para gestionar estas rutas de forma centralizada.

## 2. Calidad y Fiabilidad del Código (Prioridad Alta)

### 📏 Estándares y Linting
El código carece de consistencia de estilo y tipado.
**Propuesta:**
- **Black & Isort**: Formateo automático y orden de imports.
- **Flake8**: Detección de errores de estilo y complejidad.
- **Type Hints**: Añadir anotaciones de tipo (Python 3.10+) y validar con **Mypy**.
- **Acción Inmediata**: Añadir estas herramientas a `requirements.txt` o crear `requirements-dev.txt`.

### 🧪 Testing Robusto
Cobertura mínima actual.
**Propuesta:**
- **Unit Tests**: Tests aislados para utilidades y lógica de negocio pura.
- **Integration Tests**: Tests con base de datos SQLite en memoria.
- **Mocking**: Simular respuestas de Google y APIs externas para evitar bloqueos durante tests.

### 📝 Logging Estructurado
Uso inconsistente de `print` y `logging`.
**Propuesta:**
- Centralizar configuración de logging.
- Usar formato JSON para logs en producción (fácil de ingerir por herramientas de monitoreo).
- Eliminar `print` statements en código de producción.

## 3. Rendimiento y Escalabilidad (Prioridad Media)

### ⚡ Cola de Tareas (Task Queue)
El uso de `concurrent.futures` en memoria es frágil ante reinicios.
**Propuesta:**
- Implementar una cola persistente (ej. **Celery** + Redis, o **RQ**).
- Separar claramente los procesos "Web" de los "Workers".

### 📡 Comunicación Real-Time
Polling constante sobrecarga el servidor.
**Propuesta:**
- Implementar **Server-Sent Events (SSE)** para notificar progreso de tareas al frontend de forma eficiente.

## 4. DevOps y Despliegue (Prioridad Media)

### 📦 Gestión de Dependencias
`requirements.txt` es básico y sin versiones fijas.
**Propuesta:**
- Migrar a **Poetry** para gestión determinista de dependencias y entornos virtuales.

### 🐳 Containerización
Dependencia fuerte del entorno local.
**Propuesta:**
- Crear `Dockerfile` multi-stage optimizado.
- `docker-compose.yml` para orquestar App, Worker y (opcionalmente) Redis/DB.

## 5. Frontend y UX (Prioridad Baja)

### 🎨 Unificación de UI
Mezcla de Bootstrap 5 y Tailwind.
**Propuesta:**
- Estandarizar nuevos desarrollos en **Tailwind CSS**.
- Crear librería de componentes UI reutilizables (Macros Jinja2).

### 📊 Dashboard Unificado
**Propuesta:**
- Vista de "Centro de Comando" que agregue métricas de todos los proyectos (Alertas, KPIs globales).

## 6. Seguridad (Nuevo)

### 🛡️ Hardening
**Propuesta:**
- Auditoría de cabeceras de seguridad (HSTS, CSP, X-Frame-Options).
- Sanitización estricta de entradas en herramientas de scraping para evitar inyecciones.
- **Gestión de Secretos**: Evitar fallbacks hardcodeados para `SECRET_KEY` en `config.py`. Forzar error si no existe variable de entorno en producción.

---
**Siguientes Pasos Recomendados (Plan de Acción):**
1. **Inmediato**: Unificar ubicación de bases de datos en `data/` y actualizar referencias.
2. **Corto Plazo**: Instalar `black`, `flake8`, `mypy` y configurar pre-commit hooks.
3. **Medio Plazo**: Refactorizar `apps/` moviendo archivos a carpetas (sin cambiar lógica interna aún).
4. **Largo Plazo**: Configurar Poetry y Docker.
