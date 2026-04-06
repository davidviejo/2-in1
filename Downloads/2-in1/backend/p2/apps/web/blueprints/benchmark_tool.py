from flask import Blueprint, render_template, request, jsonify
from apps.tools.scraper_core import smart_serp_search, get_soup
import concurrent.futures
import statistics

benchmark_bp = Blueprint('benchmark', __name__, url_prefix='/benchmark')

def analyze_metrics(url):
    data = {'url': url, 'words': 0, 'imgs': 0, 'headers': 0, 'status': 0}
    soup = get_soup(url, delay=0.5)
    if soup:
        data['status'] = 200
        for x in soup(["script", "style", "nav", "footer", "svg", "form"]): x.extract()
        text = soup.get_text(separator=' ')
        data['words'] = len([w for w in text.split() if len(w) > 1])
        data['imgs'] = len(soup.find_all('img'))
        data['headers'] = len(soup.find_all(['h1', 'h2', 'h3']))
    return data

@benchmark_bp.route('/')
def index(): return render_template('benchmark/dashboard.html')

@benchmark_bp.route('/run', methods=['POST'])
def run():
    j = request.json
    kw = j.get('keyword', '').strip()
    my_url = j.get('my_url', '').strip()

    if not kw: return jsonify({'error': 'Falta Keyword'})

    # --- SELECCIÓN DE MOTOR UNIFICADA ---
    # j contiene 'mode', 'cse_key', 'cse_cx', 'cookie', etc.
    res = smart_serp_search(
        keyword=kw,
        config=j,
        num_results=10
    )

    if not res: return jsonify({'error': 'Sin resultados o Error de búsqueda'})

    competitor_urls = [r['url'] for r in res if r.get('url')]

    if not competitor_urls: return jsonify({'error': 'Sin resultados válidos'})

    # Análisis
    urls_scan = competitor_urls.copy()
    if my_url and my_url not in urls_scan: urls_scan.append(my_url)

    scanned = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        ft = {ex.submit(analyze_metrics, u): u for u in urls_scan}
        for f in concurrent.futures.as_completed(ft):
            d = f.result()
            if d['status'] == 200:
                d['is_me'] = (d['url'] == my_url)
                scanned.append(d)

    comps = [x for x in scanned if not x['is_me']]
    avgs = {'words': 0, 'imgs': 0, 'headers': 0}
    if comps:
        avgs['words'] = int(statistics.mean([x['words'] for x in comps[:3]]))
        avgs['imgs'] = int(statistics.mean([x['imgs'] for x in comps[:3]]))
        avgs['headers'] = int(statistics.mean([x['headers'] for x in comps[:3]]))

    return jsonify({'status':'ok', 'averages':avgs, 'competitors':comps, 'my_data':next((x for x in scanned if x['is_me']), None)})
