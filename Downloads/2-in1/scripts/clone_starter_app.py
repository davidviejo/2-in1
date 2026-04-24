#!/usr/bin/env python3
"""Clona el starter de apps independientes y parametriza nombre/id/puerto."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / "apps-independientes" / "_templates" / "starter-app"
APPS_DIR = ROOT / "apps-independientes"

TOKEN_MAP = {
    "__APP_NAME__": "name",
    "__APP_ID__": "app_id",
    "__APP_SLUG__": "slug",
    "__PORT__": "port",
}

TEXT_FILE_EXTENSIONS = {
    ".json",
    ".md",
    ".tsx",
    ".ts",
    ".js",
    ".mjs",
    ".cjs",
    ".env",
    ".example",
    ".yml",
    ".yaml",
    ".txt",
    ".d.ts",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Clona apps-independientes/_templates/starter-app y parametriza placeholders."
    )
    parser.add_argument("--name", required=True, help="Nombre visible de la app")
    parser.add_argument("--id", required=True, dest="app_id", help="ID único del manifest")
    parser.add_argument("--slug", required=True, help="Nombre de carpeta destino en apps-independientes")
    parser.add_argument("--port", required=True, type=int, help="Puerto local de desarrollo")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Sobrescribe la carpeta destino si ya existe",
    )
    return parser.parse_args()


def validate_inputs(slug: str, app_id: str, port: int) -> None:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
        raise ValueError("--slug debe usar kebab-case: letras minúsculas, números y guiones.")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-_]*", app_id):
        raise ValueError("--id solo permite minúsculas, números, guion y guion bajo.")
    if not (1024 <= port <= 65535):
        raise ValueError("--port debe estar entre 1024 y 65535.")


def should_treat_as_text(path: Path) -> bool:
    return path.suffix in TEXT_FILE_EXTENSIONS or path.name in {".env.example", "README"}


def replace_tokens(text: str, values: dict[str, str]) -> str:
    result = text
    for token, key in TOKEN_MAP.items():
        result = result.replace(token, str(values[key]))
    return result


def scaffold_app(name: str, app_id: str, slug: str, port: int, force: bool) -> Path:
    if not TEMPLATE_DIR.exists():
        raise FileNotFoundError(f"No existe el template: {TEMPLATE_DIR}")

    destination = APPS_DIR / slug
    if destination.exists():
        if force:
            shutil.rmtree(destination)
        else:
            raise FileExistsError(
                f"La carpeta destino ya existe: {destination}. Usa --force para sobrescribir."
            )

    shutil.copytree(TEMPLATE_DIR, destination)

    values = {
        "name": name,
        "app_id": app_id,
        "slug": slug,
        "port": str(port),
    }

    for file_path in destination.rglob("*"):
        if file_path.is_dir() or not should_treat_as_text(file_path):
            continue

        original = file_path.read_text(encoding="utf-8")
        updated = replace_tokens(original, values)
        if updated != original:
            file_path.write_text(updated, encoding="utf-8")

    # Validación rápida: asegurar que app.manifest.json resultante parsea.
    manifest_path = destination / "app.manifest.json"
    json.loads(manifest_path.read_text(encoding="utf-8"))
    return destination


def main() -> None:
    args = parse_args()
    validate_inputs(slug=args.slug, app_id=args.app_id, port=args.port)
    destination = scaffold_app(
        name=args.name,
        app_id=args.app_id,
        slug=args.slug,
        port=args.port,
        force=args.force,
    )
    print(f"✅ Starter clonado en: {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
