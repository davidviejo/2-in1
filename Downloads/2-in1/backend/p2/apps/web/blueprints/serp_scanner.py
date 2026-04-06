# apps/serp_scanner.py
import logging
from apps.tools.scraper_core import smart_serp_search

# Tu lista negra del código proporcionado
BLACKLIST = [
    'google.', 'duckduckgo.', 'bing.', 'yahoo.', 'facebook.', 'instagram.',
    'twitter.', 'youtube.', 'tiktok.', 'milanuncios.', 'fotocasa.',
    'idealista.', 'pinterest.', 'amazon.', 'ebay.', 'wikipedia.', 'aliexpress.'
]

def is_valid_url(url):
    """
    Verifica si una URL es válida y no pertenece a la lista negra de portales gigantes (e.g. Amazon, Wikipedia).

    Args:
        url (str): La URL a verificar.

    Returns:
        bool: True si la URL es válida y orgánica (no en blacklist), False de lo contrario.
    """
    if not url: return False
    u = url.lower()
    for b in BLACKLIST:
        if b in u: return False
    return True

def find_competitors(keyword, lang="es-ES", limit=3):
    """
    Busca competidores orgánicos ignorando portales gigantes.
    Utiliza smart_serp_search (DataForSEO, Google, DDG).
    """
    if not keyword: return []

    results = []
    try:
        # Usamos smart_serp_search con config vacía para usar la prioridad por defecto
        # (DataForSEO si hay credenciales, sino DDG)
        raw_results = smart_serp_search(keyword, config={}, num_results=limit*2, lang=lang)

        for r in raw_results:
            url = r.get('url')

            # APLICAMOS TU FILTRO AQUÍ
            if is_valid_url(url):
                results.append({
                    "title": r.get('title'),
                    "url": url,
                    "snippet": r.get('snippet')
                })

            if len(results) >= limit: break

        return results
    except Exception as e:
        logging.error(f"Error buscando competidores: {e}")
        return []
