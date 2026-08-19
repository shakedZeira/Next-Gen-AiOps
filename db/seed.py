import json
import uuid
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://aiops:aiops@localhost:5432/aiops"
engine = create_engine(DATABASE_URL)

services = [
    {"id": str(uuid.uuid4()), "name": "E-Commerce Platform", "owner_team": "frontend", "sla_tier": "gold"},
    {"id": str(uuid.uuid4()), "name": "Payment Gateway", "owner_team": "payments", "sla_tier": "gold"},
    {"id": str(uuid.uuid4()), "name": "Inventory Service", "owner_team": "backend", "sla_tier": "silver"},
    {"id": str(uuid.uuid4()), "name": "Notification Service", "owner_team": "platform", "sla_tier": "bronze"},
    {"id": str(uuid.uuid4()), "name": "Order Processing", "owner_team": "backend", "sla_tier": "gold"},
    {"id": str(uuid.uuid4()), "name": "Analytics Pipeline", "owner_team": "data", "sla_tier": "silver"},
    {"id": str(uuid.uuid4()), "name": "Auth Service", "owner_team": "security", "sla_tier": "gold"},
    {"id": str(uuid.uuid4()), "name": "Network Infrastructure", "owner_team": "network", "sla_tier": "gold"},
]

# Index reference:
# 0: nginx-lb-1          1: web-server-1        2: web-server-2
# 3: api-gateway-ci      4: postgres-payments   5: redis-cache
# 6: kafka-broker-1      7: payment-processor   8: inventory-db
# 9: notification-svc    10: order-api          11: order-service
# 12: order-db           13: analytics-api      14: clickhouse-db
# 15: s3-data-lake       16: auth-api           17: postgres-auth
# 18: notification-db    19: analytics-ui
# 20: core-router-1      21: access-switch-1    22: access-switch-2
# 23: dmz-switch-1       24: web-host-1         25: web-host-2
# 26: app-host-1         27: app-host-2         28: db-host-1
# 29: monitor-host-1     30: nginx-proxy        31: ecommerce-app
# 32: payments-app       33: inventory-app      34: redis-node
# 35: kafka-node         36: order-svc-pod-1    37: order-svc-pod-2
# 38: analytics-pod-1    39: auth-pod-1         40: notification-pod-1

cis = [
    {"id": str(uuid.uuid4()), "name": "nginx-lb-1", "type": "load_balancer", "provider": "aws", "environment": "prod", "team": "sre", "labels": {"app": "nginx", "tier": "frontend"}},
    {"id": str(uuid.uuid4()), "name": "web-server-1", "type": "host", "provider": "aws", "environment": "prod", "team": "frontend", "labels": {"app": "ecommerce", "tier": "frontend"}},
    {"id": str(uuid.uuid4()), "name": "web-server-2", "type": "host", "provider": "aws", "environment": "prod", "team": "frontend", "labels": {"app": "ecommerce", "tier": "frontend"}},
    {"id": str(uuid.uuid4()), "name": "api-gateway-ci", "type": "api_gateway", "provider": "aws", "environment": "prod", "team": "sre", "labels": {"app": "api-gateway", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "postgres-payments", "type": "database", "provider": "aws", "environment": "prod", "team": "data", "labels": {"app": "payments", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "redis-cache", "type": "cache", "provider": "aws", "environment": "prod", "team": "platform", "labels": {"app": "redis", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "kafka-broker-1", "type": "message_queue", "provider": "aws", "environment": "prod", "team": "platform", "labels": {"app": "kafka", "tier": "messaging"}},
    {"id": str(uuid.uuid4()), "name": "payment-processor-1", "type": "microservice", "provider": "aws", "environment": "prod", "team": "payments", "labels": {"app": "payments", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "inventory-db", "type": "database", "provider": "aws", "environment": "prod", "team": "data", "labels": {"app": "inventory", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "notification-svc", "type": "microservice", "provider": "aws", "environment": "prod", "team": "platform", "labels": {"app": "notifications", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "order-api", "type": "api_gateway", "provider": "aws", "environment": "prod", "team": "backend", "labels": {"app": "orders", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "order-service", "type": "microservice", "provider": "aws", "environment": "prod", "team": "backend", "labels": {"app": "orders", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "order-db", "type": "database", "provider": "aws", "environment": "prod", "team": "data", "labels": {"app": "orders", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "analytics-api", "type": "microservice", "provider": "aws", "environment": "prod", "team": "data", "labels": {"app": "analytics", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "clickhouse-db", "type": "database", "provider": "gcp", "environment": "prod", "team": "data", "labels": {"app": "analytics", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "s3-data-lake", "type": "storage", "provider": "aws", "environment": "prod", "team": "data", "labels": {"app": "analytics", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "auth-api", "type": "microservice", "provider": "aws", "environment": "prod", "team": "security", "labels": {"app": "auth", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "postgres-auth", "type": "database", "provider": "aws", "environment": "prod", "team": "security", "labels": {"app": "auth", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "notification-db", "type": "database", "provider": "aws", "environment": "prod", "team": "data", "labels": {"app": "notifications", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "analytics-ui", "type": "host", "provider": "aws", "environment": "prod", "team": "frontend", "labels": {"app": "analytics", "tier": "frontend"}},
    # Network devices (20-23)
    {"id": str(uuid.uuid4()), "name": "core-router-1", "type": "router", "provider": "cisco", "environment": "prod", "team": "network", "labels": {"vendor": "cisco", "ios": "16.12", "role": "core"}},
    {"id": str(uuid.uuid4()), "name": "access-switch-1", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "labels": {"vendor": "cisco", "ports": "48", "role": "access"}},
    {"id": str(uuid.uuid4()), "name": "access-switch-2", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "labels": {"vendor": "cisco", "ports": "48", "role": "access"}},
    {"id": str(uuid.uuid4()), "name": "dmz-switch-1", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "labels": {"vendor": "cisco", "ports": "24", "role": "dmz"}},
    # Physical servers (24-29)
    {"id": str(uuid.uuid4()), "name": "web-host-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "frontend", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "16", "ram_gb": "64"}},
    {"id": str(uuid.uuid4()), "name": "web-host-2", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "frontend", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "16", "ram_gb": "64"}},
    {"id": str(uuid.uuid4()), "name": "app-host-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "32", "ram_gb": "128"}},
    {"id": str(uuid.uuid4()), "name": "app-host-2", "type": "physical_server", "provider": "hp", "environment": "prod", "team": "backend", "labels": {"os": "windows", "os_version": "server-2022", "cpu": "32", "ram_gb": "128"}},
    {"id": str(uuid.uuid4()), "name": "db-host-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "data", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "64", "ram_gb": "256"}},
    {"id": str(uuid.uuid4()), "name": "monitor-host-1", "type": "physical_server", "provider": "hp", "environment": "prod", "team": "sre", "labels": {"os": "windows", "os_version": "server-2022", "cpu": "16", "ram_gb": "32"}},
    # Docker containers (30-35)
    {"id": str(uuid.uuid4()), "name": "nginx-proxy", "type": "container", "provider": "docker", "environment": "prod", "team": "frontend", "labels": {"image": "nginx:1.25", "host": "web-host-1", "port": "443"}},
    {"id": str(uuid.uuid4()), "name": "ecommerce-app", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "labels": {"image": "node:20", "host": "app-host-1", "port": "3000"}},
    {"id": str(uuid.uuid4()), "name": "payments-app", "type": "container", "provider": "docker", "environment": "prod", "team": "payments", "labels": {"image": "python:3.11", "host": "app-host-1", "port": "8080"}},
    {"id": str(uuid.uuid4()), "name": "inventory-app", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "labels": {"image": "python:3.11", "host": "app-host-2", "port": "8081"}},
    {"id": str(uuid.uuid4()), "name": "redis-node", "type": "container", "provider": "docker", "environment": "prod", "team": "platform", "labels": {"image": "redis:7", "host": "app-host-1", "port": "6379"}},
    {"id": str(uuid.uuid4()), "name": "kafka-node", "type": "container", "provider": "docker", "environment": "prod", "team": "platform", "labels": {"image": "confluentinc/cp-kafka:7.5", "host": "app-host-2", "port": "9092"}},
    # Kubernetes pods (36-40)
    {"id": str(uuid.uuid4()), "name": "order-svc-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "backend", "labels": {"namespace": "production", "node": "app-host-1", "deployment": "order-service"}},
    {"id": str(uuid.uuid4()), "name": "order-svc-pod-2", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "backend", "labels": {"namespace": "production", "node": "app-host-2", "deployment": "order-service"}},
    {"id": str(uuid.uuid4()), "name": "analytics-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "data", "labels": {"namespace": "production", "node": "db-host-1", "deployment": "analytics-api"}},
    {"id": str(uuid.uuid4()), "name": "auth-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "security", "labels": {"namespace": "production", "node": "app-host-1", "deployment": "auth-api"}},
    {"id": str(uuid.uuid4()), "name": "notification-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "platform", "labels": {"namespace": "production", "node": "app-host-2", "deployment": "notification-svc"}},
]

# Flow 1: E-Commerce: nginx-lb → web-servers → api-gateway → payments, redis, kafka → payment-processor, notification
# Flow 2: Order Processing: order-api → order-service → order-db, inventory-db
# Flow 3: Analytics: analytics-ui → analytics-api → clickhouse, s3, redis
# Flow 4: Auth: auth-api → postgres-auth, redis

relationships = [
    {"source": 0, "target": 1, "type": "routes_to"},
    {"source": 0, "target": 2, "type": "routes_to"},
    {"source": 1, "target": 3, "type": "calls"},
    {"source": 2, "target": 3, "type": "calls"},
    {"source": 3, "target": 4, "type": "depends_on"},
    {"source": 3, "target": 5, "type": "depends_on"},
    {"source": 3, "target": 6, "type": "publishes_to"},
    {"source": 6, "target": 7, "type": "delivers_to"},
    {"source": 7, "target": 4, "type": "depends_on"},
    {"source": 6, "target": 9, "type": "delivers_to"},
    {"source": 9, "target": 18, "type": "depends_on"},
    {"source": 10, "target": 11, "type": "calls"},
    {"source": 11, "target": 12, "type": "depends_on"},
    {"source": 11, "target": 8, "type": "depends_on"},
    {"source": 10, "target": 5, "type": "depends_on"},
    {"source": 19, "target": 13, "type": "calls"},
    {"source": 13, "target": 14, "type": "depends_on"},
    {"source": 13, "target": 15, "type": "depends_on"},
    {"source": 13, "target": 5, "type": "depends_on"},
    {"source": 16, "target": 17, "type": "depends_on"},
    {"source": 16, "target": 5, "type": "depends_on"},
    {"source": 3, "target": 16, "type": "calls"},
    # Network flow: router -> switches -> hosts
    {"source": 20, "target": 23, "type": "routes_to"},
    {"source": 23, "target": 21, "type": "routes_to"},
    {"source": 23, "target": 22, "type": "routes_to"},
    {"source": 21, "target": 1, "type": "connects_to"},
    {"source": 21, "target": 2, "type": "connects_to"},
    {"source": 22, "target": 3, "type": "connects_to"},
    # Host -> network connectivity
    {"source": 24, "target": 21, "type": "connected_to"},
    {"source": 25, "target": 21, "type": "connected_to"},
    {"source": 26, "target": 22, "type": "connected_to"},
    {"source": 27, "target": 22, "type": "connected_to"},
    {"source": 28, "target": 22, "type": "connected_to"},
    {"source": 29, "target": 22, "type": "connected_to"},
    # Physical hosts -> containers
    {"source": 24, "target": 30, "type": "hosts"},
    {"source": 26, "target": 31, "type": "hosts"},
    {"source": 26, "target": 32, "type": "hosts"},
    {"source": 26, "target": 34, "type": "hosts"},
    {"source": 27, "target": 33, "type": "hosts"},
    {"source": 27, "target": 35, "type": "hosts"},
    # Physical hosts -> pods
    {"source": 26, "target": 36, "type": "runs"},
    {"source": 27, "target": 37, "type": "runs"},
    {"source": 28, "target": 38, "type": "runs"},
    {"source": 26, "target": 39, "type": "runs"},
    {"source": 27, "target": 40, "type": "runs"},
    # Containers -> application CIs
    {"source": 30, "target": 0, "type": "runs"},
    {"source": 31, "target": 1, "type": "runs"},
    {"source": 32, "target": 7, "type": "runs"},
]

service_ci_map = [
    (0, 0, "entry_point"), (0, 1, "dependency"), (0, 2, "dependency"), (0, 3, "dependency"),
    (0, 30, "dependency"), (0, 24, "dependency"), (0, 25, "dependency"), (0, 21, "dependency"),
    (1, 4, "entry_point"), (1, 7, "dependency"), (1, 32, "dependency"),
    (2, 8, "entry_point"),
    (3, 9, "entry_point"), (3, 18, "dependency"), (3, 40, "dependency"),
    (4, 10, "entry_point"), (4, 11, "dependency"), (4, 12, "dependency"),
    (4, 36, "dependency"), (4, 37, "dependency"),
    (5, 13, "entry_point"), (5, 14, "dependency"), (5, 15, "dependency"),
    (5, 38, "dependency"), (5, 28, "dependency"),
    (6, 16, "entry_point"), (6, 17, "dependency"), (6, 39, "dependency"),
    (7, 20, "entry_point"), (7, 21, "dependency"), (7, 22, "dependency"), (7, 23, "dependency"),
]


def seed():
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM service_ci"))
        conn.execute(text("DELETE FROM relationship"))
        conn.execute(text("DELETE FROM ci"))
        conn.execute(text("DELETE FROM service"))
        conn.commit()

        for svc in services:
            conn.execute(text(
                "INSERT INTO service (id, name, owner_team, sla_tier) VALUES (:id, :name, :owner_team, :sla_tier)"
            ), svc)

        for ci in cis:
            conn.execute(text(
                "INSERT INTO ci (id, name, type, provider, environment, team, labels) VALUES (:id, :name, :type, :provider, :environment, :team, CAST(:labels AS jsonb))"
            ), {**ci, "labels": json.dumps(ci.get("labels", {}))})

        for svc_idx, ci_idx, role in service_ci_map:
            conn.execute(text(
                "INSERT INTO service_ci (service_id, ci_id, role) VALUES (:sid, :cid, :role)"
            ), {"sid": services[svc_idx]["id"], "cid": cis[ci_idx]["id"], "role": role})

        for rel in relationships:
            conn.execute(text(
                "INSERT INTO relationship (source_id, target_id, type, discovered_by) VALUES (:source_id, :target_id, :type, 'manual')"
            ), {"source_id": cis[rel["source"]]["id"], "target_id": cis[rel["target"]]["id"], "type": rel["type"]})

        conn.commit()
    print(f"Seed data inserted: {len(services)} services, {len(cis)} CIs, {len(relationships)} relationships")


if __name__ == "__main__":
    seed()
