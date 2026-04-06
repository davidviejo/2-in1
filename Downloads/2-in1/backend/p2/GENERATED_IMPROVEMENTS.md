# Propuesta de Mejoras Consolidada

Basado en el análisis de `IMPROVEMENT_FINAL_PLAN.md` y la revisión técnica del código actual (`v17`), se presentan las siguientes áreas de mejora priorizadas.

## 1. Reestructuración Arquitectónica (Prioridad Alta)

El directorio `apps/` contiene actualmente más de 60 archivos en un solo nivel, y `apps/__init__.py` registra docenas de Blueprints manualmente.

### 🏗️ Modularización
Reorganizar `apps/` en sub-paquetes temáticos para reducir la complejidad cognitiva y mejorar la mantenibilidad.

**Propuesta de Estructura:**
```text
apps/
├── core/               # Lógica esencial (Database, Config, Scraper Base)
│   ├── database.py
│   ├── scraper_core.py
│   └── ...
├── tools/              # Herramientas SEO (Blueprints y Lógica)
│   ├── audit/          # audit_tool.py, image_audit.py
│   ├── content/        # nlp_tool.py, content_gap.py
│   ├── serps/          # serp_scanner.py, scraper_core.py (wrappers)
│   └── ...
├── services/           # Servicios en segundo plano
│   └── monitor.py      # (Antiguo monitor_daemon.py)
└── utils/              # Utilidades puras
```

### 🗄️ Centralización de Datos
Mover los archivos de base de datos dispersos a un directorio `data/` en la raíz para facilitar backups y gestión.
- `projects.db` -> `data/projects.db`
- `trends_jobs.db` -> `data/trends_jobs.db`
- `api_usage.db` -> `data/api_usage.db`

## 2. Estabilidad y Concurrencia (Crítico)

Se han identificado patrones de código que no son seguros en entornos multi-hilo (threading).

### 🐛 `scraper_core.py`: Global Browser State
El uso de variables globales `_BROWSER`, `_PLAYWRIGHT` no es seguro ("thread-safe"). Si dos hilos intentan iniciar el navegador simultáneamente, pueden ocurrir condiciones de carrera o fugas de procesos.

**Solución:**
- Encapsular la lógica en una clase `BrowserManager` (Singleton o Pool).
- Usar un `Lock` global para la inicialización del navegador.

### 👻 `monitor_daemon.py`: Ciclo de Vida
La función `start_monitor()` se llama incondicionalmente al importar/crear la app en `apps/__init__.py`. Esto provoca que los tests inicien hilos de monitoreo innecesarios, ensuciando los logs y potencialmente causando fallos.

**Solución:**
- Iniciar el monitor solo si `os.environ.get('WERKZEUG_RUN_MAIN') == 'true'` (reload) o mediante un flag explícito de configuración (`Config.ENABLE_MONITOR`).

## 3. Calidad de Código y DevOps

### 📦 Gestión de Dependencias
`requirements.txt` no tiene versiones fijadas (e.g., `flask`, `pandas`), lo que hace que el proyecto sea frágil ante actualizaciones externas.

**Solución:**
- Fijar versiones exactas (e.g., `flask==3.0.0`).
- Evaluar migración a **Poetry** para gestión determinista.

### 🧹 Logging vs Print
El código mezcla `print()` y `logging`. Los `print()` no quedan registrados en archivos de log en producción.

**Solución:**
- Estandarizar el uso del módulo `logging` en todo el proyecto.

## 4. Testing

### 🧪 Cobertura de Tests
Faltan tests unitarios para componentes críticos como `scraper_core.py` (lógica de reintentos) y `monitor_daemon.py`.

**Solución:**
- Crear tests unitarios que usen `unittest.mock` para simular respuestas de red, evitando llamadas reales a Google/Internet durante los tests.
