# apps/monitor_daemon.py
"""
Demonio de monitoreo en segundo plano.
Se encarga de verificar periódicamente el estado (status code, tiempo de respuesta)
de las URLs configuradas en los proyectos y generar alertas.
"""
import threading
import logging
import time
import requests
import concurrent.futures
from collections import deque
from urllib.parse import urljoin, urlparse
from typing import Dict, Any
from apps.core.database import get_all_projects
from apps.tools.utils import is_safe_url

def mask_url_credentials(url: str) -> str:
    """Oculta credenciales en la URL para logs seguros."""
    try:
        parsed = urlparse(url)
        if parsed.password:
            return url.replace(parsed.password, '****')
        return url
    except Exception:
        return "url_invalida"

# Configuración
CHECK_INTERVAL = 3600 * 4  # Revisar cada 4 horas
GLOBAL_ALERTS = deque(maxlen=50)
ALERTS_LOCK = threading.Lock()
_MONITOR_STARTED = False


def check_target(target: Dict[str, Any], project_name: str) -> None:
    """
    Verifica el estado de una URL objetivo y genera alertas en caso de error o lentitud.

    Args:
        target (dict): Diccionario con 'url' y 'name' del objetivo.
        project_name (str): Nombre del proyecto al que pertenece el objetivo.
    """
    try:
        if not target or 'url' not in target:
            return

        if not is_safe_url(target['url']):
            logging.warning(f"Monitor skipped unsafe URL: {target['url']}")
            return

        # Timeout corto, solo queremos saber si está viva
        response = requests.head(target['url'], timeout=10, allow_redirects=True)

        # Si head falla (algunos servidores lo bloquean), probar GET
        if response.status_code == 405:
            response = requests.get(target['url'], timeout=10, stream=True)

        if response.status_code >= 400:
            msg = f"⚠️ Caída detectada en {target['name']} ({response.status_code})"
            add_alert(project_name, msg)

        # (Opcional) Verificar si es muy lenta (>2s)
        if response.elapsed.total_seconds() > 2.0:
             add_alert(project_name, f"🐢 Lentitud severa en {target['name']} (>2s)")

    except requests.exceptions.ConnectionError:
        add_alert(project_name, f"❌ Error Conexión: {target['name']} no responde")
    except Exception as e:
        safe_url = mask_url_credentials(target.get('url', ''))
        logging.warning(f"Monitor error for {safe_url}: {e}")

def monitor_loop():
    """
    Vigila TODAS las URLs configuradas en los clústeres de los proyectos.
    """
    while True:
        try:
            projects = get_all_projects()
            all_tasks = []

            for project in projects:
                domain = project.get('domain', '')
                if not domain: continue
                if not domain.startswith(('http://', 'https://')):
                    domain = f"https://{domain}"

                # Lista de URLs a revisar (Home + Clústeres)
                urls_to_check = []

                # 1. Añadir Home por defecto
                urls_to_check.append({"name": "Home", "url": domain})

                # 2. Añadir Clústeres
                clusters = project.get('clusters', [])
                for cluster in clusters:
                    # Normalizar URL
                    full_url = urljoin(domain, cluster['url'])
                    urls_to_check.append({"name": cluster['name'], "url": full_url})

                # Acumular tareas para ejecución en paralelo masiva
                for target in urls_to_check:
                    all_tasks.append((target, project['name']))

            # 3. Revisar todas las URLs con un único pool de hilos
            if all_tasks:
                with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                    futures = [
                        executor.submit(check_target, target, p_name)
                        for target, p_name in all_tasks
                    ]
                    # Esperar a que terminen todas antes de dormir
                    concurrent.futures.wait(futures)

        except Exception as e:
            logging.error(f"Error crítico en Monitor Daemon: {e}")

        time.sleep(CHECK_INTERVAL)

def add_alert(project_name: str, msg: str) -> None:
    """
    Añade una alerta a la cola global de alertas, evitando duplicados consecutivos.

    Args:
        project_name (str): Nombre del proyecto afectado.
        msg (str): Mensaje de error o advertencia.
    """
    timestamp = time.strftime("%d/%m %H:%M")
    with ALERTS_LOCK:
        # Evitar duplicados consecutivos (spam de alertas si la web sigue caída)
        if GLOBAL_ALERTS and GLOBAL_ALERTS[0]['msg'] == msg and GLOBAL_ALERTS[0]['project'] == project_name:
            return

        GLOBAL_ALERTS.appendleft({"time": timestamp, "project": project_name, "msg": msg})

def start_monitor():
    """
    Inicia el hilo del demonio de monitoreo en segundo plano.
    El hilo se configura como daemon para cerrarse con la aplicación principal.
    """
    global _MONITOR_STARTED
    if _MONITOR_STARTED:
        logging.info("Monitor daemon already running.")
        return

    # Daemon=True asegura que si cierras la app, el hilo muere
    thread = threading.Thread(target=monitor_loop, daemon=True)
    thread.start()
    _MONITOR_STARTED = True
    logging.info("Monitor daemon started.")
