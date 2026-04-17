import os
from pathlib import Path

from flask_cors import CORS


def _load_local_env_file():
    """Load backend/p2/.env values into process env when running `python run.py`."""
    env_path = Path(__file__).resolve().parent / '.env'
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_local_env_file()

from apps.web import create_app

app = create_app()

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
]

# Permitir origen configurado en variable de entorno (para producción)
frontend_url = os.environ.get("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

# Configurar CORS para permitir credenciales y los orígenes definidos
CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host="0.0.0.0", debug=debug, use_reloader=False, port=port)
