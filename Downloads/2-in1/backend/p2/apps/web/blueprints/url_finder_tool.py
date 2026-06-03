from __future__ import annotations

from flask import Blueprint, jsonify, render_template, request, send_file

from apps.services.url_finder import (
    analyze_urls,
    build_csv,
    create_job,
    get_job_snapshot,
    parse_payload,
)
from apps.tools.utils import safe_get_json

url_finder_bp = Blueprint('url_finder', __name__, url_prefix='/url_finder')


@url_finder_bp.route('/')
def index():
    return render_template('url_finder/dashboard.html')


@url_finder_bp.route('/api/jobs', methods=['POST'])
def create_analysis_job():
    payload = parse_payload(safe_get_json())
    validation_error = _validate_payload(payload)
    if validation_error:
        return jsonify({'ok': False, 'error': validation_error}), 400

    job_id = create_job(payload.urls, payload.words, payload.domains, payload.max_workers)
    return jsonify({'ok': True, 'job_id': job_id})


@url_finder_bp.route('/api/jobs/<job_id>', methods=['GET'])
def get_analysis_job(job_id):
    snapshot = get_job_snapshot(job_id)
    if snapshot is None:
        return jsonify({'ok': False, 'error': 'Job no encontrado.'}), 404
    return jsonify(snapshot)


@url_finder_bp.route('/api/analyze', methods=['POST'])
@url_finder_bp.route('/analyze', methods=['POST'])
def analyze():
    payload = parse_payload(safe_get_json())
    validation_error = _validate_payload(payload)
    if validation_error:
        return jsonify({'ok': False, 'status': 'error', 'error': validation_error}), 400

    return jsonify(analyze_urls(payload.urls, payload.words, payload.domains, payload.max_workers))


@url_finder_bp.route('/download', methods=['POST'])
def download():
    data = request.get_json(silent=True) or {}
    output = build_csv(data.get('results', []))
    return send_file(output, mimetype='text/csv', download_name='url_finder_results.csv', as_attachment=True)


def _validate_payload(payload) -> str | None:
    if not payload.urls:
        return 'Añade al menos una URL.'
    if not payload.words and not payload.domains:
        return 'Añade al menos una palabra o un dominio a buscar.'
    return None
