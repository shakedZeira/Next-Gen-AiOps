# Next-Gen AiOps Monitoring Demo

A comprehensive demo platform showcasing Next-Gen AiOps monitoring capabilities:
- **Multiple simulated services** emitting realistic OTel telemetry
- **CMDB with Service Mapping** (PostgreSQL + recursive CTEs)
- **Agent/LLM monitoring** (token usage, model health, cost tracking)
- **Root Cause Analysis** (automated correlation + LLM explanation)
- **ChatBot with Human Approval** (LangGraph agent + approval queue)
- **NOC Alert Console** (alert table with acknowledge/resolve)
- **SSO** (Google Sign-In via OAuth 2.0 + PKCE, DB-backed users, admin allowlist)
- **Service Health Dashboard** (RED metrics, topology graph)
- **Nice UI** (React + TypeScript + Tailwind + Preline UI)

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with **Docker Compose v2**
- `make` (optional — mirrors the `docker compose` commands below)
- Ports `80`, `443`, `3000`, `5432`, `6379`, `8000`, `8004`, `8013`-`8023`, `9090`, `3100`, `3200`, `4317`, `4318`, `11434`, `1514/1515`, `1162` must be free

## Quick Start

```bash
# 1. Clone and setup
git clone <repo>
cd nextgen-aiops

# 2. (Optional) Configuration — copy and edit defaults:
cp .env.example .env

# 3. Build and start all services in the background
docker compose up -d

# 4. (Optional) Pull the LLM models used by RCA/ChatBot:
make ollama-pull
# 5. (Optional) Seed the CMDB with demo data (DB auto-inits on first boot):
make seed
```

> The `docker compose up -d` command builds any images that don't exist yet and
> starts all services (PostgreSQL, Redis, otel-lgtm/Grafana, Ollama, the FastAPI
> gateway, UI, and all plugin services). First boot pulls several large images
> (Otel LGTM, Ollama, Postgres) and can take a few minutes.

### Makefile shortcuts

Equivalent to the commands above, the included `Makefile` provides:

| Command | What it does |
|---------|--------------|
| `make up` | `docker compose up -d --build` |
| `make down` | `docker compose down -v` |
| `make logs` | `docker compose logs -f` |
| `make ollama-pull` | Download Llama 3.1 8B + Qwen2.5 7B into Ollama |
| `make seed` | Seed CMDB with demo data |
| `make setup` | `make up` + `ollama-pull` + `seed` |

### Access

| Service | URL | Credentials |
|---------|-----|-------------|
| UI | http://localhost:80 | — |
| Grafana (otel-lgtm) | http://localhost:3000 | admin / admin |
| API | http://localhost:8000 | — |
| API Docs (Swagger) | http://localhost:8000/docs | — |
| ChatBot | http://localhost:8004 | — |

### Stopping and cleanup

```bash
docker compose down      # stop services (keeps volumes)
docker compose down -v   # stop and delete volumes/data (full reset)
```

### Configuration

Optional environment variables live in `.env` (see `.env.example`). Main ones:

- `REDIS_PASSWORD` — Redis password (default: `changeme`)
- `JWT_SECRET` — gateway/plugin JWT signing secret (dev default set in compose)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — enable Google SSO (empty = SSO disabled)
- `SSO_ADMIN_EMAILS` — comma-separated emails granted admin on first SSO sign-in

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
