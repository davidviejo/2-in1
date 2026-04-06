"""
Módulo para clasificación de intención de búsqueda de palabras clave.
Utiliza reglas basadas en modificadores léxicos para determinar si una keyword es
Transaccional, Informacional, Comercial o Navegacional.
"""
from flask import Blueprint, render_template, request, jsonify, send_file
import pandas as pd
import io

kw_intent_bp = Blueprint('kw_intent', __name__, url_prefix='/kw_intent')

def classify_keyword(kw):
    """
    Clasifica una palabra clave según su intención de búsqueda.

    Args:
        kw (str): La palabra clave a analizar.

    Returns:
        dict: Diccionario con la keyword, la intención detectada y el color para UI.
    """
    kw_lower = kw.lower().strip()

    trans_mods = ['comprar', 'precio', 'venta', 'oferta', 'barato', 'tienda', 'alquiler', 'reserva', 'presupuesto', 'coste', 'envío', 'stock', 'coupon', 'descuento', 'buy', 'price', 'sale']
    info_mods = ['que es', 'qué es', 'como', 'cómo', 'cuando', 'donde', 'dónde', 'por que', 'por qué', 'quien', 'historia', 'significado', 'ejemplos', 'guía', 'tutorial', 'pasos', 'trucos', 'consejos', 'how to', 'what is']
    comm_mods = ['mejor', 'mejores', 'top', 'vs', 'comparativa', 'review', 'opiniones', 'analisis', 'crítica', 'ventajas', 'desventajas', 'best', 'review']
    nav_mods = ['login', 'entrar', 'iniciar sesion', 'contacto', 'telefono', 'soporte', 'web oficial', 'sitio oficial', 'app', 'descargar']

    intent = "Ambiguo / General"
    color = "secondary"

    if any(m in kw_lower for m in nav_mods):
        intent = "Navegacional"; color = "warning text-dark"
    elif any(m in kw_lower for m in info_mods):
        intent = "Informacional"; color = "info text-dark"
    elif any(m in kw_lower for m in comm_mods):
        intent = "Comercial"; color = "primary"
    elif any(m in kw_lower for m in trans_mods):
        intent = "Transaccional"; color = "success"

    return {'keyword': kw, 'intent': intent, 'color': color}

@kw_intent_bp.route('/')
def index():
    """Renders the dashboard for Keyword Intent Classifier."""
    return render_template('kw_intent/dashboard.html')

@kw_intent_bp.route('/classify', methods=['POST'])
def classify():
    """
    Endpoint para clasificación masiva de palabras clave.

    Returns:
        JSON: Lista de resultados de clasificación y estadísticas globales.
    """
    text = (request.get_json(silent=True) or {}).get('keywords', '')
    keywords = [k.strip() for k in text.split('\n') if k.strip()]
    if not keywords: return jsonify({'error': 'Pon keywords'})

    if len(keywords) > 500:
        return jsonify({'error': 'Límite excedido: Máximo 500 keywords por petición'}), 400

    results = [classify_keyword(k) for k in keywords]
    stats = {'trans': 0, 'comm': 0, 'info': 0, 'nav': 0}
    for x in results:
        intent = x.get('intent', '')
        if 'Transaccional' in intent:
            stats['trans'] += 1
        elif 'Comercial' in intent:
            stats['comm'] += 1
        elif 'Informacional' in intent:
            stats['info'] += 1
        elif 'Navegacional' in intent:
            stats['nav'] += 1

    return jsonify({'status': 'ok', 'data': results, 'stats': stats})

@kw_intent_bp.route('/download', methods=['POST'])
def download():
    """
    Generates and downloads an Excel file with the classification results.
    """
    try:
        data = (request.get_json(silent=True) or {}).get('data', [])
        if not data:
            return jsonify({'error': 'No data'}), 400

        df = pd.DataFrame(data)
        # Validate columns
        if 'keyword' not in df.columns or 'intent' not in df.columns:
            return jsonify({'error': 'Invalid data structure: missing keyword or intent'}), 400

        df = df[['keyword', 'intent']]
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Keyword Intent")
        output.seek(0)
        return send_file(output, download_name='keyword_intent.xlsx', as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
