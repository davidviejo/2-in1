.PHONY: install run test clean bootstrap-auth

install:
	pip install -r requirements.txt

run:
	python run.py

test:
	pytest

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

bootstrap-auth:
	python scripts/bootstrap_auth.py
