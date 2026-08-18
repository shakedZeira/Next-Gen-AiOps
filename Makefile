.PHONY: dev up down logs test lint typecheck seed ollama-pull setup

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

seed:
	python db/seed.py

ollama-pull:
	docker compose exec ollama ollama pull llama3.1:8b
	docker compose exec ollama ollama pull qwen2.5:7b

setup: up ollama-pull seed
	@echo "Setup complete! Access Grafana at http://localhost:3000 and UI at http://localhost:80"