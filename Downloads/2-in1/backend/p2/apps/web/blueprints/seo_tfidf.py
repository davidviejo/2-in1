from collections import Counter
from datetime import datetime
from math import log
from threading import Lock
import re
import uuid

from flask import Blueprint, jsonify
from pydantic import ValidationError

from apps.models.seo_tfidf import (
    AddDocumentsRequest,
    AddDocumentsResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    ApiErrorResponse,
    CreateProjectRequest,
    CreateProjectResponse,
    ListProjectsResponse,
    ListRunsResponse,
    ProjectSummary,
    RunDetailResponse,
    TermScore,
)
from apps.tools.utils import safe_get_json

seo_tfidf_bp = Blueprint('seo_tfidf_bp', __name__, url_prefix='/api/seo/tfidf')
seo_tfidf_v1_bp = Blueprint('seo_tfidf_v1_bp', __name__, url_prefix='/api/v1/seo/tfidf')

_WORD_RE = re.compile(r"[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9]+")
_PROJECTS = {}
_RUNS = {}
_LOCK = Lock()
_MIN_CORPUS_DOCS = 2


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat() + 'Z'


def _error_response(message: str, status_code: int = 400, details=None):
    payload = ApiErrorResponse(error=message, details=details)
    return jsonify(payload.model_dump(exclude_none=True)), status_code


def _parse_or_400(schema_cls, payload):
    try:
        return schema_cls.model_validate(payload), None
    except ValidationError as exc:
        return None, _error_response('Payload inválido.', 400, exc.errors())


def _tokenize(text: str):
    return [match.group(0).lower() for match in _WORD_RE.finditer(text or '')]


def _compute_tfidf(documents):
    tokenized_docs = [_tokenize(doc.get('content', '')) for doc in documents]
    total_docs = len(tokenized_docs)
    if total_docs == 0:
        return []

    doc_freq = Counter()
    for tokens in tokenized_docs:
        doc_freq.update(set(tokens))

    analysis = []
    for index, doc in enumerate(documents):
        tokens = tokenized_docs[index]
        if not tokens:
            analysis.append({
                'document_id': doc['id'],
                'top_terms': [],
                'token_count': 0,
            })
            continue

        term_freq = Counter(tokens)
        token_count = len(tokens)
        scores = []
        for term, freq in term_freq.items():
            tf = freq / token_count
            idf = log((1 + total_docs) / (1 + doc_freq[term])) + 1
            score = tf * idf
            scores.append({
                'term': term,
                'tf': round(tf, 6),
                'idf': round(idf, 6),
                'score': round(score, 6),
                'frequency': freq,
            })

        scores.sort(key=lambda item: item['score'], reverse=True)
        analysis.append({
            'document_id': doc['id'],
            'token_count': token_count,
            'top_terms': scores[:25],
        })

    return analysis


def _extract_global_terms(analysis):
    term_scores = {}
    for doc in analysis:
        for term_entry in doc.get('top_terms', []):
            term = term_entry['term']
            current = term_scores.get(term)
            if current is None or term_entry['score'] > current['score']:
                term_scores[term] = term_entry

    top_terms = sorted(term_scores.values(), key=lambda item: item['score'], reverse=True)[:20]
    return [TermScore.model_validate(item).model_dump() for item in top_terms]


@seo_tfidf_bp.route('/projects', methods=['POST'])
@seo_tfidf_v1_bp.route('/projects', methods=['POST'])
def create_project():
    payload = safe_get_json()
    request_model, error = _parse_or_400(CreateProjectRequest, payload)
    if error:
        return error

    name = request_model.name.strip() or 'Untitled TF-IDF Project'

    project_id = str(uuid.uuid4())
    now = _utc_now_iso()
    project = {
        'id': project_id,
        'name': name,
        'created_at': now,
        'updated_at': now,
        'documents': [],
        'runs': [],
    }

    with _LOCK:
        _PROJECTS[project_id] = project

    response = CreateProjectResponse.model_validate(project)
    return jsonify(response.model_dump()), 201


@seo_tfidf_bp.route('/projects/<project_id>/documents', methods=['POST'])
@seo_tfidf_v1_bp.route('/projects/<project_id>/documents', methods=['POST'])
def add_documents(project_id):
    payload = safe_get_json()
    request_model, error = _parse_or_400(AddDocumentsRequest, payload)
    if error:
        return error

    with _LOCK:
        project = _PROJECTS.get(project_id)
        if not project:
            return _error_response('Proyecto no encontrado.', 404)

        inserted = []
        for entry in request_model.documents:
            content = entry.content.strip()
            if not content:
                continue

            document = {
                'id': str(uuid.uuid4()),
                'title': entry.title.strip() or 'Documento sin título',
                'content': content,
                'created_at': _utc_now_iso(),
            }
            project['documents'].append(document)
            inserted.append(document)

        project['updated_at'] = _utc_now_iso()

    response = AddDocumentsResponse(project_id=project_id, inserted=inserted, count=len(inserted))
    return jsonify(response.model_dump()), 201


@seo_tfidf_bp.route('/projects/<project_id>/analyze', methods=['POST'])
@seo_tfidf_v1_bp.route('/projects/<project_id>/analyze', methods=['POST'])
def analyze_project(project_id):
    payload = safe_get_json()
    request_model, error = _parse_or_400(AnalyzeRequest, payload)
    if error:
        return error

    with _LOCK:
        project = _PROJECTS.get(project_id)
        if not project:
            return _error_response('Proyecto no encontrado.', 404)

        if len(project['documents']) < _MIN_CORPUS_DOCS:
            return _error_response(
                f'Corpus insuficiente: necesitas al menos {_MIN_CORPUS_DOCS} documentos para analizar.',
                400,
            )

        run_id = str(uuid.uuid4())
        analysis = _compute_tfidf(project['documents'])
        terms = _extract_global_terms(analysis)

        result = {
            'run_id': run_id,
            'project_id': project_id,
            'status': 'completed',
            'created_at': _utc_now_iso(),
            'documents_analyzed': len(project['documents']),
            'summary': f'Análisis TF-IDF completado para {len(project["documents"])} documentos.',
            'recommendations': [
                'Prioriza los términos con mayor score en títulos y encabezados.',
                'Compara la cobertura semántica de target_url frente a reference_urls.',
                'Repite el análisis tras actualizar contenido para medir mejora semántica.',
            ],
            'terms': terms,
            'analysis': analysis,
            'target_url': str(request_model.target_url),
            'reference_urls': [str(url) for url in request_model.reference_urls],
            'config': request_model.config.model_dump(),
        }
        _RUNS[run_id] = result
        project['runs'].append(run_id)
        project['updated_at'] = _utc_now_iso()

    response = AnalyzeResponse.model_validate(result)
    return jsonify(response.model_dump()), 202


@seo_tfidf_bp.route('/runs/<run_id>', methods=['GET'])
@seo_tfidf_v1_bp.route('/runs/<run_id>', methods=['GET'])
def get_run(run_id):
    with _LOCK:
        run = _RUNS.get(run_id)

    if not run:
        return _error_response('Run no encontrado.', 404)

    response = RunDetailResponse.model_validate(run)
    return jsonify(response.model_dump())


@seo_tfidf_bp.route('/projects', methods=['GET'])
@seo_tfidf_v1_bp.route('/projects', methods=['GET'])
def list_projects():
    with _LOCK:
        projects = [
            ProjectSummary(
                id=project['id'],
                name=project['name'],
                created_at=project['created_at'],
                updated_at=project['updated_at'],
                documents_count=len(project['documents']),
                runs_count=len(project['runs']),
            ).model_dump()
            for project in _PROJECTS.values()
        ]

    response = ListProjectsResponse(projects=projects, count=len(projects))
    return jsonify(response.model_dump())


@seo_tfidf_bp.route('/projects/<project_id>/runs', methods=['GET'])
@seo_tfidf_v1_bp.route('/projects/<project_id>/runs', methods=['GET'])
def list_project_runs(project_id):
    with _LOCK:
        project = _PROJECTS.get(project_id)
        if not project:
            return _error_response('Proyecto no encontrado.', 404)

        runs = [RunDetailResponse.model_validate(_RUNS[run_id]).model_dump() for run_id in project['runs'] if run_id in _RUNS]

    response = ListRunsResponse(project_id=project_id, runs=runs, count=len(runs))
    return jsonify(response.model_dump())
