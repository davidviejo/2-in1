import socket
import ipaddress
import unicodedata
import re
from urllib.parse import urlparse

__all__ = ['validate_url', 'clean_url', 'is_safe_url', 'normalize', 'sanitize_log_message', 'safe_get_json']

def normalize(text: str) -> str:
    """
    Normaliza un texto eliminando acentos y caracteres especiales.
    Convierte a minúsculas y ASCII.
    """
    if not text:
        return ""
    return unicodedata.normalize('NFKD', text.lower()).encode('ascii', 'ignore').decode('utf-8')

def sanitize_log_message(message: str) -> str:
    """
    Oculta valores sensibles en mensajes de log para evitar fugas de información.

    Args:
        message (str): El mensaje o URL original.

    Returns:
        str: El mensaje sanitizado con valores sensibles reemplazados por 'REDACTED'.
    """
    if not message:
        return ""
    if not isinstance(message, str):
        message = str(message)

    # Patrón para ocultar valores de query params sensibles
    # Detecta key=valor, api_key=valor, token=valor, secret=valor, password=valor, cx=valor
    pattern = r'(key|api_key|token|secret|password|cx)=([^&\s]+)'
    return re.sub(pattern, r'\1=REDACTED', message, flags=re.IGNORECASE)

def is_safe_url(url: str) -> bool:
    """
    Verifica si una URL es segura para visitar (es decir, no es una IP privada/local).
    Previene ataques SSRF.

    Args:
        url (str): La URL a verificar.

    Returns:
        bool: True si la URL es segura, False de lo contrario.
    """
    if not validate_url(url):
        return False

    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return False

        # Resolve IP
        try:
            ip_str = socket.gethostbyname(hostname)
        except socket.error:
            # If DNS resolution fails, we consider it unsafe or at least invalid
            return False

        ip = ipaddress.ip_address(ip_str)

        # Check if private or loopback
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            return False

        return True
    except Exception:
        return False

def validate_url(url: str) -> bool:
    """
    Valida si la cadena proporcionada es una URL válida con esquema http o https.

    Args:
        url (str): La cadena URL a validar.

    Returns:
        bool: True si la URL es válida y tiene esquema http/https, False de lo contrario.
    """
    if not url or not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
        return parsed.scheme in ('http', 'https') and bool(parsed.netloc)
    except Exception:
        return False

def clean_url(url: str) -> str:
    """
    Limpia una cadena URL eliminando espacios en blanco al inicio y al final.

    Args:
        url (str): La cadena URL a limpiar.

    Returns:
        str: La cadena URL limpia, o una cadena vacía si la entrada es None.
    """
    if not url:
        return ""
    return str(url).strip()

def safe_get_json(silent: bool = True) -> dict:
    """
    Obtiene los datos JSON de la solicitud de Flask de manera segura.
    Garantiza que el resultado sea siempre un diccionario.

    Args:
        silent (bool): Si es True, no lanza excepciones si falla el parseo.

    Returns:
        dict: El cuerpo JSON si es un diccionario válido, o un diccionario vacío en caso contrario.
    """
    try:
        from flask import request
        data = request.get_json(silent=silent)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}
