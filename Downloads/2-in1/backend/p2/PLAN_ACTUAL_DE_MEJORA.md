# Plan de Mejora Integral - SEO Suite Ultimate

Este documento define la hoja de ruta técnica para transformar el proyecto actual en una aplicación robusta, modular y escalable.

## 1. Fase de Estabilización (Inmediato)

El objetivo es detener la deuda técnica y asegurar que el código actual sea predecible y seguro antes de mover archivos.

### 🛑 Eliminar Efectos Secundarios en Importaciones
**Problema Detectado:** `apps/database.py` ejecuta `init_db()` al final del archivo. `apps/__init__.py` ejecuta `start_monitor()`.
**Impacto:** Es imposible importar estos módulos en tests sin crear bases de datos o hilos fantasma.
**Acción:**
- Eliminar llamadas globales.
- Mover inicialización a `create_app()` en `apps/__init__.py` o a un comando CLI (e.g., `flask init-db`).

### 🔒 Gestión de Dependencias
**Problema Detectado:** `requirements.txt` no tiene versiones fijas.
**Acción:**
- Generar un `requirements.in` con las dependencias principales.
- Usar `pip-compile` (pip-tools) para generar un `requirements.txt` con versiones exactas y hashes.

### 🛡️ Seguridad y Validación
**Problema Detectado:** Aunque existe `apps.utils.is_safe_url`, debe auditarse su uso en *todos* los puntos de entrada (scraper, analizadores).
**Acción:**
- Crear un decorador o función wrapper `safe_fetch(url)` que integre `is_safe_url` + `requests.get` para evitar errores humanos.

---

## 2. Fase de Modularización (Corto Plazo)

Reestructuración del directorio `apps/` (actualmente 60+ archivos planos) para seguir una arquitectura por capas.

### 📂 Nueva Estructura de Directorios

```text
apps/
├── core/               # Lógica de infraestructura
│   ├── database.py     # Gestión de BD (sin side-effects)
│   ├── config.py       # Configuración centralizada
│   ├── logging.py      # Configuración de logs estructurados
│   └── exceptions.py   # Excepciones personalizadas
├── scrapers/           # Lógica de obtención de datos
│   ├── browser.py      # BrowserManager (Playwright Singleton)
│   └── parsers.py      # Lógica de BeautifulSoup (Google, HTML general)
├── services/           # Lógica de negocio pura (sin HTTP)
│   ├── audit.py
│   ├── nlp.py
│   └── seo_analysis.py
├── web/                # Capa HTTP (Blueprints)
│   ├── blueprints/     # Antiguos *_tool.py (solo rutas)
│   └── utils.py        # Helpers para respuestas JSON
└── utils/              # Utilidades genéricas (strings, urls)
```

**Acción:** Mover archivos incrementalmente, actualizando imports.

---

## 3. Fase de Rendimiento y Escalamiento (Medio Plazo)

### ⚡ Async Scraping
**Problema Actual:** `apps/scraper_core.py` usa `threading.Lock` para Playwright, bloqueando hilos en una app síncrona.
**Acción:**
- Migrar el scraping a **Playwright Async API**.
- Dado que Flask es síncrono, delegar el scraping a workers en background (Celery o RQ) o usar un microservicio separado basado en FastAPI/Quart.

### 🚀 Optimización Frontend
**Acción:**
- Implementar **Server-Sent Events (SSE)** para las barras de progreso en lugar de polling o bloqueos.
- Unificar estilos CSS (actualmente dispersos) usando un framework utility-first (Tailwind) o unificando clases.

---

## 4. DevOps y Calidad

### 🧪 Estrategia de Testing
**Acción:**
- **Unit Tests:** Mockear `requests` y `playwright` en todos los tests. No permitir llamadas a red en CI/CD.
- **Integration Tests:** Testear rutas de Flask usando una BD SQLite en memoria (`:memory:`).

### 🐳 Dockerización
**Acción:**
- Crear `Dockerfile` multi-stage optimizado.
- Asegurar que las dependencias de sistema de Playwright se instalen correctamente en la imagen.
