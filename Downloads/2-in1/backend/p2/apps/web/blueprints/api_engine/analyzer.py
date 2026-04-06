import re
import json
import logging
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from collections import Counter
from apps.tools.scraper_core import fetch_url_hybrid

def run_seo_checklist_analysis(url, kwPrincipal, pageType, geoTarget=None, cluster=None):
    # 1. Fetch content
    fetched = fetch_url_hybrid(url)
    if not fetched.get('content'):
        return _error_response("Could not fetch content")

    soup = BeautifulSoup(fetched['content'], 'html.parser')
    text_content = soup.get_text(" ", strip=True)

    # 2. Extract Data
    return {
        "CLUSTER": _analyze_cluster(cluster),
        "GEOLOCALIZACION": _analyze_geo(soup, geoTarget, text_content),
        "DATOS_ESTRUCTURADOS": _analyze_structured_data(soup),
        "CONTENIDOS": _analyze_content(soup, text_content, kwPrincipal),
        "SNIPPETS": _analyze_snippets(soup),
        "IMAGENES": _analyze_images(soup, url, geoTarget),
        "ENLAZADO_INTERNO": _analyze_internal_links(soup, url),
        "ESTRUCTURA": _analyze_structure(soup),
        "UX": _analyze_ux(soup),
        "WPO": _analyze_wpo(soup, fetched.get('content', '')),
        "ENLACE": _analyze_enlace(),
        "OPORTUNIDADES_VS_KW_OBJETIVO": _analyze_opportunities(soup, kwPrincipal),
        "SEMANTICA": _analyze_semantics(text_content),
        "GEOLOCALIZACION_IMAGENES": _analyze_geo_images(soup, geoTarget),
        "LLAMADA_A_LA_ACCION": _analyze_cta(soup)
    }

def _error_response(msg: str) -> Dict[str, Any]:
    keys = [
        "CLUSTER", "GEOLOCALIZACION", "DATOS_ESTRUCTURADOS", "CONTENIDOS",
        "SNIPPETS", "IMAGENES", "ENLAZADO_INTERNO", "ESTRUCTURA", "UX",
        "WPO", "ENLACE", "OPORTUNIDADES_VS_KW_OBJETIVO", "SEMANTICA",
        "GEOLOCALIZACION_IMAGENES", "LLAMADA_A_LA_ACCION"
    ]
    return {k: {"error": msg} for k in keys}

def _analyze_cluster(cluster: str) -> Dict[str, Any]:
    return {
        "autoData": {"cluster_input": cluster},
        "recommendation": "Manual review required for cluster alignment.",
        "suggested_status": "PARCIAL"
    }

def _analyze_geo(soup: BeautifulSoup, geo_target: str, text: str) -> Dict[str, Any]:
    if not geo_target:
        return {"autoData": {}, "recommendation": "No Geo Target provided", "status": "INFO"}

    geo_lower = geo_target.lower()
    found_in_title = geo_lower in (soup.title.string or "").lower()
    found_in_h1 = False
    h1 = soup.find('h1')
    if h1:
        found_in_h1 = geo_lower in h1.get_text().lower()

    found_in_text = geo_lower in text[:500].lower() # First 500 chars

    status = "GOOD" if (found_in_title or found_in_h1) else "IMPROVE"

    return {
        "autoData": {
            "found_in_title": found_in_title,
            "found_in_h1": found_in_h1,
            "found_in_intro": found_in_text
        },
        "recommendation": f"Ensure '{geo_target}' is in Title and H1.",
        "status": status
    }

def _analyze_structured_data(soup: BeautifulSoup) -> Dict[str, Any]:
    schemas = []
    errors = []
    scripts = soup.find_all('script', type='application/ld+json')
    for script in scripts:
        try:
            data = json.loads(script.get_text())
            if isinstance(data, dict):
                schemas.append(data.get('@type', 'Unknown'))
            elif isinstance(data, list):
                for item in data:
                    schemas.append(item.get('@type', 'Unknown'))
        except json.JSONDecodeError:
            errors.append("Invalid JSON-LD syntax")

    return {
        "autoData": {"detected_types": schemas, "errors": errors},
        "recommendation": "Validate with Schema Markup Validator." if not errors else "Fix JSON syntax errors.",
        "status": "GOOD" if schemas else "INFO"
    }

def _analyze_content(soup: BeautifulSoup, text: str, kw: str) -> Dict[str, Any]:
    length = len(text.split())
    kw_count = 0
    if kw:
        kw_count = text.lower().count(kw.lower())

    return {
        "autoData": {
            "word_count": length,
            "keyword_density": round((kw_count / length) * 100, 2) if length > 0 else 0,
            "keyword_count": kw_count
        },
        "recommendation": "Target 1000+ words for competitive topics." if length < 500 else "Good content length.",
        "status": "GOOD" if length > 300 else "THIN"
    }

def _analyze_snippets(soup: BeautifulSoup) -> Dict[str, Any]:
    title = soup.title.get_text(strip=True) if soup.title else ""
    meta_desc = ""
    desc_tag = soup.find('meta', attrs={'name': 'description'})
    if desc_tag:
        meta_desc = desc_tag.get('content', '').strip()

    return {
        "autoData": {
            "title": title,
            "title_length": len(title),
            "description": meta_desc,
            "description_length": len(meta_desc)
        },
        "recommendation": "Keep Title 50-60 chars, Desc 150-160 chars.",
        "status": "GOOD" if (10 < len(title) < 70 and 100 < len(meta_desc) < 170) else "IMPROVE"
    }

def _analyze_images(soup: BeautifulSoup, url: str, geo_target: str) -> Dict[str, Any]:
    imgs = soup.find_all('img')
    total = len(imgs)
    missing_alt = 0
    lazy_load = 0
    geo_in_alt = 0

    details = []

    for img in imgs:
        alt = img.get('alt', '').strip()
        src = img.get('src', '')
        if not alt:
            missing_alt += 1
        else:
            if geo_target and geo_target.lower() in alt.lower():
                geo_in_alt += 1

        if img.get('loading') == 'lazy':
            lazy_load += 1

        details.append({'src': src, 'alt': alt, 'width': img.get('width'), 'height': img.get('height')})

    return {
        "autoData": {
            "total_images": total,
            "missing_alt": missing_alt,
            "lazy_load_count": lazy_load,
            "geo_keyword_in_alt": geo_in_alt,
            "details_sample": details[:5] # Return first 5 to avoid bloating response
        },
        "recommendation": "Add Alt text to all images. Use WebP.",
        "status": "GOOD" if missing_alt == 0 else "FIX"
    }

def _analyze_internal_links(soup: BeautifulSoup, base_url: str) -> Dict[str, Any]:
    domain = urlparse(base_url).netloc
    links = soup.find_all('a', href=True)
    internal = 0
    external = 0

    for a in links:
        href = a['href']
        parsed = urlparse(urljoin(base_url, href))
        if parsed.netloc == domain or not parsed.netloc:
            internal += 1
        else:
            external += 1

    return {
        "autoData": {"internal_links": internal, "external_links": external},
        "recommendation": "Ensure good internal linking structure.",
        "status": "INFO"
    }

def _analyze_structure(soup: BeautifulSoup) -> Dict[str, Any]:
    headers = []
    for h in soup.find_all(['h1', 'h2', 'h3']):
        headers.append({'tag': h.name, 'text': h.get_text(strip=True)[:100]})

    h1_count = len(soup.find_all('h1'))

    return {
        "autoData": {"h1_count": h1_count, "outline": headers},
        "recommendation": "Use exactly one H1.",
        "status": "GOOD" if h1_count == 1 else "FIX"
    }

def _analyze_ux(soup: BeautifulSoup) -> Dict[str, Any]:
    viewport = soup.find('meta', attrs={'name': 'viewport'})
    has_viewport = bool(viewport)

    return {
        "autoData": {"has_viewport": has_viewport},
        "recommendation": "Ensure mobile responsiveness.",
        "status": "GOOD" if has_viewport else "CRITICAL"
    }

def _analyze_wpo(soup: BeautifulSoup, html_content: Any) -> Dict[str, Any]:
    # html_content can be bytes or str
    size_kb = 0
    if isinstance(html_content, bytes):
        size_kb = len(html_content) / 1024
    elif isinstance(html_content, str):
        size_kb = len(html_content.encode('utf-8')) / 1024

    resources = len(soup.find_all(['script', 'link', 'img']))

    return {
        "autoData": {"html_size_kb": round(size_kb, 2), "resource_count": resources},
        "recommendation": "Keep HTML under 100KB if possible.",
        "status": "GOOD" if size_kb < 100 else "IMPROVE"
    }

def _analyze_enlace() -> Dict[str, Any]:
    return {
        "autoData": {},
        "recommendation": "Manual check of backlink profile required.",
        "status": "INFO"
    }

def _analyze_opportunities(soup: BeautifulSoup, kw: str) -> Dict[str, Any]:
    title = (soup.title.string or "").lower()
    intents = []
    if any(x in title for x in ['precio', 'comprar', 'venta', 'barato']):
        intents.append("Transactional")
    if any(x in title for x in ['mejor', 'top', 'comparativa', 'opiniones']):
        intents.append("Commercial")
    if any(x in title for x in ['qué es', 'como', 'guía', 'tutorial']):
        intents.append("Informational")

    return {
        "autoData": {"detected_intents": intents},
        "recommendation": f"Ensure content matches user intent for '{kw}'.",
        "status": "INFO"
    }

def _analyze_semantics(text: str) -> Dict[str, Any]:
    words = re.findall(r'\w+', text.lower())
    # Remove common stop words (very basic list)
    stop_words = {'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'se', 'del', 'las', 'un', 'por', 'con', 'no', 'una', 'su', 'para', 'es', 'al', 'lo', 'como', 'más', 'o', 'pero', 'sus', 'le', 'ha', 'me', 'si', 'sin', 'sobre', 'este', 'ya', 'entre', 'cuando', 'todo', 'esta', 'ser', 'son', 'dos', 'también', 'fue', 'había', 'era', 'muy', 'años', 'hasta', 'desde', 'está', 'mi', 'porque', 'qué', 'solo', 'han', 'yo', 'hay', 'vez', 'puede', 'todos', 'así', 'nos', 'ni', 'parte', 'tiene', 'él', 'uno', 'donde', 'bien', 'tiempo', 'mismo', 'ese', 'ahora', 'cada', 'e', 'vida', 'otro', 'después', 'te', 'otros', 'aunque', 'esa', 'eso', 'hace', 'otra', 'gobierno', 'tan', 'durante', 'siempre', 'día', 'tanto', 'ella', 'tres', 'sí', 'dijo', 'sido', 'gran', 'país', 'según', 'menos', 'año', 'antes', 'estado', 'contra', 'sino', 'forma', 'caso', 'nada', 'hacer', 'general', 'estaba', 'poco', 'estos', 'presidente', 'mayor', 'ante', 'unos', 'les', 'algo', 'hacia', 'casa', 'ellos', 'ayer', 'hecho', 'primera', 'mucho', 'mientras', 'además', 'quien', 'momento', 'millones', 'esto', 'españa', 'hombre', 'están', 'pues', 'hoy', 'lugar', 'madrid', 'nacional', 'trabajo', 'otras', 'mejor', 'nuevo', 'decir', 'algunos', 'entonces', 'todas', 'días', 'debe', 'política', 'cómo', 'casi', 'toda', 'tal', 'luego', 'pasado', 'primer', 'medio', 'va', 'estas', 'sea', 'tenía', 'nunca', 'poder', 'aquí', 'ver', 'veces', 'embargo', 'partido', 'personas', 'grupo', 'cuenta', 'pueden', 'tienen', 'misma', 'nueva', 'cual', 'fueron', 'mujer', 'frente', 'josé', 'tras', 'cosas', 'fin', 'ciudad', 'he', 'social', 'manera', 'tener', 'sistema', 'será', 'historia', 'muchos', 'juan', 'tipo', 'cuatro', 'dentro', 'nuestro', 'punto', 'dice', 'ello', 'cualquier', 'noche', 'aún', 'agua', 'parece', 'haber', 'situación', 'fuera', 'bajo', 'grandes', 'todavía', 'ejemplo', 'acuerdo', 'habían', 'usted', 'estados', 'hizo', 'nadie', 'países', 'horas', 'posible', 'tarde', 'ley', 'importante', 'guerra', 'desarrollo', 'proceso', 'realidad', 'sentido', 'lado', 'mí', 'tu', 'cambio', 'allí', 'mano', 'eran', 'estar', 'san', 'número', 'sociedad', 'unas', 'centro', 'padre', 'gente', 'final', 'relación', 'cuerpo', 'obra', 'incluso', 'través', 'último', 'madre', 'mis', 'modo', 'problemas', 'cinco', 'carlos', 'hombres', 'ojos', 'muerte', 'nombre', 'algunas', 'público', 'mujeres', 'siglo', 'todavia', 'mundo', 'gracias', 'paz'}

    filtered = [w for w in words if w not in stop_words and len(w) > 3]
    common = Counter(filtered).most_common(10)

    return {
        "autoData": {"top_terms": common},
        "recommendation": "Use LSI keywords naturally.",
        "status": "INFO"
    }

def _analyze_geo_images(soup: BeautifulSoup, geo_target: str) -> Dict[str, Any]:
    if not geo_target:
        return {"autoData": {}, "recommendation": "No Geo Target provided", "status": "INFO"}

    geo_in_src = 0
    geo_in_alt = 0

    for img in soup.find_all('img'):
        src = img.get('src', '').lower()
        alt = img.get('alt', '').lower()
        geo = geo_target.lower()

        if geo in src:
            geo_in_src += 1
        if geo in alt:
            geo_in_alt += 1

    return {
        "autoData": {"geo_in_src": geo_in_src, "geo_in_alt": geo_in_alt},
        "recommendation": "Include geo target in image filenames and alt text.",
        "status": "GOOD" if (geo_in_src > 0 or geo_in_alt > 0) else "IMPROVE"
    }

def _analyze_cta(soup: BeautifulSoup) -> Dict[str, Any]:
    cta_pattern = re.compile(r'reserva|cita|llamar|contacto|comprar|pedir|presupuesto', re.IGNORECASE)

    found_cta = False
    cta_text = ""

    # Check buttons and links
    for el in soup.find_all(['a', 'button']):
        text = el.get_text(strip=True)
        if cta_pattern.search(text):
            found_cta = True
            cta_text = text
            break

    return {
        "autoData": {"found_cta": found_cta, "cta_text": cta_text},
        "recommendation": "Add a clear Call to Action." if not found_cta else "CTA found.",
        "status": "GOOD" if found_cta else "FIX"
    }
