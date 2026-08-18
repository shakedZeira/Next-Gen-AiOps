# Next-Gen AiOps Monitoring Demo — Master Project Plan

## Overview

A comprehensive demo platform showcasing Next-Gen AiOps monitoring capabilities:
- **Multiple simulated services** emitting realistic OTel telemetry
- **CMDB with Service Mapping** (PostgreSQL + recursive CTEs)
- **Agent/LLM monitoring** (token usage, model health, cost tracking)
- **Root Cause Analysis** (automated correlation + LLM explanation)
- **ChatBot with Human Approval** (LangGraph agent + approval queue)
- **NOC Alert Console** (alert table with acknowledge/resolve)
- **Service Health Dashboard** (RED metrics, topology graph)
- **Nice UI** (React + TypeScript + Tailwind + Preline UI)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React UI (nginx:80)                   │
│  Dashboard │ Alerts │ ChatBot │ CMDB │ Agent Monitor    │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│              Core Platform (FastAPI:8000)                │
│  API Gateway │ Auth (JWT) │ CMDB │ OTel Ingestion      │
└────┬────────┬────────┬────────┬────────┬────────────────┘
     │        │        │        │        │
┌────▼──┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌─▼──────┐
│Gener- │ │Agent │ │ RCA  │ │Chat- │ │Alert/  │
│ator   │ │Monit.│ │Engine│ │Bot   │ │NOC     │
│:8001  │ │:8002 │ │:8003 │ │:8004 │ │:8005   │
└───┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └───┬────┘
    │        │        │        │         │
    └────────┴────────┴────────┴─────────┘
                    │ OTLP
    ┌───────────────▼───────────────────┐
    │     otel-lgtm (Docker)            │
    │  OTel Collector → Loki/Tempo/Mimir│
    └───────────────┬───────────────────┘
                    │
              ┌─────▼─────┐
              │  Grafana   │
              │  :3000     │
              └────────────┘
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

## Implementation Plan Structure

The plan is split into **3 parts** with **20 tasks**, organized for **parallel subagent execution**:

| Part | File | Tasks | Description | Status |
|------|------|-------|-------------|--------|
| Part 1 | `2026-08-18-nextgen-aiops-part1-core.md` | 1-6 | Core Platform: scaffold, shared lib, DB, API, Auth, CMDB | ✅ COMPLETE |
| Part 2 | `2026-08-18-nextgen-aiops-part2-plugins.md` | 7-11 | Plugin Services: Generator, Agent Monitor, RCA, ChatBot, Alerts | ✅ COMPLETE |
| Part 3 | `2026-08-18-nextgen-aiops-part3-ui.md` | 12-20 | UI: React setup, pages, nginx, Docker Compose, CI | ✅ COMPLETE |

## Subagent Execution Strategy

This project uses **subagent-driven development** to maximize parallelism and keep context windows small. Each task is dispatched to a fresh subagent with isolated context.

### Progress

```
✅ Part 1 (Tasks 1-6): COMPLETE
   Commit a8efe56: chore: project scaffold with Docker Compose
   Commit 7972cf7: feat: add shared library with models, config, database, otel
   Commit 0384d5f: feat: PostgreSQL schema with CI, relationship, service tables
   Commit a4998e9: feat: core platform with API gateway, auth, JWT, RBAC
   Commit 9f0aa10: feat: CMDB service with CI, relationship, topology queries
   Commit 651b9df: feat: OTel ingestion config and CMDB seed data

✅ Part 2 (Tasks 7-11): COMPLETE
   Commit 51baa66: feat: synthetic generator service with OTel emission
   Commit 87dd4f5: feat: agent monitor service with LLM token/cost/latency tracking
   Commit fe9440a: feat: RCA engine with anomaly detection, correlation, LLM explanation
   Commit 0a2dd8e: feat: chatbot service with LangGraph agent and human approval flow
   Commit d1ca15d: feat: alert/NOC service with CRUD, acknowledge, resolve, grouping

✅ Part 3 (Tasks 12-20): COMPLETE
   Commit 0c705b9: feat: React UI setup with Vite, Tailwind, Preline, API client
   Commit 147c882: feat: layout with sidebar navigation and header
   Commit e7fc67e: feat: dashboard page with service health cards and topology graph
   Commit e884f61: feat: NOC alerts page with alert table, filtering, acknowledge/resolve
   Commit ae9f2b4: feat: chatbot page with conversation UI and approval queue
   Commit 6bfa9b8: feat: CMDB explorer page with topology graph and CI details
   Commit b62b893: feat: agent monitor page with token usage charts and model health table
   Commit 26d6cd3: feat: nginx config and final Docker Compose with all services
   Commit 7d4ded3: ci: GitHub Actions with ruff, mypy, pytest, and UI build
⏳ Part 3 (Tasks 12-20): PENDING
```

### Parallel Execution Groups

```
Group 0 (sequential):  Task 1 ──────────────────────────► ✅
Group 1 (parallel):   Task 2 ──┐                         ✅
                               Task 3 ──┘                 ✅
Group 2 (parallel):   Task 4 ──┐                         ✅
                               Task 6 ──┘                 ✅
Group 3 (parallel):   Task 5 ──────────────────────────► ✅
                                                         │
Group 4 (parallel):   Task 7  ──┐                       ✅
                               Task 8  ──┐               ✅
                               Task 9  ──┤               ✅
                               Task 10 ──┤               ✅
                               Task 11 ──┘               ✅
                                                         │
Group 5 (sequential): Task 12 ──────────────────────────► ✅
Group 6 (sequential): Task 13 ──────────────────────────► ✅
                                                         │
Group 7 (parallel):   Task 14 ──┐                       ✅
                               Task 15 ──┐               ✅
                               Task 16 ──┤               ✅
                               Task 17 ──┤               ✅
                               Task 18 ──┘               ✅
                                                         │
Group 8 (sequential): Task 19 ──────────────────────────► ✅
Group 9 (sequential): Task 20 ──────────────────────────► ✅
```

### Subagent Assignment per Task

| Task | Subagent Type | Parallel Group | Dependencies |
|------|--------------|----------------|--------------|
| 1 | general | 0 | — |
| 2 | general | 1 | Task 1 |
| 3 | general | 1 | Task 1 |
| 4 | general | 2 | Task 2 |
| 5 | general | 3 | Tasks 3, 4 |
| 6 | general | 2 | Task 3 |
| 7 | general | 4 | Task 1 |
| 8 | general | 4 | Task 1 |
| 9 | general | 4 | Task 1 |
| 10 | general | 4 | Task 1 |
| 11 | general | 4 | Task 1 |
| 12 | general | 5 | Part 2 complete |
| 13 | general | 6 | Task 12 |
| 14 | general | 7 | Task 13 |
| 15 | general | 7 | Task 13 |
| 16 | general | 7 | Task 13 |
| 17 | general | 7 | Task 13 |
| 18 | general | 7 | Task 13 |
| 19 | general | 8 | Tasks 14-18 |
| 20 | general | 9 | Task 19 |

### Why Subagents?

1. **Isolated Context**: Each subagent gets only its task + relevant interfaces, not the entire codebase
2. **Parallel Execution**: Independent tasks (plugins, UI pages) run simultaneously
3. **Fresh Eyes**: Each reviewer sees only the diff, not accumulated context
4. **Faster Iteration**: 5 parallel subagents > 1 sequential agent
5. **Smaller Context Windows**: Each subagent operates on ~2-5k tokens, not 100k+

### Execution Commands

```bash
# After creating plan files, execute with subagent-driven-development:
# 1. Dispatch Task 1 (project scaffold) - must complete first
# 2. After Task 1, dispatch Tasks 2+3 in parallel
# 3. After Tasks 2+3, dispatch Tasks 4+5+6 in parallel
# 4. After all Part 1 tasks, dispatch Tasks 7-11 in parallel
# 5. Continue with Part 3...

# Or execute inline:
# Use executing-plans skill to batch execute with checkpoints
```

## Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| otel-lgtm | 3000, 9090, 3100, 3200, 4317, 4318 | Grafana, Prometheus, Loki, Tempo, OTel Collector |
| postgres | 5432 | CMDB database |
| redis | 6379 | Cache and alert queue |
| ollama | 11434 | Local LLM (Llama 3.1, Qwen2.5) |
| api-gateway | 8000 | Core Platform (FastAPI) |
| generator | 8001 | Synthetic telemetry generator |
| agent-monitor | 8002 | LLM token/cost monitoring |
| rca-engine | 8003 | Root cause analysis |
| chatbot | 8004 | AiOps assistant with approval |
| alert-noc | 8005 | NOC alert console |
| ui | 80 | React dashboard (nginx) |

## Key Design Decisions

1. **Hybrid Platform + Plugins**: Core provides shared services (Auth, CMDB, OTel), plugins are independent microservices
2. **PostgreSQL Recursive CTEs**: Graph queries without external graph DB (simpler deployment)
3. **OTel-LGTM**: Single Docker image for full observability stack (Grafana, Loki, Tempo, Mimir)
4. **LangGraph Interrupts**: Human approval via interrupt pattern (pause → approve → resume)
5. **Preline UI**: Pre-built components (640+) with zero JS dependency, Tailwind native
6. **Ollama**: Free local LLM (no API costs for demo)
7. **Synthetic Generators**: Configurable services emitting realistic telemetry patterns

## Files Created

```
nextgen-aiops/
├── docs/superpowers/
│   ├── specs/
│   │   └── 2026-08-18-nextgen-aiops-design.md
│   └── plans/
│       ├── 2026-08-18-nextgen-aiops-part1-core.md
│       ├── 2026-08-18-nextgen-aiops-part2-plugins.md
│       └── 2026-08-18-nextgen-aiops-part3-ui.md
├── Project_plan.md (this file)
├── pyproject.toml
├── docker-compose.yml
├── Makefile
├── .env.example
├── .gitignore
├── .pre-commit-config.yaml
├── .github/workflows/ci.yml
├── Dockerfile.core
├── aiops_shared/
│   ├── __init__.py
│   ├── config.py
│   ├── database.py
│   ├── exceptions.py
│   ├── models/
│   │   ├── ci.py
│   │   ├── relationship.py
│   │   ├── service.py
│   │   ├── service_ci.py
│   │   ├── user.py
│   │   └── alert.py
│   └── otel/
│       ├── __init__.py
│       └── instrumentation.py
├── core_platform/
│   ├── __init__.py
│   ├── main.py
│   ├── dependencies.py
│   ├── auth/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── dependencies.py
│   │   └── schemas.py
│   ├── cmdb/
│   │   ├── repository.py
│   │   └── schemas.py
│   └── routers/
│       ├── health.py
│       └── cmdb.py
├── db/
│   ├── init.sql
│   ├── seed.py
│   └── migrations/
├── otel-lgtm/config/
│   └── otelcol-config.yaml
├── plugins/
│   ├── generator/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── otel_emitter.py
│   │   ├── topology.py
│   │   └── Dockerfile
│   ├── agent_monitor/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── metrics_collector.py
│   │   ├── models.py
│   │   ├── router.py
│   │   └── Dockerfile
│   ├── rca_engine/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── anomaly_detector.py
│   │   ├── correlation.py
│   │   ├── llm_explainer.py
│   │   ├── router.py
│   │   └── Dockerfile
│   ├── chatbot/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── agent.py
│   │   ├── tools.py
│   │   ├── approval.py
│   │   ├── router.py
│   │   └── Dockerfile
│   └── alert_noc/
│       ├── main.py
│       ├── config.py
│       ├── models.py
│       ├── store.py
│       ├── router.py
│       └── Dockerfile
├── ui/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── nginx.conf
│   ├── Dockerfile
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts
│       ├── types/
│       │   └── index.ts
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── Sidebar.tsx
│       │   ├── Header.tsx
│       │   ├── ServiceHealthCard.tsx
│       │   ├── TopologyGraph.tsx
│       │   ├── AlertTable.tsx
│       │   ├── ApprovalQueue.tsx
│       │   └── TokenUsageChart.tsx
│       └── pages/
│           ├── Dashboard.tsx
│           ├── NOCAlerts.tsx
│           ├── ChatBot.tsx
│           ├── CMDBExplorer.tsx
│           └── AgentMonitor.tsx
└── tests/
    ├── test_auth.py
    ├── test_cmdb.py
    ├── test_generator.py
    ├── test_agent_monitor.py
    ├── test_rca.py
    ├── test_chatbot.py
    └── test_alert_noc.py
```

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

## Demo Flow

1. **Login** to UI as admin@aiops.local / admin123
2. **Dashboard**: See service health cards (some degraded), topology graph
3. **NOC Alerts**: View active alerts, acknowledge/resolve
4. **CMDB Explorer**: Browse CIs, view topology, inspect dependencies
5. **Agent Monitor**: See token usage charts, model health table
6. **ChatBot**: Ask about alerts/metrics/logs, approve remediation actions
7. **Grafana**: Deep-dive into metrics, logs, traces via LGTM stack
