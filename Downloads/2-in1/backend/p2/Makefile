.PHONY: install run test lint format typecheck quality clean bootstrap-auth

install:
	pip install -r requirements.txt

run:
	python run.py

test:
	pytest tests/quality

lint:
	ruff check run.py apps/core apps/web/blueprints/api_engine

format:
	ruff format run.py apps/core apps/web/blueprints/api_engine

typecheck:
	mypy run.py

quality: lint typecheck test

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

bootstrap-auth:
	python scripts/bootstrap_auth.py
