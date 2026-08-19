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
]

# Index reference:
# 0: nginx-lb-1          1: web-server-1        2: web-server-2
# 3: api-gateway-ci      4: postgres-payments   5: redis-cache
# 6: kafka-broker-1      7: payment-processor   8: inventory-db
# 9: notification-svc    10: order-api          11: order-service
# 12: order-db           13: analytics-api      14: clickhouse-db
# 15: s3-data-lake       16: auth-api           17: postgres-auth
# 18: notification-db    19: analytics-ui

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
]

service_ci_map = [
    (0, 0, "entry_point"), (0, 1, "dependency"), (0, 2, "dependency"), (0, 3, "dependency"),
    (1, 4, "entry_point"), (1, 7, "dependency"),
    (2, 8, "entry_point"),
    (3, 9, "entry_point"), (3, 18, "dependency"),
    (4, 10, "entry_point"), (4, 11, "dependency"), (4, 12, "dependency"),
    (5, 13, "entry_point"), (5, 14, "dependency"), (5, 15, "dependency"),
    (6, 16, "entry_point"), (6, 17, "dependency"),
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
