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
