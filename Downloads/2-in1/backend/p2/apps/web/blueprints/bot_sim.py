"""
Simulador de Bot de Google (Googlebot).
Permite comparar cómo ve una página un usuario normal vs Googlebot para detectar
cloaking o bloqueos.
"""
from flask import Blueprint, render_template, request, jsonify
import requests
import logging
from urllib.parse import urlparse
from apps.tools.utils import is_safe_url
from apps.core.config import Config

bot_bp = Blueprint('bot_sim', __name__, url_prefix='/bot_sim')

TIMEOUT = (3, 10)  # (connect, read) en segundos

session = requests.Session()


def _normalize_url(url: str) -> str:
    """Asegura que la URL tenga esquema (http/https)."""
    if not url:
        return ''
    url = url.strip()
    if not url:
        return ''
    parsed = urlparse(url)
    if not parsed.scheme:
        # Si no tiene esquema, asumimos https
        return 'https://' + url
    return url


def _fetch(url: str, user_agent: str) -> dict:
    """Hace la petición y devuelve info estructurada."""
    try:
        resp = session.get(
            url,
            headers={'User-Agent': user_agent},
            timeout=TIMEOUT,
            allow_redirects=True,
        )
        return {
            'ok': True,
            'status': resp.status_code,
            'len': len(resp.content),
            'error': None,
        }
    except requests.exceptions.Timeout:
        return {
            'ok': False,
            'status': None,
            'len': 0,
            'error': 'timeout',
        }
    except requests.exceptions.RequestException as e:
        logging.error(f"BotSim Error for {url}: {e}")
        return {
            'ok': False,
            'status': None,
            'len': 0,
            'error': 'Error de conexión',
        }


def check(url: str) -> dict:
    """
    Analiza una URL comparando la respuesta para User-Agent de usuario y de Bot.
    Detecta bloqueos, diferencias de contenido y errores.
    """
    url_norm = _normalize_url(url)

    result = {
        'url': url,
        'normalized_url': url_norm,
        'status': 'OK',  # valor por defecto
        'user': None,
        'bot': None,
    }

    if not url_norm:
        result['status'] = 'URL_VACIA'
        return result

    if not is_safe_url(url_norm):
        result['status'] = 'URL_NO_PERMITIDA'
        return result

    user_res = _fetch(url_norm, Config.BOT_SIM_UA_USER)
    bot_res = _fetch(url_norm, Config.BOT_SIM_UA_BOT)

    result['user'] = user_res
    result['bot'] = bot_res

    # Si ambas peticiones fallan
    if not user_res['ok'] and not bot_res['ok']:
        result['status'] = 'ERROR_AMBOS'
        return result

    # Si sólo falla una
    if not user_res['ok']:
        result['status'] = 'ERROR_USER'
        return result

    if not bot_res['ok']:
        result['status'] = 'ERROR_BOT'
        return result

    # A partir de aquí, ambas son ok
    u_status, b_status = user_res['status'], bot_res['status']
    u_len, b_len = user_res['len'], bot_res['len']

    # Usuario 200 y bot no 200 → bloqueado
    if u_status == 200 and b_status != 200:
        result['status'] = 'BLOQUEADO'
        return result

    # Si ambas 200, comparamos tamaño del contenido
    if u_status == 200 and b_status == 200 and max(u_len, b_len) > 0:
        diff = abs(u_len - b_len)
        rel_diff = diff / max(u_len, b_len)
        if rel_diff > 0.5:
            result['status'] = 'DIFERENTE'
            return result

    # Si nada raro, se queda en OK
    return result


@bot_bp.route('/')
def index():
    """Renderiza el dashboard del simulador de bot."""
    return render_template('bot_sim/dashboard.html')


@bot_bp.route('/analyze', methods=['POST'])
def analyze():
    """
    Endpoint para analizar una lista de URLs.
    Devuelve el estado de cada una (OK, BLOQUEADO, DIFERENTE, etc).
    """
    urls = request.json.get('urls', [])
    data = [check(u) for u in urls if u.strip()]
    return jsonify({'status': 'ok', 'data': data})
