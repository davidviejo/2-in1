from flask import Blueprint, render_template, request, jsonify, send_file
import requests
from bs4 import BeautifulSoup
import json
import concurrent.futures
import pandas as pd
import io
import re

schema_bp = Blueprint('schema_tool', __name__, url_prefix='/schema_tool')

def analyze_structured_data_detailed(soup, schema_data_tool):
    # Base from tool
    if isinstance(schema_data_tool, dict) and schema_data_tool.get('error'):
         return {"error": schema_data_tool['error']}

    # 1. Re-parse JSON-LD to catch errors
    schemas_parsed = []
    schemas_raw = []
    parse_errors = []

    # Flags
    has_address = False
    has_geo = False
    has_area_served = False
    has_same_as = False

    def check_flags_recursive(obj):
        nonlocal has_address, has_geo, has_area_served, has_same_as
        if isinstance(obj, dict):
            if 'address' in obj: has_address = True
            if 'geo' in obj: has_geo = True
            if 'areaServed' in obj: has_area_served = True
            if 'sameAs' in obj: has_same_as = True
            for v in obj.values():
                check_flags_recursive(v)
        elif isinstance(obj, list):
            for item in obj:
                check_flags_recursive(item)

    if soup:
        scripts = soup.find_all('script', type='application/ld+json')
        for idx, script in enumerate(scripts):
            content = script.string
            if not content:
                continue

            # Clean control characters
            clean_content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)
            schemas_raw.append(clean_content)

            try:
                data = json.loads(clean_content)
                schemas_parsed.append(data)
                check_flags_recursive(data)
            except json.JSONDecodeError as e:
                parse_errors.append({
                    "index": idx,
                    "error": str(e),
                    "snippet": clean_content[:100] + "..."
                })

    # Merge with tool's Microdata types if any
    microdata_types = schema_data_tool.get('microdata_types', [])
    json_ld_types = schema_data_tool.get('json_ld_types', [])

    # If we parsed more successfully than the tool (unlikely but possible), update types?
    # For now, trust tool for types list as it handles recursion well.

    return {
        "autoData": {
            "detected_types": json_ld_types + microdata_types,
            "schemasParsed": schemas_parsed,
            "schemasRaw": schemas_raw,
            "parseErrors": parse_errors,
            "flags": {
                "hasAddress": has_address,
                "hasGeo": has_geo,
                "hasAreaServed": has_area_served,
                "hasSameAs": has_same_as
            }
        },
        "recommendation": "Validate with Schema Markup Validator." if not parse_errors else "Fix JSON-LD syntax errors.",
        "status": "GOOD" if (schemas_parsed or microdata_types) and not parse_errors else ("FIX" if parse_errors else "INFO")
    }

def extract(url):
    result = {'url': url, 'types': [], 'raw': [], 'details': {}, 'status': 0}
    try:
        response = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=8)
        result['status'] = response.status_code
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            for script in soup.find_all('script', type='application/ld+json'):
                if script.string:
                    try:
                        json_content = json.loads(script.string)
                        result['raw'].append(json_content)
                        items = json_content if isinstance(json_content, list) else [json_content]
                        for item in items:
                            if isinstance(item, dict):
                                result['types'].append(item.get('@type', 'Unknown'))
                    except: pass
            result['types'] = list(set(result['types']))
    except Exception as e: result['status'] = str(e)
    return result

@schema_bp.route('/')
def index(): return render_template('schema_tool/dashboard.html')

@schema_bp.route('/scan', methods=['POST'])
def scan():
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(extract, u): u for u in (request.get_json(silent=True) or {}).get('urls', []) if u.strip()}
        for future in concurrent.futures.as_completed(futures): results.append(future.result())
    return jsonify({'status':'ok', 'data':results})

@schema_bp.route('/download', methods=['POST'])
def download():
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame((request.get_json(silent=True) or {}).get('data', [])).to_excel(writer, index=False)
    output.seek(0)
    return send_file(output, download_name='schema.xlsx', as_attachment=True)
