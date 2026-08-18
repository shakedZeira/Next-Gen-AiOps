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
