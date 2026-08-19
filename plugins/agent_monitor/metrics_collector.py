import time
import random
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
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
