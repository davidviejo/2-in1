Aquí tienes el Informe Técnico de Arquitectura y Mantenimiento para la SEO Suite v17.

Este documento está diseñado para ser entregado a cualquier desarrollador Backend/Fullstack (Python) que necesite tomar el relevo, mantener o escalar la aplicación.

📘 Informe Técnico: SEO Suite Ultimate v17

Fecha: 24 de Noviembre de 2025
Tecnología: Python / Flask
Arquitectura: Modular (Blueprints)

1. Resumen Ejecutivo

La aplicación es una Suite de Herramientas SEO de Escritorio basada en web local. Funciona como un "SaaS local". Su objetivo es automatizar tareas de consultoría (auditoría, estrategia, contenidos) utilizando scraping híbrido y APIs de terceros.

El sistema no es monolítico; está diseñado bajo una arquitectura modular donde cada herramienta es independiente pero comparte un núcleo común de scraping y diseño.

2. Stack Tecnológico
Backend

Framework: Flask (Python).

Procesamiento de Datos: Pandas, OpenPyXL (para Excel).

Scraping (Núcleo):

requests + BeautifulSoup4 (Nivel 1: Rápido/Estático).

playwright (Nivel 2: Renderizado JS/Navegador Real).

duckduckgo-search (Motor de búsqueda gratuito).

NLP / IA:

spacy (Reconocimiento de Entidades - NER).

textblob (Análisis de Sentimiento).

Base de Datos: SQLite (Ligera, para conteo de uso de API).

Frontend

Motor de Plantillas: Jinja2 (Nativo de Flask).

CSS Framework: Bootstrap 5 (CDN).

Lógica Cliente: JavaScript Vanilla (Fetch API) para comunicación asíncrona.

3. Arquitectura del Sistema

La aplicación sigue el patrón de diseño MVC (Modelo-Vista-Controlador) adaptado a Flask mediante Blueprints.

Árbol de Directorios Explicado
code
Text
download
content_copy
expand_less
/
├── run.py                    # [ENTRY POINT] Inicia el servidor y registra las Apps.
├── requirements.txt          # Dependencias del proyecto.
│
├── apps/                     # [CONTROLADORES + LÓGICA]
│   ├── __init__.py           # Inicializador de paquete.
│   ├── scraper_core.py       # [NÚCLEO CRÍTICO] Motor de búsqueda y scraping unificado.
│   ├── usage_tracker.py      # [DB] Gestión de SQLite para cuotas de API.
│   └── [tool_name].py        # Módulos individuales (cada herramienta es un archivo).
│
└── templates/                # [VISTAS]
    ├── base.html             # [LAYOUT MAESTRO] Contiene el Sidebar y estructura común.
    ├── portal.html           # Dashboard principal.
    └── [tool_folder]/        # Carpetas específicas para cada herramienta.
        └── dashboard.html    # Interfaz de la herramienta específica.
4. Componentes Críticos (El "Core")

Cualquier desarrollador que toque el código debe entender estos tres archivos antes de nada:

A. apps/scraper_core.py (El Motor Híbrido)

Es la pieza más compleja. Centraliza todas las peticiones externas para evitar bloqueos.

Función scrape_google_serp: Implementa lógica de "Scraping Inteligente". Usa parámetros gbv=1 para forzar la versión ligera de Google y evitar JS.

Función fetch_url_hybrid: Es un sistema de Fallback:

Intenta descargar la URL con requests (rápido).

Si detecta bloqueo (403/429) o contenido vacío (React/Angular), lanza Playwright (navegador Chromium headless) para renderizar el JS y capturar el HTML final.

Rotación: Gestiona listas de User-Agents aleatorios.

B. apps/usage_tracker.py (Persistencia)

Gestiona una base de datos SQLite (api_usage.db) para contar cuántas veces se llama a la API de pago de Google.

Es vital para no incurrir en costes extra.

Se inicializa automáticamente si el archivo .db no existe.

C. run.py (El Orquestador)

No contiene lógica de negocio, solo registra los Blueprints.

Si creas una herramienta nueva, debes importarla y registrarla aquí, o dará error 404.

Usa use_reloader=False para evitar conflictos con bucles de eventos en Windows.

5. Flujo de Datos (Data Flow)

La aplicación utiliza un patrón de Procesamiento Asíncrono Simulado (Polling) para no congelar la interfaz durante análisis largos.

Cliente (JS): El usuario pulsa "Analizar". Se envía un POST a /start con los parámetros.

Servidor (Flask):

Valida los datos.

Lanza un Hilo en segundo plano (threading.Thread) que ejecuta la función worker.

Devuelve inmediatamente un 200 OK al cliente.

Worker (Python):

Procesa las URLs una a una o en paralelo (concurrent.futures).

Actualiza una variable global job_status con el progreso (0-100%) y logs.

Cliente (JS):

Ejecuta un setInterval cada 1 segundo consultando /status.

Actualiza la barra de progreso y la consola visual.

Cuando active: False, renderiza la tabla de resultados.

6. Guía de Mantenimiento y Escalabilidad
Cómo añadir una nueva herramienta

Crear apps/nueva_tool.py. Definir Blueprint y lógica.

Crear templates/nueva/dashboard.html extendiendo de base.html.

Registrar el Blueprint en run.py.

Añadir el enlace en el menú lateral de templates/base.html.

Puntos de Dolor (Troubleshooting)

Google Bloqueos (429): Si el scraping falla, aumentar el parámetro delay (tiempo entre peticiones) en el frontend.

Playwright Fails: Si el navegador no arranca, verificar que se ha ejecutado playwright install en el servidor.

Spacy Error: Si NLP falla, verificar que se ha descargado el modelo es_core_news_sm.

Dependencias Externas (API Keys)

La aplicación soporta Google Custom Search JSON API.

Las claves (API Key y CX ID) no se guardan en base de datos por seguridad; el usuario las introduce en cada sesión (o el navegador las autocompleta).

7. Despliegue (Instrucciones para Devs)

Para levantar el proyecto en un entorno limpio:

Instalar dependencias:

code
Bash
download
content_copy
expand_less
pip install -r requirements.txt

Instalar binarios de navegador (Playwright):

code
Bash
download
content_copy
expand_less
playwright install chromium

Descargar modelo de lenguaje (Spacy):

code
Bash
download
content_copy
expand_less
python -m spacy download es_core_news_sm

Ejecutar:

code
Bash
download
content_copy
expand_less
python run.py

Este informe cubre todo lo necesario para que un nuevo programador entienda qué hace la aplicación, cómo lo hace y dónde tocar para mejorarla.

📘 1. Informe Técnico de Arquitectura (Actualizado v18)
Lo nuevo a tener en cuenta:
Persistencia: Ya no es una app "estática". Ahora hay una base de datos JSON (projects_db.json) y carpetas de historial (snapshots/).
Multiproceso Real: Se ha introducido un "Daemon" (monitor_daemon.py) que corre en paralelo al servidor web.
Integraciones Externas: OpenAI y Google APIs ahora son parte del núcleo.
Stack Tecnológico (Añadido)
Procesamiento Masivo: pandas (para gestión de Excels y DataFrames).
IA Generativa: openai (para el módulo AI Fixer).
Google Cloud: google-api-python-client (para GSC y PSI).
Concurrencia: Uso intensivo de threading para el Autopilot y el Monitor.
3. Arquitectura del Sistema (Nuevos Archivos)
code
Text
/
├── projects_db.json          # [DB] Base de datos de clientes y clústeres.
├── gsc_credentials.json      # [AUTH] Credenciales Google Cloud (Opcional).
├── snapshots/                # [HISTORIAL] JSONs con el estado anterior de las webs.
│
├── apps/
│   ├── project_manager.py    # [CORE] Gestión de Clientes, Clústeres y Backups.
│   ├── autopilot.py          # [MOTOR] El escáner masivo v5 (PSI, DNA, Broken Links).
│   ├── monitor_daemon.py     # [BACKGROUND] Vigilante 24/7 de Uptime.
│   ├── ai_fixer.py           # [IA] Generador de correcciones (Meta, Title, Alt).
│   └── gsc_tool.py           # [DATA] Conector con Search Console API.
4. Componentes Críticos Actualizados
D. apps/project_manager.py (El Cerebro de Sesión)
Gestiona qué cliente está activo. Utiliza Flask Session y un Context Processor para inyectar la variable current_project en todas las plantillas HTML automáticamente.
Nota Dev: Si tocas este archivo, asegúrate de mantener la estructura del JSON, o corromperás todos los proyectos guardados.
E. apps/autopilot.py (El Motor de Auditoría)
Es el script más complejo. Realiza:
Crawling Profundo: No solo la home, sino clústeres específicos definidos por el usuario.
Snapshot Diffing: Compara el JSON de hoy con el de ayer para detectar Content Decay (pérdida de texto).
TF-IDF: Análisis comparativo de n-grams contra la competencia.
F. apps/monitor_daemon.py (El Vigilante)
Este script se lanza como un daemon thread al iniciar run.py.
Cuidado: Entra en un bucle infinito while True. Si modificas el CHECK_INTERVAL a algo muy bajo (ej: 1 segundo), te banearán las IPs de los clientes. Mantener en 4-6 horas.
📘 2. Manual de Operaciones (Actualizado v18)
Lo nuevo a tener en cuenta:
Flujo Obligatorio: Ya no puedes "llegar y usar". Primero debes Crear/Seleccionar un Cliente.
Automatización: El Autopilot v5 hace el trabajo de 4 herramientas antiguas a la vez.
Reparación: Ya no solo detectas errores, los arreglas con IA.
1. La Interfaz de Control (Cambios)
Selector de Proyecto: Ahora verás una tarjeta negra en el menú lateral indicando el cliente activo ("Nike", "Mi Blog"). Si pone "Sin Asignar", muchas herramientas estarán bloqueadas.
Botón Monitor 24/7: Un indicador en el Autopilot que te dice si hay webs caídas.
2. Módulos y Capacidades (Nuevos)
🤖 Autopilot v5 Titanium (El Auditor Automático)
Sustituye el uso manual de múltiples herramientas.
Input: Defines Clústeres (ej: "Blog | /blog", "Tienda | /shop") en el Gestor de Clientes.
Output: Un Excel masivo con:
Core Web Vitals (PSI): Nota real de velocidad móvil.
Canibalización: Alerta si dos URLs compiten por el mismo Title.
Content DNA: Te dice: "Tu competencia usa la palabra 'barato' 20 veces y tú 0".
Broken Links: Detecta enlaces 404 internos.
✨ AI Auto-Fixer (Reparación Inteligente)
Cuando el Autopilot encuentra un error (ej: "Falta H1"), verás una Varita Mágica.
Al pulsarla, la IA lee tu contenido y redacta la etiqueta que falta. Solo tienes que copiar y pegar.
📈 GSC Tracker (Datos Reales)
Conecta con Google Search Console para ver clics e impresiones reales sin salir de la Suite.
Nota: Si no configuras la API, verás datos simulados para pruebas.
🗂️ Gestor de Clientes Pro
Carga Masiva: Puedes subir un Excel con 500 URLs y asignarlas a un cliente de golpe.
Backups: Botón para exportar toda tu base de datos de clientes a un archivo JSON de seguridad.
4. Flujos de Trabajo Actualizados (Playbook v18)
🅰️ El Nuevo "Día 1" (Setup de Cliente)
Ve a Gestor de Clientes > Nuevo.
Rellena Dominio, Competidores y sube el Excel con las URLs clave (Clústeres).
Ve a Autopilot > Ejecutar Full Scan.
Espera ~2 minutos.
Descarga el Excel de resultados.
Mira las alertas de Canibalización y Content DNA en pantalla.
🅱️ Mantenimiento Mensual
Entra al Dashboard. Mira el widget de Monitor 24/7 para ver si hubo caídas.
Ejecuta el Autopilot de nuevo.
Fíjate en las etiquetas de "Decay".
Ej: "📉 Perdió 300 palabras". -> Significa que alguien ha roto esa página o borrado contenido. Ve a arreglarlo.
🆎 Optimización de Contenidos (Con IA)
En el informe del Autopilot, busca errores de "Title muy largo" o "Falta Meta".
Haz clic en la Varita Mágica.
Copia la sugerencia de la IA y pégala en el CMS del cliente.
