from dataclasses import dataclass, field


@dataclass
class SimulatedService:
    name: str
    type: str  # web, api, db, cache, queue
    team: str = "backend"
    error_rate: float = 0.01
    latency_mean_ms: int = 50
    latency_stddev_ms: int = 10
    dependencies: list[str] = field(default_factory=list)


DEFAULT_TOPOLOGY = [
    SimulatedService("ecommerce-web", "web", team="frontend", error_rate=0.02, latency_mean_ms=80, dependencies=["ecommerce-api"]),
    SimulatedService("ecommerce-api", "api", team="backend", error_rate=0.03, latency_mean_ms=120, dependencies=["payments-api", "inventory-api", "redis-cache"]),
    SimulatedService("payments-api", "api", team="payments", error_rate=0.05, latency_mean_ms=200, dependencies=["postgres-payments"]),
    SimulatedService("inventory-api", "api", team="backend", error_rate=0.02, latency_mean_ms=100, dependencies=["postgres-inventory"]),
    SimulatedService("postgres-payments", "db", team="data", error_rate=0.01, latency_mean_ms=30),
    SimulatedService("postgres-inventory", "db", team="data", error_rate=0.01, latency_mean_ms=25),
    SimulatedService("redis-cache", "cache", team="platform", error_rate=0.005, latency_mean_ms=5),
    SimulatedService("kafka-broker", "queue", team="platform", error_rate=0.01, latency_mean_ms=10),
    SimulatedService("notification-svc", "api", team="platform", error_rate=0.02, latency_mean_ms=150, dependencies=["kafka-broker"]),
    SimulatedService("order-api", "api", team="backend", error_rate=0.03, latency_mean_ms=90, dependencies=["order-service", "redis-cache"]),
    SimulatedService("order-service", "api", team="backend", error_rate=0.02, latency_mean_ms=110, dependencies=["order-db", "inventory-api"]),
    SimulatedService("order-db", "db", team="data", error_rate=0.01, latency_mean_ms=20),
    SimulatedService("analytics-api", "api", team="data", error_rate=0.01, latency_mean_ms=150, dependencies=["clickhouse-db", "redis-cache"]),
    SimulatedService("clickhouse-db", "db", team="data", error_rate=0.005, latency_mean_ms=40),
    SimulatedService("auth-api", "api", team="security", error_rate=0.01, latency_mean_ms=60, dependencies=["redis-cache", "postgres-auth"]),
    SimulatedService("postgres-auth", "db", team="security", error_rate=0.005, latency_mean_ms=15),
]
