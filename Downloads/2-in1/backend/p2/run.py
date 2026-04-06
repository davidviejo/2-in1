import os
from apps.web import create_app
from flask_cors import CORS

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
