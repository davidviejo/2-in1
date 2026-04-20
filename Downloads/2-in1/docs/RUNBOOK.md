# Runbook: Configuración de Entornos (Local y Producción)

Este proyecto está configurado para funcionar en dos modos:
1. **Modo Local:** Ejecución completa en tu máquina (backend + frontend).
2. **Modo Producción:** Backend en Render y Frontend en Vercel (o Render Static).

## 1. Variables de Entorno

El proyecto utiliza archivos `.env` para la configuración.

### Backend (`backend/p2/.env`)

Copia `backend/p2/.env.example` a `backend/p2/.env` y ajusta según necesites:

| Variable | Descripción | Valor Local (Ejemplo) | Valor Producción |
|----------|-------------|-----------------------|------------------|
| `PORT` | Puerto del servidor Flask | `5000` | Asignado por Render |
| `FLASK_DEBUG` | Modo debug | `true` | `false` |
| `DATABASE_URL` | URL de conexión a BD | (Vacío = SQLite local) | `postgres://user:pass@host/db` |
| `JWT_SECRET` | Secreto para tokens JWT | `secreto_local` | Generar uno seguro |
| `SETTINGS_ENCRYPTION_KEY` | Clave para cifrar secretos de configuración en BD | `dev_settings_key` (o una clave Fernet) | **Obligatoria**, gestionar vía secreto del proveedor |
| `CLIENTS_AREA_PASSWORD` | Pass zona clientes | `demo_client` | Hash bcrypt (o texto plano, se autohashea) |
| `OPERATOR_PASSWORD` | Pass zona operador | `demo_operator` | Hash bcrypt (o texto plano, se autohashea) |
| `FRONTEND_URL` | URL del frontend (CORS) | `http://localhost:5173` | `https://tu-dominio.com` |

### Frontend (`frontend/m3/.env`)

Copia `frontend/m3/.env.example` a `frontend/m3/.env`:

| Variable | Descripción | Valor Local | Valor Producción |
|----------|-------------|-------------|------------------|
| `VITE_API_URL` | URL del Backend | `http://localhost:5000` | `https://tu-backend-app.onrender.com` |

---

## 2. Modo Local

Puedes arrancar todo el entorno con un solo comando usando los scripts facilitados.

### Requisitos Previos
- Python 3.8+
- Node.js 18+
- Git

### Arranque Automático (Recomendado)

**En Linux/Mac:**
```bash
./scripts/dev.sh
```

**En Windows (PowerShell):**
```powershell
./scripts/dev.ps1
```

Estos scripts se encargarán de:
1. Crear el entorno virtual Python (`backend/p2/venv`) si no existe.
2. Instalar dependencias de Python.
3. Descargar el modelo de Spacy necesario.
4. Instalar dependencias de Node.js (`frontend/m3/node_modules`) si faltan.
5. Ejecutar Backend (puerto 5000) y Frontend (puerto 5173) simultáneamente.

### Arranque Manual

Si prefieres hacerlo paso a paso:

**Backend:**
```bash
cd backend/p2
python -m venv venv
source venv/bin/activate  # o venv\Scripts\activate en Windows
pip install -r requirements.txt
python -m spacy download es_core_news_sm
# Asegúrate de tener el .env creado o variables exportadas
# Si falta SETTINGS_ENCRYPTION_KEY, genera una Fernet válida:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
python run.py
```

**Frontend:**
```bash
cd frontend/m3
npm install
# Crea .env con VITE_API_URL=http://localhost:5000
npm run dev
```

---

## 3. Modo Producción

### Despliegue del Backend (Render)

El proyecto incluye un `render.yaml` configurado en la raíz.
1. Conecta tu repositorio a Render.
2. Render detectará el `render.yaml` y creará el servicio `mediaflow-backend`.
3. **Variables de Entorno en Render:**
   - Asegúrate de configurar `CLIENTS_AREA_PASSWORD`, `OPERATOR_PASSWORD` y `JWT_SECRET` en el dashboard de Render.
   - Si usas PostgreSQL, añade la base de datos y Render inyectará `DATABASE_URL` automáticamente.

**Configuración clave en Render:**
- **Root Directory:** `backend/p2`
- **Build Command:** `pip install -r requirements.txt && python -m spacy download es_core_news_sm`
- **Start Command:** `gunicorn run:app --bind 0.0.0.0:$PORT`

### Despliegue del Frontend (Vercel)

1. Importa el proyecto en Vercel.
2. **Root Directory:** Selecciona `frontend/m3` (o `edit` la configuración del proyecto para que la raíz sea esa carpeta).
3. **Build Command:** `npm run build` (por defecto de Vite).
4. **Output Directory:** `dist` (por defecto de Vite).
5. **Variables de Entorno:**
   - `VITE_API_URL`: La URL de tu backend desplegado en Render (ej. `https://mediaflow-backend.onrender.com`).

---

## 4. Notas Adicionales

- **Seguridad:** El backend convierte automáticamente las contraseñas en texto plano a hashes bcrypt al iniciar. Sin embargo, para producción se recomienda generar el hash localmente y poner ese hash en la variable de entorno.
- **Base de Datos:** En local se usa SQLite (`backend/p2/projects.db`). En producción, si defines `DATABASE_URL`, el sistema usará PostgreSQL automáticamente.
- **CORS:** El backend aceptará peticiones de `localhost:5173` siempre, y adicionalmente del origen definido en `FRONTEND_URL`.

---

## 5. Estado canónico del Checklist (SPA vs legacy)

- **Checklist canónico (activo):** SPA en `/#/app/checklist`.
- **Checklist legacy (Flask templates):** `backend/p2/apps/web/blueprints/checklist_tool.py` + `backend/p2/templates/checklist/dashboard.html`.
- **Estado legacy:** congelado, sólo se mantiene endpoint puente para redirección.
- **Retiro planificado de legacy:** **30 de junio de 2026**.

### Endpoints backend permitidos para el motor de checklist

Para evitar duplicación funcional, el backend debe concentrarse en:
- `POST /api/analyze`
- `POST /api/jobs`
- `GET /api/jobs/<job_id>`
- `GET /api/jobs/<job_id>/items`
- `GET /api/jobs/<job_id>/items/<item_id>/result`
- `POST /api/jobs/<job_id>/pause`
- `POST /api/jobs/<job_id>/resume`
- `POST /api/jobs/<job_id>/cancel`

No se deben reintroducir endpoints legacy de ejecución/descarga paralelos para checklist.

Contrato técnico batch jobs (estado/campos canónicos):
- `docs/ENGINE_BATCH_API_CONTRACT.md`



## 6. Apps integradas en carpeta raíz (Tools Hub)

El panel **Tools Hub** ahora detecta apps adicionales desde:

- `apps-independientes/<nombre-app>/app.manifest.json`

Ejemplo de manifest mínimo:

```json
{
  "id": "integrada-mi-app",
  "name": "Mi App",
  "description": "Descripción corta",
  "section": "apps-integradas",
  "path": "http://localhost:3000",
  "status": "beta",
  "runtime": {
    "enabled": true,
    "requires_credentials": false,
    "degraded": false
  }
}
```

Si una carpeta no tiene manifest válido, Tools Hub la mostrará como detectada pero deshabilitada hasta completar configuración.

---

---

## 7. Tools Hub Launcher Runtime

La sección **Tools Hub Launcher Runtime** define cómo el panel orquesta apps locales (instalación, arranque, parada y lectura de logs) usando metadata en `app.manifest.json`.

### 7.1 Estructura de `app.manifest.json` (ejemplo completo)

Cada app integrada debe incluir un archivo `app.manifest.json` en su carpeta raíz.

```json
{
  "id": "integrada-seo-auditor",
  "name": "SEO Auditor",
  "description": "Suite interna para auditorías SEO técnicas y de contenido.",
  "section": "apps-integradas",
  "path": "http://localhost:4173",
  "status": "stable",
  "icon": "search",
  "tags": ["seo", "crawler", "reporting"],
  "owner": "growth-team",
  "version": "1.4.0",
  "runtime": {
    "enabled": true,
    "requires_credentials": false,
    "degraded": false,
    "install": {
      "cwd": "apps-independientes/seo-auditor",
      "command": "npm install"
    },
    "start": {
      "cwd": "apps-independientes/seo-auditor",
      "command": "npm run dev",
      "port": 4173,
      "healthcheck": "http://localhost:4173"
    },
    "stop": {
      "strategy": "pidfile",
      "pidfile": "apps-independientes/seo-auditor/.toolshub.pid"
    },
    "logs": {
      "stdout": "apps-independientes/seo-auditor/.toolshub/logs/out.log",
      "stderr": "apps-independientes/seo-auditor/.toolshub/logs/error.log"
    }
  }
}
```

Campos recomendados:
- `id`: identificador único y estable.
- `name` / `description`: metadatos visibles en el hub.
- `path`: URL esperada cuando la app está levantada.
- `runtime.enabled`: habilita operaciones del launcher.
- `runtime.install/start/stop/logs`: comandos y rutas operativas para Tools Hub.

### 7.2 Cómo registrar una nueva app

1. Crear carpeta de app: `apps-independientes/<nombre-app>/`.
2. Añadir `app.manifest.json` con `id` único, `section`, `path` y bloque `runtime` completo.
3. Verificar que los comandos en `runtime.install.command` y `runtime.start.command` funcionan manualmente desde su `cwd`.
4. Confirmar que el puerto definido en `runtime.start.port` está libre.
5. Reiniciar o recargar Tools Hub para forzar nueva detección.
6. Validar en UI que la app aparece en estado `enabled` y permite acciones de runtime.

### 7.3 Uso desde Tools Hub (instalar / iniciar / parar / logs)

Flujo sugerido dentro de Tools Hub:

1. **Instalar**
   - Acción: `Instalar`.
   - Ejecuta: `runtime.install.command` en `runtime.install.cwd`.
   - Úsalo para dependencias (`npm install`, `pip install -r requirements.txt`, etc.).

2. **Iniciar**
   - Acción: `Iniciar`.
   - Ejecuta: `runtime.start.command` en `runtime.start.cwd`.
   - Verifica disponibilidad por `runtime.start.port` o `runtime.start.healthcheck`.

3. **Parar**
   - Acción: `Parar`.
   - Usa `runtime.stop.strategy` para finalizar proceso (por ejemplo, PID file).
   - Debe dejar el puerto liberado y reflejar estado detenido en la UI.

4. **Logs**
   - Acción: `Logs`.
   - Lee rutas `runtime.logs.stdout` y `runtime.logs.stderr`.
   - Revisar `stderr` primero cuando el estado sea `error` o `degraded`.

### 7.4 Troubleshooting

#### A) Puerto ocupado
Síntomas:
- La app no inicia o entra en estado `error` inmediatamente.
- Mensajes tipo `EADDRINUSE`, `Address already in use`.

Pasos:
1. Identificar proceso en el puerto configurado (`runtime.start.port`).
2. Detener ese proceso o cambiar puerto en `app.manifest.json` y en la app.
3. Reiniciar desde Tools Hub y validar healthcheck.

Comandos útiles:
```bash
# Linux/macOS
lsof -i :4173
kill -9 <PID>
```

```powershell
# Windows PowerShell
Get-NetTCPConnection -LocalPort 4173
Stop-Process -Id <PID> -Force
```

#### B) Dependencias faltantes
Síntomas:
- Fallo en `Instalar` o `Iniciar` con mensajes `command not found`, módulos faltantes, binarios ausentes.

Pasos:
1. Ejecutar `Instalar` desde Tools Hub.
2. Si persiste, ejecutar comando manual en `runtime.install.cwd` para obtener error completo.
3. Corregir lockfile/requirements y repetir instalación.
4. Verificar versiones mínimas (Node/Python) requeridas por la app.

#### C) App en estado `error`
Síntomas:
- Estado final `error` en tarjeta de app.
- Healthcheck fallido o proceso que termina al poco tiempo.

Pasos:
1. Abrir `Logs` en Tools Hub y revisar primero `stderr`.
2. Confirmar variables de entorno requeridas por la app.
3. Verificar que `runtime.start.command` arranca correctamente fuera del hub.
4. Corregir `app.manifest.json` (`cwd`, `command`, `port`, `healthcheck`, `pidfile`) y reintentar.

### 7.5 Comandos de verificación final

Ejecutar desde `Downloads/2-in1`:

```bash
# Frontend
cd frontend/m3
npm run build
npm run test
npm run lint
npx tsc --noEmit

# Backend
cd ../../backend/p2
pytest
```

Si usas CI/CD, estos comandos deben quedar como checks mínimos para cambios en runtime o integración de apps del Tools Hub.

