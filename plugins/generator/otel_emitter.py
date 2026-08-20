import asyncio
import random
import time

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.semconv.trace import SpanAttributes

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


async def emit_transaction(tracer, meter, service_name: str, latency_mean: int, error_rate: float):
    request_counter = meter.create_counter("http.server.requests", description="Total HTTP requests")
    latency_histogram = meter.create_histogram("http.server.duration", description="Request latency", unit="ms")
    error_counter = meter.create_counter("http.server.errors", description="Total errors")

    time.time()
    is_error = random.random() < error_rate
    status_code = 500 if is_error else 200

    with tracer.start_as_current_span(f"HTTP GET /{service_name}/api/v1/data") as span:
        latency = max(1, random.gauss(latency_mean, latency_mean * 0.3))
        await asyncio.sleep(latency / 1000)

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
