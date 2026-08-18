import json
import uuid
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://aiops:aiops@localhost:5432/aiops"
engine = create_engine(DATABASE_URL)

SEED_DATA = {
    "services": [
        {"id": str(uuid.uuid4()), "name": "E-Commerce Platform", "owner_team": "frontend", "sla_tier": "gold"},
        {"id": str(uuid.uuid4()), "name": "Payment Gateway", "owner_team": "payments", "sla_tier": "gold"},
        {"id": str(uuid.uuid4()), "name": "Inventory Service", "owner_team": "backend", "sla_tier": "silver"},
        {"id": str(uuid.uuid4()), "name": "Notification Service", "owner_team": "platform", "sla_tier": "bronze"},
    ],
    "cis": [
        {"id": str(uuid.uuid4()), "name": "nginx-lb-1", "type": "load_balancer", "provider": "aws", "environment": "prod", "labels": {"app": "nginx", "tier": "frontend"}},
        {"id": str(uuid.uuid4()), "name": "web-server-1", "type": "host", "provider": "aws", "environment": "prod", "labels": {"app": "ecommerce", "tier": "frontend"}},
        {"id": str(uuid.uuid4()), "name": "web-server-2", "type": "host", "provider": "aws", "environment": "prod", "labels": {"app": "ecommerce", "tier": "frontend"}},
        {"id": str(uuid.uuid4()), "name": "api-gateway-ci", "type": "api_gateway", "provider": "aws", "environment": "prod", "labels": {"app": "api-gateway", "tier": "backend"}},
        {"id": str(uuid.uuid4()), "name": "postgres-payments", "type": "database", "provider": "aws", "environment": "prod", "labels": {"app": "payments", "tier": "data"}},
        {"id": str(uuid.uuid4()), "name": "redis-cache", "type": "cache", "provider": "aws", "environment": "prod", "labels": {"app": "redis", "tier": "data"}},
        {"id": str(uuid.uuid4()), "name": "kafka-broker-1", "type": "message_queue", "provider": "aws", "environment": "prod", "labels": {"app": "kafka", "tier": "messaging"}},
        {"id": str(uuid.uuid4()), "name": "payment-processor-1", "type": "microservice", "provider": "aws", "environment": "prod", "labels": {"app": "payments", "tier": "backend"}},
        {"id": str(uuid.uuid4()), "name": "inventory-db", "type": "database", "provider": "aws", "environment": "prod", "labels": {"app": "inventory", "tier": "data"}},
        {"id": str(uuid.uuid4()), "name": "notification-svc", "type": "microservice", "provider": "aws", "environment": "prod", "labels": {"app": "notifications", "tier": "backend"}},
    ],
    "relationships": [
        {"source": 0, "target": 1, "type": "depends_on"},
        {"source": 1, "target": 3, "type": "depends_on"},
        {"source": 3, "target": 4, "type": "depends_on"},
        {"source": 3, "target": 5, "type": "depends_on"},
        {"source": 3, "target": 6, "type": "depends_on"},
        {"source": 6, "target": 7, "type": "depends_on"},
        {"source": 7, "target": 4, "type": "depends_on"},
        {"source": 6, "target": 8, "type": "depends_on"},
        {"source": 6, "target": 9, "type": "depends_on"},
    ],
}


def seed():
    with engine.connect() as conn:
        for svc in SEED_DATA["services"]:
            conn.execute(text(
                "INSERT INTO service (id, name, owner_team, sla_tier) VALUES (:id, :name, :owner_team, :sla_tier) ON CONFLICT (name) DO NOTHING"
            ), svc)

        for ci in SEED_DATA["cis"]:
            conn.execute(text(
                "INSERT INTO ci (id, name, type, provider, environment, labels) VALUES (:id, :name, :type, :provider, :environment, :labels::jsonb)"
            ), {**ci, "labels": json.dumps(ci.get("labels", {}))})

        cis = SEED_DATA["cis"]
        svcs = SEED_DATA["services"]
        conn.execute(text("INSERT INTO service_ci (service_id, ci_id, role) VALUES (:sid, :cid, :role)"), {"sid": svcs[0]["id"], "cid": cis[0]["id"], "role": "entry_point"})
        conn.execute(text("INSERT INTO service_ci (service_id, ci_id, role) VALUES (:sid, :cid, :role)"), {"sid": svcs[0]["id"], "cid": cis[1]["id"], "role": "dependency"})
        conn.execute(text("INSERT INTO service_ci (service_id, ci_id, role) VALUES (:sid, :cid, :role)"), {"sid": svcs[1]["id"], "cid": cis[4]["id"], "role": "entry_point"})

        for rel in SEED_DATA["relationships"]:
            conn.execute(text(
                "INSERT INTO relationship (source_id, target_id, type, discovered_by) VALUES (:source_id, :target_id, :type, 'manual')"
            ), {"source_id": cis[rel["source"]]["id"], "target_id": cis[rel["target"]]["id"], "type": rel["type"]})

        conn.commit()
    print("Seed data inserted successfully!")


if __name__ == "__main__":
    seed()
