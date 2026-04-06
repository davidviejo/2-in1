.PHONY: install run test clean

install:
	pip install -r requirements.txt

run:
	python run.py

test:
	pytest

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
