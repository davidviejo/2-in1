from __future__ import annotations

from copy import deepcopy

TEMPLATE_VERSION = "2026.04.1"

_BASE_MODULES = [
    {
        "id": 1,
        "title": "Auditoría Inicial",
        "subtitle": "Diagnóstico Técnico & Contenidos",
        "levelRange": "0-20",
        "description": "Evaluación inicial de estado SEO técnico y de contenidos.",
        "iconName": "Search",
        "tasks": [
            {
                "id": "m1-1",
                "title": "Verificar indexación",
                "description": "Revisar robots.txt, sitemap y cobertura básica.",
                "impact": "High",
                "status": "pending",
                "category": "Technical",
            }
        ],
    },
    {
        "id": 2,
        "title": "Estrategia",
        "subtitle": "Objetivos y verticales",
        "levelRange": "20-40",
        "description": "Definición de objetivos, verticales y oportunidades.",
        "iconName": "Layers",
        "tasks": [
            {
                "id": "m2-1",
                "title": "Definir verticales temáticos",
                "description": "Alinear pilares editoriales y foco de negocio.",
                "impact": "High",
                "status": "pending",
                "category": "Strategy",
            }
        ],
    },
    {
        "id": 8,
        "title": "Extras",
        "subtitle": "Optimizaciones complementarias",
        "levelRange": "75-95",
        "description": "Checklist adicional para mejoras iterativas.",
        "iconName": "Zap",
        "tasks": [],
    },
    {
        "id": 9,
        "title": "MIA: Fichas de IA",
        "subtitle": "Sugerencias Artificiales",
        "levelRange": "N/A",
        "description": "Espacio para fichas de IA.",
        "iconName": "Bot",
        "tasks": [],
    },
]

_TEMPLATE_METADATA = {
    "owner": "backend",
    "changelog": [
        {
            "version": TEMPLATE_VERSION,
            "date": "2026-04-07",
            "notes": "Versionado inicial centralizado de plantillas por vertical.",
        }
    ],
}

_VERTICALS = ("media", "ecom", "local", "national", "international")


def get_template_catalog() -> dict:
    templates = {}
    for vertical in _VERTICALS:
        templates[vertical] = {
            "vertical": vertical,
            "version": TEMPLATE_VERSION,
            "metadata": {
                **_TEMPLATE_METADATA,
                "taskCount": sum(len(m["tasks"]) for m in _BASE_MODULES),
                "moduleCount": len(_BASE_MODULES),
            },
            "modules": deepcopy(_BASE_MODULES),
        }

    return {"version": TEMPLATE_VERSION, "templates": templates}
