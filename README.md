# Next-Gen AiOps Monitoring Demo

A comprehensive demo platform showcasing Next-Gen AiOps monitoring capabilities:
- **Multiple simulated services** emitting realistic OTel telemetry
- **CMDB with Service Mapping** (PostgreSQL + recursive CTEs)
- **Agent/LLM monitoring** (token usage, model health, cost tracking)
- **Root Cause Analysis** (automated correlation + LLM explanation)
- **ChatBot with Human Approval** (LangGraph agent + approval queue)
- **NOC Alert Console** (alert table with acknowledge/resolve)
- **Service Health Dashboard** (RED metrics, topology graph)
- **Nice UI** (React + TypeScript + Tailwind + Preline UI)

## Quick Start

```bash
# Clone and setup
git clone <repo>
cd nextgen-aiops

# Start everything
make setup

# Or step by step:
make up                    # Start Docker Compose
make ollama-pull           # Download LLM models
make seed                  # Seed CMDB with demo data

# Access:
# UI:          http://localhost:80
# Grafana:     http://localhost:3000 (admin/admin)
# API:         http://localhost:8000
# API Docs:    http://localhost:8000/docs
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Database | PostgreSQL 16 (CMDB), Redis 7 (cache/queue) |
| Observability | otel-lgtm (Grafana, Loki, Tempo, Mimir, OTel Collector) |
| LLM | Ollama (Llama 3.1 8B, Qwen2.5 7B) |
| Agent | LangGraph with interrupt-based approval |
| UI | React 18, TypeScript 5, Tailwind CSS 3, Preline UI |
| Build | Vite (UI), Docker Compose (all services) |
| CI | GitHub Actions (ruff, mypy, pytest) |

## Project Skills

Installed skills under `.claude/skills/`:
- grill-me
- aiops-architect
- fullstack-api
- qa-test-engineer
- devops-observability
- docs-writer
