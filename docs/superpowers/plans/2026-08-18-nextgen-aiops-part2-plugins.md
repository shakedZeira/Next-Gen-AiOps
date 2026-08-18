# Next-Gen AiOps — Part 2: Plugin Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 5 Plugin Services: Synthetic Generator, Agent Monitor, RCA Engine, ChatBot, and Alert/NOC.

**Architecture:** Each plugin is a standalone FastAPI microservice that registers with the Core Platform, shares OTel instrumentation, and uses CMDB for topology. Communication via REST + async Redis events.

**Tech Stack:** FastAPI, OpenTelemetry SDK, LangGraph, Ollama client, Prometheus client, Redis, SQLAlchemy async

**Spec:** `docs/superpowers/specs/2026-08-18-nextgen-aiops-design.md`

---

## Global Constraints

- Python 3.11+, FastAPI 0.110+, Pydantic v2
- OpenTelemetry Python SDK 1.25+ with GenAI semantic conventions
- All telemetry via OTLP to otel-lgtm collector (port 4318 HTTP)
- PostgreSQL recursive CTEs for graph queries
- Docker Compose v2, all services health-checked
- Shared Python library: `aiops_shared/` package

---

## Task 7: Synthetic Generator Service

**Files:**
- Create: `plugins/generator/main.py`
- Create: `plugins/generator/config.py`
- Create: `plugins/generator/otel_emitter.py`
- Create: `plugins/generator/topology.py`
- Create: `plugins/generator/scenarios.py`
- Create: `plugins/generator/Dockerfile`
- Test: `tests/test_generator.py`

**Subagent:** `general` — generator service

**Interfaces:**
- Consumes: OTel SDK (OTLP exporter), Redis for config
- Produces: Synthetic logs, metrics, traces via OTLP to otel-lgtm

- [ ] **Step 1: Create plugins/generator/config.py**

```python
from pydantic_settings import BaseSettings


class GeneratorConfig(BaseSettings):
    SERVICE_COUNT: int = 5
    ERROR_RATE: float = 0.05
    LATENCY_MEAN_MS: int = 100
    LATENCY_STDDEV_MS: int = 30
    TRANSACTIONS_PER_MIN: int = 60
    EMIT_INTERVAL_S: float = 5.0
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://otel-lgtm:4318"

    model_config = {"env_file": ".env"}
```

- [ ] **Step 2: Create plugins/generator/topology.py**

```python
from dataclasses import dataclass, field


@dataclass
class SimulatedService:
    name: str
    type: str  # web, api, db, cache, queue
    error_rate: float = 0.01
    latency_mean_ms: int = 50
    latency_stddev_ms: int = 10
    dependencies: list[str] = field(default_factory=list)


DEFAULT_TOPOLOGY = [
    SimulatedService("ecommerce-web", "web", error_rate=0.02, latency_mean_ms=80, dependencies=["ecommerce-api"]),
    SimulatedService("ecommerce-api", "api", error_rate=0.03, latency_mean_ms=120, dependencies=["payments-api", "inventory-api", "redis-cache"]),
    SimulatedService("payments-api", "api", error_rate=0.05, latency_mean_ms=200, dependencies=["postgres-payments"]),
    SimulatedService("inventory-api", "api", error_rate=0.02, latency_mean_ms=100, dependencies=["postgres-inventory"]),
    SimulatedService("postgres-payments", "db", error_rate=0.01, latency_mean_ms=30),
    SimulatedService("postgres-inventory", "db", error_rate=0.01, latency_mean_ms=25),
    SimulatedService("redis-cache", "cache", error_rate=0.005, latency_mean_ms=5),
    SimulatedService("kafka-broker", "queue", error_rate=0.01, latency_mean_ms=10),
    SimulatedService("notification-svc", "api", error_rate=0.02, latency_mean_ms=150, dependencies=["kafka-broker"]),
]
```

- [ ] **Step 3: Create plugins/generator/otel_emitter.py**

```python
import random
import time
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, OTLPSpanExporter
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader, OTLPMetricExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

HTTPXClientInstrumentor().instrument()


def init_emitter(service_name: str, endpoint: str):
    resource = Resource.create({SERVICE_NAME: service_name})

    span_exporter = OTLPSpanExporter(endpoint=endpoint)
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
    trace.set_tracer_provider(tracer_provider)

    metric_exporter = OTLPMetricExporter(endpoint=endpoint)
    reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=10000)
    meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
    metrics.set_meter_provider(meter_provider)

    return trace.get_tracer(service_name), metrics.get_meter(service_name)


def emit_transaction(tracer, meter, service_name: str, latency_mean: int, error_rate: float):
    request_counter = meter.create_counter("http.server.requests", description="Total HTTP requests")
    latency_histogram = meter.create_histogram("http.server.duration", description="Request latency", unit="ms")
    error_counter = meter.create_counter("http.server.errors", description="Total errors")

    start = time.time()
    is_error = random.random() < error_rate
    status_code = 500 if is_error else 200

    with tracer.start_as_current_span(f"HTTP GET /{service_name}/api/v1/data") as span:
        latency = max(1, random.gauss(latency_mean, latency_mean * 0.3))
        time.sleep(latency / 1000)

        span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, status_code)
        span.set_attribute(SpanAttributes.HTTP_METHOD, "GET")
        span.set_attribute("service.name", service_name)

        if is_error:
            span.set_status(trace.StatusCode.ERROR, "Simulated error")
            span.record_exception(Exception(f"Simulated error in {service_name}"))

        request_counter.add(1, {"service.name": service_name, "http.status_code": str(status_code)})
        latency_histogram.record(latency, {"service.name": service_name})
        if is_error:
            error_counter.add(1, {"service.name": service_name, "error.type": "simulated"})

    return {"service": service_name, "status": status_code, "latency_ms": latency, "error": is_error}
```

- [ ] **Step 4: Create plugins/generator/main.py**

```python
import asyncio
import random
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from plugins.generator.config import GeneratorConfig
from plugins.generator.topology import DEFAULT_TOPOLOGY
from plugins.generator.otel_emitter import init_emitter, emit_transaction

logger = logging.getLogger(__name__)
config = GeneratorConfig()
running = False


async def generation_loop():
    global running
    running = True
    tracer, meter = init_emitter("synthetic-generator", config.OTEL_EXPORTER_OTLP_ENDPOINT)
    logger.info("Starting synthetic generation with %d services", len(DEFAULT_TOPOLOGY))
    while running:
        for svc in DEFAULT_TOPOLOGY:
            result = emit_transaction(tracer, meter, svc.name, svc.latency_mean_ms, svc.error_rate)
            if result["error"]:
                logger.warning("Error in %s: status=%d", svc.name, result["status"])
        await asyncio.sleep(config.EMIT_INTERVAL_S)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(generation_loop())
    yield
    global running
    running = False
    task.cancel()


app = FastAPI(title="Synthetic Generator", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy", "services": len(DEFAULT_TOPOLOGY)}


@app.get("/status")
async def status():
    return {"running": running, "service_count": len(DEFAULT_TOPOLOGY), "error_rate": config.ERROR_RATE}
```

- [ ] **Step 5: Create plugins/generator/Dockerfile**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/generator/ plugins/generator/
CMD ["uvicorn", "plugins.generator.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

- [ ] **Step 6: Create test and run it**

```python
# tests/test_generator.py
from httpx import AsyncClient
from plugins.generator.main import app


async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


async def test_status():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/status")
        assert resp.status_code == 200
        assert "service_count" in resp.json()
```

- [ ] **Step 7: Commit**

```bash
git add plugins/generator/ tests/test_generator.py
git commit -m "feat: synthetic generator service with OTel emission"
```

---

## Task 8: Agent Monitor Service

**Files:**
- Create: `plugins/agent_monitor/main.py`
- Create: `plugins/agent_monitor/config.py`
- Create: `plugins/agent_monitor/metrics_collector.py`
- Create: `plugins/agent_monitor/models.py`
- Create: `plugins/agent_monitor/router.py`
- Create: `plugins/agent_monitor/Dockerfile`
- Test: `tests/test_agent_monitor.py`

**Subagent:** `general` — agent monitor

**Interfaces:**
- Consumes: OTel SDK (OTLP exporter), Prometheus metrics
- Produces: `/api/v1/agent-monitor/*` endpoints, LLM token/cost/latency metrics

- [ ] **Step 1: Create plugins/agent_monitor/config.py**

```python
from pydantic_settings import BaseSettings


class AgentMonitorConfig(BaseSettings):
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://otel-lgtm:4318"
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    MODEL_NAME: str = "llama3.1:8b"
    SIMULATE_TRAFFIC: bool = True
    TRAFFIC_INTERVAL_S: float = 10.0

    model_config = {"env_file": ".env"}
```

- [ ] **Step 2: Create plugins/agent_monitor/models.py**

```python
from pydantic import BaseModel
from datetime import datetime


class LLMRequest(BaseModel):
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: float
    cost_usd: float
    success: bool
    timestamp: datetime


class LLMStats(BaseModel):
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    avg_latency_ms: float
    error_rate: float
    models: list[dict]


class ModelHealth(BaseModel):
    model: str
    requests: int
    errors: int
    avg_latency_ms: float
    p99_latency_ms: float
    tokens_per_minute: int
    cost_per_hour: float
    status: str  # healthy, degraded, down
```

- [ ] **Step 3: Create plugins/agent_monitor/metrics_collector.py**

```python
import time
import random
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader, OTLPMetricExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource

# GenAI semantic convention metrics
MODEL_PRICING = {
    "llama3.1:8b": {"input": 0.0, "output": 0.0},  # local, free
    "qwen2.5:7b": {"input": 0.0, "output": 0.0},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
}


def init_metrics(endpoint: str):
    resource = Resource.create({SERVICE_NAME: "agent-monitor"})
    exporter = OTLPMetricExporter(endpoint=endpoint)
    reader = PeriodicExportingMetricReader(exporter, export_interval_millis=10000)
    provider = MeterProvider(resource=resource, metric_readers=[reader])
    metrics.set_meter_provider(provider)
    meter = metrics.get_meter("agent-monitor")

    return {
        "request_counter": meter.create_counter("gen_ai.client.request.count", description="LLM requests"),
        "token_counter": meter.create_counter("gen_ai.client.token.usage", description="Token usage"),
        "cost_histogram": meter.create_histogram("gen_ai.client.cost.usd", description="LLM cost", unit="USD"),
        "latency_histogram": meter.create_histogram("gen_ai.client.operation.duration", description="LLM latency", unit="ms"),
        "error_counter": meter.create_counter("gen_ai.client.error.count", description="LLM errors"),
    }


def record_llm_call(meters: dict, model: str, input_tokens: int, output_tokens: int, latency_ms: float, success: bool):
    attrs = {"gen_ai.system": "ollama", "gen_ai.request.model": model}

    meters["request_counter"].add(1, attrs)
    meters["token_counter"].add(input_tokens, {**attrs, "gen_ai.token.type": "input"})
    meters["token_counter"].add(output_tokens, {**attrs, "gen_ai.token.type": "output"})
    meters["latency_histogram"].record(latency_ms, attrs)

    pricing = MODEL_PRICING.get(model, MODEL_PRICING["gpt-4o"])
    cost = (input_tokens / 1_000_000) * pricing["input"] + (output_tokens / 1_000_000) * pricing["output"]
    meters["cost_histogram"].record(cost, attrs)

    if not success:
        meters["error_counter"].add(1, {**attrs, "error.type": "llm_error"})
```

- [ ] **Step 4: Create plugins/agent_monitor/router.py**

```python
from fastapi import APIRouter
from plugins.agent_monitor.models import LLMStats, ModelHealth

router = APIRouter()

# In-memory stats (would be Redis/DB in production)
_stats = {
    "requests": [],
    "models": {},
}


@router.get("/stats", response_model=LLMStats)
async def get_stats():
    requests = _stats["requests"]
    total = len(requests)
    if total == 0:
        return LLMStats(total_requests=0, total_input_tokens=0, total_output_tokens=0, total_cost_usd=0, avg_latency_ms=0, error_rate=0, models=[])
    return LLMStats(
        total_requests=total,
        total_input_tokens=sum(r["input_tokens"] for r in requests),
        total_output_tokens=sum(r["output_tokens"] for r in requests),
        total_cost_usd=sum(r["cost_usd"] for r in requests),
        avg_latency_ms=sum(r["latency_ms"] for r in requests) / total,
        error_rate=sum(1 for r in requests if not r["success"]) / total,
        models=[{"model": m, "requests": len(rs)} for m, rs in _stats["models"].items()],
    )


@router.get("/health/models", response_model=list[ModelHealth])
async def get_model_health():
    models = []
    for model_name, model_requests in _stats["models"].items():
        errors = sum(1 for r in model_requests if not r["success"])
        latencies = [r["latency_ms"] for r in model_requests]
        models.append(ModelHealth(
            model=model_name,
            requests=len(model_requests),
            errors=errors,
            avg_latency_ms=sum(latencies) / max(len(latencies), 1),
            p99_latency_ms=sorted(latencies)[int(len(latencies) * 0.99)] if latencies else 0,
            tokens_per_minute=0,
            cost_per_hour=0,
            status="healthy" if errors / max(len(model_requests), 1) < 0.05 else "degraded",
        ))
    return models
```

- [ ] **Step 5: Create plugins/agent_monitor/main.py**

```python
import asyncio
import random
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from plugins.agent_monitor.config import AgentMonitorConfig
from plugins.agent_monitor.metrics_collector import init_metrics, record_llm_call
from plugins.agent_monitor.router import router, _stats

logger = logging.getLogger(__name__)
config = AgentMonitorConfig()


async def simulate_traffic():
    meters = init_metrics(config.OTEL_EXPORTER_OTLP_ENDPOINT)
    models = ["llama3.1:8b", "qwen2.5:7b"]
    while True:
        model = random.choice(models)
        input_tokens = random.randint(50, 500)
        output_tokens = random.randint(100, 1000)
        latency = random.gauss(200, 50)
        success = random.random() > 0.03
        cost = 0.0  # local models are free

        record_llm_call(meters, model, input_tokens, output_tokens, latency, success)
        _stats["requests"].append({"model": model, "input_tokens": input_tokens, "output_tokens": output_tokens, "latency_ms": latency, "cost_usd": cost, "success": success})
        if model not in _stats["models"]:
            _stats["models"][model] = []
        _stats["models"][model].append(_stats["requests"][-1])

        await asyncio.sleep(config.TRAFFIC_INTERVAL_S)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(simulate_traffic())
    yield
    task.cancel()


app = FastAPI(title="Agent Monitor", lifespan=lifespan)
app.include_router(router, prefix="/api/v1/agent-monitor")


@app.get("/health")
async def health():
    return {"status": "healthy"}
```

- [ ] **Step 6: Create Dockerfile and commit**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/agent_monitor/ plugins/agent_monitor/
CMD ["uvicorn", "plugins.agent_monitor.main:app", "--host", "0.0.0.0", "--port", "8002"]
```

```bash
git add plugins/agent_monitor/ tests/test_agent_monitor.py
git commit -m "feat: agent monitor service with LLM token/cost/latency tracking"
```

---

## Task 9: RCA Engine Service

**Files:**
- Create: `plugins/rca_engine/main.py`
- Create: `plugins/rca_engine/config.py`
- Create: `plugins/rca_engine/anomaly_detector.py`
- Create: `plugins/rca_engine/correlation.py`
- Create: `plugins/rca_engine/llm_explainer.py`
- Create: `plugins/rca_engine/router.py`
- Create: `plugins/rca_engine/Dockerfile`
- Test: `tests/test_rca.py`

**Subagent:** `general` — RCA engine

**Interfaces:**
- Consumes: CMDB topology (via Core API), OTel metrics/logs/traces (via otel-lgtm), Ollama for LLM
- Produces: `/api/v1/rca/*` endpoints, RCA reports with LLM explanations

- [ ] **Step 1: Create plugins/rca_engine/config.py**

```python
from pydantic_settings import BaseSettings


class RCAConfig(BaseModel):
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://otel-lgtm:4318"
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    MODEL_NAME: str = "llama3.1:8b"
    ANOMALY_THRESHOLD_SD: float = 3.0
    TIME_WINDOW_MIN: int = 5
    MAX_CANDIDATES: int = 3

    model_config = {"env_file": ".env"}
```

- [ ] **Step 2: Create plugins/rca_engine/anomaly_detector.py**

```python
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Anomaly:
    service: str
    metric_type: str  # latency, error_rate, token_usage
    severity: str  # low, medium, high, critical
    score: float
    current_value: float
    threshold: float
    timestamp: datetime


class AnomalyDetector:
    def __init__(self, threshold_sd: float = 3.0):
        self.threshold_sd = threshold_sd

    def detect(self, metrics: list[dict], logs: list[dict], traces: list[dict]) -> list[Anomaly]:
        anomalies = []
        anomalies.extend(self._detect_metric_anomalies(metrics))
        anomalies.extend(self._detect_log_anomalies(logs))
        anomalies.extend(self._detect_trace_anomalies(traces))
        return sorted(anomalies, key=lambda a: a.score, reverse=True)

    def _detect_metric_anomalies(self, metrics: list[dict]) -> list[Anomaly]:
        anomalies = []
        by_service = {}
        for m in metrics:
            svc = m.get("service", "unknown")
            if svc not in by_service:
                by_service[svc] = []
            by_service[svc].append(m)

        for svc, svc_metrics in by_service.items():
            latencies = [m["latency_ms"] for m in svc_metrics if "latency_ms" in m]
            error_rates = [m.get("error_rate", 0) for m in svc_metrics]

            if latencies:
                mean = sum(latencies) / len(latencies)
                std = (sum((x - mean) ** 2 for x in latencies) / max(len(latencies), 1)) ** 0.5
                if std > 0:
                    latest = latencies[-1]
                    z_score = (latest - mean) / std
                    if abs(z_score) > self.threshold_sd:
                        anomalies.append(Anomaly(
                            service=svc, metric_type="latency",
                            severity="critical" if z_score > 4 else "high",
                            score=abs(z_score), current_value=latest,
                            threshold=mean + self.threshold_sd * std,
                            timestamp=datetime.utcnow(),
                        ))

            if error_rates:
                latest_error = error_rates[-1]
                if latest_error > 0.05:
                    anomalies.append(Anomaly(
                        service=svc, metric_type="error_rate",
                        severity="critical" if latest_error > 0.2 else "high",
                        score=latest_error * 100, current_value=latest_error,
                        threshold=0.05, timestamp=datetime.utcnow(),
                    ))
        return anomalies
```

- [ ] **Step 3: Create plugins/rca_engine/correlation.py**

```python
from dataclasses import dataclass, field
from plugins.rca_engine.anomaly_detector import Anomaly


@dataclass
class RCACandidate:
    ci_id: str
    ci_name: str
    ci_type: str
    anomalies: list[Anomaly] = field(default_factory=list)
    blast_radius: int = 0
    correlation_score: float = 0.0
    hypothesis: str = ""


class CorrelationEngine:
    def __init__(self, topology: list[dict], relationships: list[dict]):
        self.topology = topology
        self.relationships = relationships

    def find_candidates(self, anomalies: list[Anomaly], max_candidates: int = 3) -> list[RCACandidate]:
        candidates = {}
        for anomaly in anomalies:
            for node in self.topology:
                if node["name"] == anomaly.service or anomaly.service in node.get("name", ""):
                    ci_id = node["id"]
                    if ci_id not in candidates:
                        candidates[ci_id] = RCACandidate(
                            ci_id=ci_id, ci_name=node["name"], ci_type=node["type"]
                        )
                    candidates[ci_id].anomalies.append(anomaly)
                    candidates[ci_id].correlation_score += anomaly.score

        for ci_id, candidate in candidates.items():
            downstream = self._get_downstream(ci_id)
            candidate.blast_radius = len(downstream)
            candidate.correlation_score += candidate.blast_radius * 0.5

        sorted_candidates = sorted(candidates.values(), key=lambda c: c.correlation_score, reverse=True)
        return sorted_candidates[:max_candidates]

    def _get_downstream(self, ci_id: str) -> list[str]:
        downstream = set()
        queue = [ci_id]
        while queue:
            current = queue.pop(0)
            for rel in self.relationships:
                if rel.get("source") == current and rel.get("target") not in downstream:
                    downstream.add(rel["target"])
                    queue.append(rel["target"])
        return list(downstream)
```

- [ ] **Step 4: Create plugins/rca_engine/llm_explainer.py**

```python
import httpx
from plugins.rca_engine.correlation import RCACandidate
from plugins.rca_engine.config import RCAConfig


class LLMExplainer:
    def __init__(self, config: RCAConfig):
        self.config = config
        self.client = httpx.AsyncClient(base_url=config.OLLAMA_BASE_URL, timeout=60.0)

    async def explain(self, candidates: list[RCACandidate], alert_context: dict) -> str:
        candidates_text = "\n".join([
            f"- {c.ci_name} ({c.ci_type}): score={c.correlation_score:.1f}, blast_radius={c.blast_radius}, anomalies={[a.metric_type for a in c.anomalies]}"
            for c in candidates
        ])

        prompt = f"""You are an SRE analyzing a production incident.

Alert Context:
- Service: {alert_context.get('service', 'unknown')}
- Alert: {alert_context.get('alert_name', 'unknown')}
- Severity: {alert_context.get('severity', 'unknown')}
- Time: {alert_context.get('timestamp', 'unknown')}

Root Cause Candidates (ranked by correlation score):
{candidates_text}

Based on the service topology and anomaly patterns, provide:
1. Most likely root cause (1-2 sentences)
2. Why it's the root cause (evidence from anomalies)
3. Recommended investigation steps (3-5 specific actions)
4. Suggested remediation (if applicable)

Keep your response concise and actionable."""

        try:
            response = await self.client.post("/api/generate", json={
                "model": self.config.MODEL_NAME,
                "prompt": prompt,
                "stream": False,
            })
            response.raise_for_status()
            return response.json().get("response", "LLM explanation unavailable")
        except Exception as e:
            return f"LLM explanation unavailable: {str(e)}"
```

- [ ] **Step 5: Create plugins/rca_engine/router.py**

```python
from fastapi import APIRouter, Depends
from plugins.rca_engine.anomaly_detector import AnomalyDetector
from plugins.rca_engine.correlation import CorrelationEngine
from plugins.rca_engine.llm_explainer import LLMExplainer
from plugins.rca_engine.config import RCAConfig
from pydantic import BaseModel

router = APIRouter()
config = RCAConfig()


class RCARequest(BaseModel):
    service_name: str
    alert_name: str
    severity: str
    metrics: list[dict] = []
    logs: list[dict] = []
    traces: list[dict] = []
    topology: list[dict] = []
    relationships: list[dict] = []


class RCAResponse(BaseModel):
    candidates: list[dict]
    explanation: str
    alert_context: dict


@router.post("/analyze", response_model=RCAResponse)
async def analyze(req: RCARequest):
    detector = AnomalyDetector(config.ANOMALY_THRESHOLD_SD)
    anomalies = detector.detect(req.metrics, req.logs, req.traces)

    correlator = CorrelationEngine(req.topology, req.relationships)
    candidates = correlator.find_candidates(anomalies, config.MAX_CANDIDATES)

    explainer = LLMExplainer(config)
    alert_context = {
        "service": req.service_name,
        "alert_name": req.alert_name,
        "severity": req.severity,
    }
    explanation = await explainer.explain(candidates, alert_context)

    return RCAResponse(
        candidates=[{
            "ci_id": c.ci_id, "ci_name": c.ci_name, "ci_type": c.ci_type,
            "correlation_score": c.correlation_score, "blast_radius": c.blast_radius,
            "anomalies": [{"type": a.metric_type, "severity": a.severity, "score": a.score} for a in c.anomalies],
        } for c in candidates],
        explanation=explanation,
        alert_context=alert_context,
    )
```

- [ ] **Step 6: Create Dockerfile and commit**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/rca_engine/ plugins/rca_engine/
CMD ["uvicorn", "plugins.rca_engine.main:app", "--host", "0.0.0.0", "--port", "8003"]
```

```bash
git add plugins/rca_engine/ tests/test_rca.py
git commit -m "feat: RCA engine with anomaly detection, correlation, LLM explanation"
```

---

## Task 10: ChatBot Service with Human Approval

**Files:**
- Create: `plugins/chatbot/main.py`
- Create: `plugins/chatbot/config.py`
- Create: `plugins/chatbot/agent.py`
- Create: `plugins/chatbot/tools.py`
- Create: `plugins/chatbot/approval.py`
- Create: `plugins/chatbot/router.py`
- Create: `plugins/chatbot/Dockerfile`
- Test: `tests/test_chatbot.py`

**Subagent:** `general` — chatbot service

**Interfaces:**
- Consumes: Ollama (LLM), CMDB topology (via Core API), OTel data (via otel-lgtm), Redis for approval queue
- Produces: `/api/v1/chatbot/*` endpoints, LangGraph agent with interrupt-based approval

- [ ] **Step 1: Create plugins/chatbot/config.py**

```python
from pydantic_settings import BaseSettings


class ChatBotConfig(BaseSettings):
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    MODEL_NAME: str = "llama3.1:8b"
    CORE_API_URL: str = "http://api-gateway:8000"
    REDIS_URL: str = "redis://redis:6379/0"
    APPROVAL_TTL_S: int = 300

    model_config = {"env_file": ".env"}
```

- [ ] **Step 2: Create plugins/chatbot/tools.py**

```python
from langchain_core.tools import tool
import httpx
from plugins.chatbot.config import ChatBotConfig

config = ChatBotConfig()
client = httpx.AsyncClient(base_url=config.CORE_API_URL, timeout=30.0)


@tool
def query_metrics(service_name: str, metric_type: str = "latency") -> str:
    """Query metrics for a service from the observability stack."""
    return f"Metrics for {service_name} ({metric_type}): Latency P99=450ms, Error rate=3.2%, Throughput=1200 req/min"


@tool
def query_logs(service_name: str, filter_error: bool = True) -> str:
    """Query logs for a service, optionally filtering for errors."""
    return f"Recent logs for {service_name}: [ERROR] Connection timeout to downstream service, [WARN] High memory usage, [INFO] Request processed"


@tool
def query_traces(service_name: str) -> str:
    """Query distributed traces for a service."""
    return f"Traces for {service_name}: 3 spans, avg duration=250ms, 2 error spans detected"


@tool
def get_topology(service_name: str) -> str:
    """Get service dependency topology from CMDB."""
    return f"Topology for {service_name}: depends on [api-gateway, postgres, redis], depended on by [web-frontend, mobile-app]"


@tool
def propose_fix(rca_id: str, action_type: str) -> str:
    """Propose a fix based on RCA findings. Requires approval before execution."""
    return f"Proposed fix for {rca_id}: {action_type} - Restart affected pods, scale up replicas, clear cache"


@tool
def execute_fix(action_id: str) -> str:
    """Execute an approved fix. Requires human approval."""
    return f"Fix {action_id} executed successfully: Services restarted, health checks passing"
```

- [ ] **Step 3: Create plugins/chatbot/approval.py**

```python
import json
import uuid
import time
from dataclasses import dataclass, field
from enum import Enum
import redis.asyncio as aioredis
from plugins.chatbot.config import ChatBotConfig

config = ChatBotConfig()


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class ApprovalRequest:
    id: str
    tool_name: str
    arguments: dict
    context: str
    status: ApprovalStatus = ApprovalStatus.PENDING
    created_at: float = field(default_factory=time.time)
    decided_at: float | None = None
    decided_by: str | None = None


class ApprovalManager:
    def __init__(self):
        self.redis = aioredis.from_url(config.REDIS_URL)
        self.pending: dict[str, ApprovalRequest] = {}

    async def create_request(self, tool_name: str, arguments: dict, context: str) -> ApprovalRequest:
        req = ApprovalRequest(
            id=str(uuid.uuid4()),
            tool_name=tool_name,
            arguments=arguments,
            context=context,
        )
        self.pending[req.id] = req
        await self.redis.hset("approvals", req.id, json.dumps({
            "id": req.id, "tool_name": tool_name, "arguments": arguments,
            "context": context, "status": req.status, "created_at": req.created_at,
        }))
        return req

    async def approve(self, request_id: str, decided_by: str = "operator") -> bool:
        req = self.pending.get(request_id)
        if not req:
            return False
        req.status = ApprovalStatus.APPROVED
        req.decided_at = time.time()
        req.decided_by = decided_by
        await self.redis.hset("approvals", request_id, json.dumps({
            "id": req.id, "tool_name": req.tool_name, "arguments": req.arguments,
            "context": req.context, "status": req.status, "decided_by": decided_by,
        }))
        return True

    async def reject(self, request_id: str, decided_by: str = "operator") -> bool:
        req = self.pending.get(request_id)
        if not req:
            return False
        req.status = ApprovalStatus.REJECTED
        req.decided_at = time.time()
        req.decided_by = decided_by
        await self.redis.hset("approvals", request_id, json.dumps({
            "id": req.id, "tool_name": req.tool_name, "status": req.status, "decided_by": decided_by,
        }))
        return True

    async def get_pending(self) -> list[ApprovalRequest]:
        return [r for r in self.pending.values() if r.status == ApprovalStatus.PENDING]

    async def get_request(self, request_id: str) -> ApprovalRequest | None:
        return self.pending.get(request_id)


approval_manager = ApprovalManager()
```

- [ ] **Step 4: Create plugins/chatbot/agent.py**

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, Annotated, Any
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from plugins.chatbot.tools import query_metrics, query_logs, query_traces, get_topology, propose_fix, execute_fix
from plugins.chatbot.approval import approval_manager, ApprovalStatus

TOOLS_REQUIRING_APPROVAL = {"propose_fix", "execute_fix"}


class ChatState(TypedDict):
    messages: Annotated[list, "Messages"]
    pending_approval: str | None
    approval_context: dict | None


async def agent_node(state: ChatState):
    """Main agent reasoning node."""
    messages = state["messages"]
    last_message = messages[-1] if messages else None

    # Simple rule-based agent for demo (LLM integration via Ollama in production)
    if last_message and isinstance(last_message, HumanMessage):
        content = last_message.content.lower()

        if "metric" in content or "latency" in content or "error rate" in content:
            result = query_metrics.invoke({"service_name": "ecommerce-api", "metric_type": "latency"})
            return {"messages": messages + [AIMessage(content=result)]}
        elif "log" in content:
            result = query_logs.invoke({"service_name": "ecommerce-api", "filter_error": True})
            return {"messages": messages + [AIMessage(content=result)]}
        elif "trace" in content:
            result = query_traces.invoke({"service_name": "ecommerce-api"})
            return {"messages": messages + [AIMessage(content=result)]}
        elif "topology" in content or "depend" in content:
            result = get_topology.invoke({"service_name": "ecommerce-api"})
            return {"messages": messages + [AIMessage(content=result)]}
        elif "fix" in content or "remediat" in content:
            return {
                "messages": messages,
                "pending_approval": "propose_fix",
                "approval_context": {"tool": "propose_fix", "args": {"rca_id": "alert-001", "action_type": "restart"}},
            }
        else:
            return {"messages": messages + [AIMessage(content="I can help you with metrics, logs, traces, topology, and remediation. What would you like to know?")]}

    return {"messages": messages}


async def approval_check(state: ChatState):
    """Check if approval is needed."""
    if state.get("pending_approval"):
        return "approval_needed"
    return "end"


async def approval_node(state: ChatState):
    """Handle approval flow."""
    tool_name = state["pending_approval"]
    args = state.get("approval_context", {}).get("args", {})

    req = await approval_manager.create_request(tool_name, args, f"ChatBot wants to execute {tool_name}")

    return {
        "messages": state["messages"] + [
            AIMessage(content=f"⚠️ Approval required for `{tool_name}`. Request ID: {req.id}. Please approve in the UI.")
        ],
        "pending_approval": None,
        "approval_context": None,
    }


def create_agent():
    workflow = StateGraph(ChatState)
    workflow.add_node("agent", agent_node)
    workflow.add_node("approval", approval_node)
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", approval_check, {"approval_needed": "approval", "end": END})
    workflow.add_edge("approval", END)

    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)
```

- [ ] **Step 5: Create plugins/chatbot/router.py**

```python
from fastapi import APIRouter
from pydantic import BaseModel
from plugins.chatbot.agent import create_agent
from plugins.chatbot.approval import approval_manager, ApprovalStatus
from langchain_core.messages import HumanMessage

router = APIRouter()
agent = create_agent()


class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"


class ChatResponse(BaseModel):
    response: str
    thread_id: str


class ApprovalDecision(BaseModel):
    approved: bool
    decided_by: str = "operator"


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    config = {"configurable": {"thread_id": req.thread_id}}
    result = await agent.ainvoke({"messages": [HumanMessage(content=req.message)]}, config)
    last_msg = result["messages"][-1]
    return ChatResponse(response=last_msg.content, thread_id=req.thread_id)


@router.get("/approvals/pending")
async def get_pending_approvals():
    requests = await approval_manager.get_pending()
    return [{"id": r.id, "tool_name": r.tool_name, "arguments": r.arguments, "context": r.context, "created_at": r.created_at} for r in requests]


@router.post("/approvals/{request_id}")
async def decide_approval(request_id: str, decision: ApprovalDecision):
    if decision.approved:
        success = await approval_manager.approve(request_id, decision.decided_by)
    else:
        success = await approval_manager.reject(request_id, decision.decided_by)
    return {"success": success, "status": "approved" if decision.approved else "rejected"}
```

- [ ] **Step 6: Create main.py and Dockerfile**

```python
# plugins/chatbot/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager
from plugins.chatbot.router import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="ChatBot", lifespan=lifespan)
app.include_router(router, prefix="/api/v1/chatbot")

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/chatbot/ plugins/chatbot/
CMD ["uvicorn", "plugins.chatbot.main:app", "--host", "0.0.0.0", "--port", "8004"]
```

- [ ] **Step 7: Commit**

```bash
git add plugins/chatbot/ tests/test_chatbot.py
git commit -m "feat: chatbot service with LangGraph agent and human approval flow"
```

---

## Task 11: Alert/NOC Service

**Files:**
- Create: `plugins/alert_noc/main.py`
- Create: `plugins/alert_noc/config.py`
- Create: `plugins/alert_noc/models.py`
- Create: `plugins/alert_noc/router.py`
- Create: `plugins/alert_noc/store.py`
- Create: `plugins/alert_noc/Dockerfile`
- Test: `tests/test_alert_noc.py`

**Subagent:** `general` — alert/NOC service

**Interfaces:**
- Consumes: Redis for alert storage, CMDB for service context
- Produces: `/api/v1/alerts/*` endpoints (CRUD, acknowledge, escalate)

- [ ] **Step 1: Create plugins/alert_noc/models.py**

```python
from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


class AlertCreate(BaseModel):
    name: str
    service: str
    severity: AlertSeverity
    description: str
    runbook_url: str | None = None
    labels: dict = {}


class AlertResponse(AlertCreate):
    id: str
    status: AlertStatus
    created_at: datetime
    acknowledged_at: datetime | None = None
    acknowledged_by: str | None = None
    resolved_at: datetime | None = None


class AlertAcknowledge(BaseModel):
    acknowledged_by: str


class AlertGroup(BaseModel):
    service: str
    severity: AlertSeverity
    count: int
    alerts: list[AlertResponse]
```

- [ ] **Step 2: Create plugins/alert_noc/store.py**

```python
import json
import uuid
from datetime import datetime
import redis.asyncio as aioredis
from plugins.alert_noc.models import AlertCreate, AlertResponse, AlertStatus


class AlertStore:
    def __init__(self):
        self.redis = aioredis.from_url("redis://redis:6379/0")

    async def create_alert(self, data: AlertCreate) -> AlertResponse:
        alert_id = str(uuid.uuid4())
        alert = AlertResponse(
            id=alert_id, **data.model_dump(),
            status=AlertStatus.ACTIVE, created_at=datetime.utcnow(),
        )
        await self.redis.hset("alerts", alert_id, alert.model_dump_json())
        await self.redis.sadd("alerts:active", alert_id)
        return alert

    async def get_alert(self, alert_id: str) -> AlertResponse | None:
        data = await self.redis.hget("alerts", alert_id)
        if data:
            return AlertResponse.model_validate_json(data)
        return None

    async def list_alerts(self, status: str | None = None) -> list[AlertResponse]:
        if status:
            ids = await self.redis.smembers(f"alerts:{status}")
        else:
            ids = await self.redis.smembers("alerts:active")
        alerts = []
        for alert_id in ids:
            alert = await self.get_alert(alert_id.decode() if isinstance(alert_id, bytes) else alert_id)
            if alert:
                alerts.append(alert)
        return sorted(alerts, key=lambda a: a.created_at, reverse=True)

    async def acknowledge(self, alert_id: str, acknowledged_by: str) -> bool:
        alert = await self.get_alert(alert_id)
        if not alert:
            return False
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = acknowledged_by
        await self.redis.hset("alerts", alert_id, alert.model_dump_json())
        await self.redis.srem("alerts:active", alert_id)
        await self.redis.sadd("alerts:acknowledged", alert_id)
        return True

    async def resolve(self, alert_id: str) -> bool:
        alert = await self.get_alert(alert_id)
        if not alert:
            return False
        alert.status = AlertStatus.RESOLVED
        alert.resolved_at = datetime.utcnow()
        await self.redis.hset("alerts", alert_id, alert.model_dump_json())
        await self.redis.srem("alerts:active", alert_id)
        await self.redis.srem("alerts:acknowledged", alert_id)
        await self.redis.sadd("alerts:resolved", alert_id)
        return True

    async def get_alert_groups(self) -> list[dict]:
        alerts = await self.list_alerts("active")
        groups = {}
        for alert in alerts:
            key = f"{alert.service}:{alert.severity}"
            if key not in groups:
                groups[key] = {"service": alert.service, "severity": alert.severity, "count": 0, "alerts": []}
            groups[key]["count"] += 1
            groups[key]["alerts"].append(alert)
        return list(groups.values())


alert_store = AlertStore()
```

- [ ] **Step 3: Create plugins/alert_noc/router.py**

```python
from fastapi import APIRouter
from plugins.alert_noc.models import AlertCreate, AlertAcknowledge
from plugins.alert_noc.store import alert_store

router = APIRouter()


@router.post("/alerts", response_model=dict)
async def create_alert(data: AlertCreate):
    alert = await alert_store.create_alert(data)
    return alert.model_dump()


@router.get("/alerts", response_model=list[dict])
async def list_alerts(status: str | None = None):
    alerts = await alert_store.list_alerts(status)
    return [a.model_dump() for a in alerts]


@router.get("/alerts/groups", response_model=list[dict])
async def get_alert_groups():
    return await alert_store.get_alert_groups()


@router.get("/alerts/{alert_id}")
async def get_alert(alert_id: str):
    alert = await alert_store.get_alert(alert_id)
    if not alert:
        return {"error": "Alert not found"}
    return alert.model_dump()


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, data: AlertAcknowledge):
    success = await alert_store.acknowledge(alert_id, data.acknowledged_by)
    return {"success": success}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    success = await alert_store.resolve(alert_id)
    return {"success": success}
```

- [ ] **Step 4: Create main.py and Dockerfile**

```python
# plugins/alert_noc/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager
from plugins.alert_noc.router import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="Alert NOC", lifespan=lifespan)
app.include_router(router, prefix="/api/v1/alerts")

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/alert_noc/ plugins/alert_noc/
CMD ["uvicorn", "plugins.alert_noc.main:app", "--host", "0.0.0.0", "--port", "8005"]
```

- [ ] **Step 5: Commit**

```bash
git add plugins/alert_noc/ tests/test_alert_noc.py
git commit -m "feat: alert/NOC service with CRUD, acknowledge, resolve, grouping"
```

---

## Task Summary

| Task | Description | Subagent | Parallel Group |
|------|-------------|----------|----------------|
| 7 | Synthetic Generator | general | After Task 1 |
| 8 | Agent Monitor | general | After Task 1 |
| 9 | RCA Engine | general | After Task 1 |
| 10 | ChatBot with Approval | general | After Task 1 |
| 11 | Alert/NOC Service | general | After Task 1 |

**Parallel Execution Groups:**
- Group A (after Part 1 complete): Tasks 7, 8, 9, 10, 11 can ALL run in parallel
- Each plugin is independent, no shared state between them

**Total Estimated Time:** ~30-40 minutes with parallel subagents
