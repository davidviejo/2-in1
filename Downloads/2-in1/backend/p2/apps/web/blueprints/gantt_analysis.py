from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Any

from flask import Blueprint, jsonify, request


gantt_bp = Blueprint('gantt_analysis', __name__)


def _parse_date(raw: Any) -> date | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


@gantt_bp.route('/api/gantt/analyze', methods=['POST'])
def analyze_gantt():
    payload = request.get_json(silent=True) or {}
    tasks = payload.get('tasks')
    if not isinstance(tasks, list) or not tasks:
        return jsonify({'error': 'Debes enviar un array no vacío en "tasks".'}), 400

    status_counter: Counter[str] = Counter()
    overdue_tasks: list[dict[str, Any]] = []
    upcoming_tasks: list[dict[str, Any]] = []

    today = date.today()

    for task in tasks:
        if not isinstance(task, dict):
            continue
        title = str(task.get('title') or 'Tarea sin título')
        status = str(task.get('status') or 'pending')
        progress = int(task.get('progress') or 0)
        end_date = _parse_date(task.get('endDate'))

        status_counter[status] += 1

        if end_date and end_date < today and progress < 100:
            overdue_tasks.append({'title': title, 'endDate': end_date.isoformat(), 'progress': progress})
        elif end_date and today <= end_date <= date.fromordinal(today.toordinal() + 7):
            upcoming_tasks.append({'title': title, 'endDate': end_date.isoformat(), 'progress': progress})

    completion = round(
        sum(int(task.get('progress') or 0) for task in tasks if isinstance(task, dict)) / max(len(tasks), 1),
        2,
    )

    recommendations: list[str] = []
    if overdue_tasks:
        recommendations.append('Reasignar responsables para las tareas vencidas y definir bloqueadores.')
    if completion < 50:
        recommendations.append('El avance global es bajo: prioriza hitos críticos del sprint actual.')
    if not recommendations:
        recommendations.append('El cronograma está saludable. Mantén la cadencia de seguimiento semanal.')

    return jsonify(
        {
            'summary': {
                'totalTasks': len(tasks),
                'completionAvg': completion,
                'statusBreakdown': dict(status_counter),
                'overdueCount': len(overdue_tasks),
                'upcomingWeekCount': len(upcoming_tasks),
            },
            'overdueTasks': overdue_tasks,
            'upcomingTasks': upcoming_tasks,
            'recommendations': recommendations,
        }
    )
