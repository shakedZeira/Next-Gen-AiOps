from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor


def init_tracer(service_name: str) -> TracerProvider:
    resource = Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: "0.1.0",
    })
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider


def instrument_fastapi(app, service_name: str) -> None:
    FastAPIInstrumentor.instrument_app(app, service_name=service_name)
