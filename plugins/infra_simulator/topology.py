from dataclasses import dataclass, field


@dataclass
class SimulatedDevice:
    name: str
    device_type: str  # switch, router, physical_server, container, pod
    os: str | None = None
    team: str = "infra"
    log_interval_s: float = 10.0
    error_probability: float = 0.02
    dependencies: list[str] = field(default_factory=list)
    properties: dict = field(default_factory=dict)


INFRA_DEVICES = [
    # Network devices
    SimulatedDevice(
        name="core-router-1",
        device_type="router",
        team="network",
        error_probability=0.01,
        properties={"vendor": "cisco", "ios": "16.12", "interfaces": 8, "role": "core"},
    ),
    SimulatedDevice(
        name="access-switch-1",
        device_type="switch",
        team="network",
        error_probability=0.02,
        properties={"vendor": "cisco", "ports": 48, "role": "access"},
    ),
    SimulatedDevice(
        name="access-switch-2",
        device_type="switch",
        team="network",
        error_probability=0.02,
        properties={"vendor": "cisco", "ports": 48, "role": "access"},
    ),
    SimulatedDevice(
        name="dmz-switch-1",
        device_type="switch",
        team="network",
        error_probability=0.03,
        properties={"vendor": "cisco", "ports": 24, "role": "dmz"},
    ),
    # Physical servers
    SimulatedDevice(
        name="web-host-1",
        device_type="physical_server",
        os="linux",
        team="frontend",
        error_probability=0.02,
        properties={"os_version": "ubuntu-22.04", "cpu": 16, "ram_gb": 64},
    ),
    SimulatedDevice(
        name="web-host-2",
        device_type="physical_server",
        os="linux",
        team="frontend",
        error_probability=0.02,
        properties={"os_version": "ubuntu-22.04", "cpu": 16, "ram_gb": 64},
    ),
    SimulatedDevice(
        name="app-host-1",
        device_type="physical_server",
        os="linux",
        team="backend",
        error_probability=0.02,
        properties={"os_version": "ubuntu-22.04", "cpu": 32, "ram_gb": 128},
    ),
    SimulatedDevice(
        name="app-host-2",
        device_type="physical_server",
        os="windows",
        team="backend",
        error_probability=0.03,
        properties={"os_version": "server-2022", "cpu": 32, "ram_gb": 128},
    ),
    SimulatedDevice(
        name="db-host-1",
        device_type="physical_server",
        os="linux",
        team="data",
        error_probability=0.01,
        properties={"os_version": "ubuntu-22.04", "cpu": 64, "ram_gb": 256},
    ),
    SimulatedDevice(
        name="monitor-host-1",
        device_type="physical_server",
        os="windows",
        team="sre",
        error_probability=0.02,
        properties={"os_version": "server-2022", "cpu": 16, "ram_gb": 32},
    ),
    # Docker containers
    SimulatedDevice(
        name="nginx-proxy",
        device_type="container",
        team="frontend",
        error_probability=0.02,
        properties={"image": "nginx:1.25", "host": "web-host-1", "port": 443},
    ),
    SimulatedDevice(
        name="ecommerce-app",
        device_type="container",
        team="backend",
        error_probability=0.03,
        properties={"image": "node:20", "host": "app-host-1", "port": 3000},
    ),
    SimulatedDevice(
        name="payments-app",
        device_type="container",
        team="payments",
        error_probability=0.04,
        properties={"image": "python:3.11", "host": "app-host-1", "port": 8080},
    ),
    SimulatedDevice(
        name="inventory-app",
        device_type="container",
        team="backend",
        error_probability=0.02,
        properties={"image": "python:3.11", "host": "app-host-2", "port": 8081},
    ),
    SimulatedDevice(
        name="redis-node",
        device_type="container",
        team="platform",
        error_probability=0.01,
        properties={"image": "redis:7", "host": "app-host-1", "port": 6379},
    ),
    SimulatedDevice(
        name="kafka-node",
        device_type="container",
        team="platform",
        error_probability=0.02,
        properties={"image": "confluentinc/cp-kafka:7.5", "host": "app-host-2", "port": 9092},
    ),
    # Kubernetes pods
    SimulatedDevice(
        name="order-svc-pod-1",
        device_type="pod",
        team="backend",
        error_probability=0.03,
        properties={"namespace": "production", "node": "app-host-1", "deployment": "order-service"},
    ),
    SimulatedDevice(
        name="order-svc-pod-2",
        device_type="pod",
        team="backend",
        error_probability=0.03,
        properties={"namespace": "production", "node": "app-host-2", "deployment": "order-service"},
    ),
    SimulatedDevice(
        name="analytics-pod-1",
        device_type="pod",
        team="data",
        error_probability=0.02,
        properties={"namespace": "production", "node": "db-host-1", "deployment": "analytics-api"},
    ),
    SimulatedDevice(
        name="auth-pod-1",
        device_type="pod",
        team="security",
        error_probability=0.02,
        properties={"namespace": "production", "node": "app-host-1", "deployment": "auth-api"},
    ),
    SimulatedDevice(
        name="notification-pod-1",
        device_type="pod",
        team="platform",
        error_probability=0.02,
        properties={"namespace": "production", "node": "app-host-2", "deployment": "notification-svc"},
    ),
]

SERVICE_MAP = {
    "core-router-1": "Network Infrastructure",
    "access-switch-1": "Network Infrastructure",
    "access-switch-2": "Network Infrastructure",
    "dmz-switch-1": "Network Infrastructure",
    "web-host-1": "E-Commerce Platform",
    "web-host-2": "E-Commerce Platform",
    "app-host-1": "E-Commerce Platform",
    "app-host-2": "Inventory Service",
    "db-host-1": "Analytics Pipeline",
    "monitor-host-1": "Network Infrastructure",
    "nginx-proxy": "E-Commerce Platform",
    "ecommerce-app": "E-Commerce Platform",
    "payments-app": "Payment Gateway",
    "inventory-app": "Inventory Service",
    "redis-node": "E-Commerce Platform",
    "kafka-node": "Notification Service",
    "order-svc-pod-1": "Order Processing",
    "order-svc-pod-2": "Order Processing",
    "analytics-pod-1": "Analytics Pipeline",
    "auth-pod-1": "Auth Service",
    "notification-pod-1": "Notification Service",
}
