.PHONY: dev up down logs test lint typecheck

dev:
	uvicorn core_platform.main:app --reload --host 0.0.0.0 --port 8000

up:
	docker compose up -d --build

down:
	docker compose down -v

logs:
	docker compose logs -f

test:
	pytest -v --cov=core_platform --cov=aiops_shared

lint:
	ruff check .

typecheck:
	mypy core_platform/ aiops_shared/
