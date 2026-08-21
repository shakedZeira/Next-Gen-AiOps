"""Seed change records for change-aware correlation demo."""

import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import text

from aiops_shared.database import engine

CHANGES = [
    # Payment Gateway
    {"service": "Payment Gateway", "type": "deployment", "description": "Deployed payment-gateway v2.14.3 — added retry logic for Stripe webhook failures", "author": "sre-bot@company.com", "status": "successful"},
    {"service": "Payment Gateway", "type": "config", "description": "Increased DB connection pool from 50 to 75 for payment-service", "author": "ops@company.com", "status": "successful"},
    {"service": "Payment Gateway", "type": "deployment", "description": "Rollback payment-gateway to v2.14.1 due to elevated error rates", "author": "sre-bot@company.com", "status": "rolled_back"},
    {"service": "Payment Gateway", "type": "infrastructure", "description": "Scaled payment-gateway pods from 3 to 5 replicas", "author": "auto-scaler", "status": "successful"},
    {"service": "Payment Gateway", "type": "config", "description": "Updated TLS certificate for payment-gateway ingress", "author": "cert-manager", "status": "successful"},

    # E-Commerce Platform
    {"service": "E-Commerce Platform", "type": "deployment", "description": "Deployed e-commerce v3.8.0 — new cart service with Redis caching", "author": "ci-pipeline@company.com", "status": "successful"},
    {"service": "E-Commerce Platform", "type": "deployment", "description": "Deployed e-commerce v3.8.1 — hotfix for cart session loss", "author": "ci-pipeline@company.com", "status": "successful"},
    {"service": "E-Commerce Platform", "type": "config", "description": "Increased nginx worker_connections from 1024 to 4096", "author": "ops@company.com", "status": "successful"},
    {"service": "E-Commerce Platform", "type": "infrastructure", "description": "Migrated e-commerce database to r6g.xlarge instances", "author": "infra-team@company.com", "status": "successful"},
    {"service": "E-Commerce Platform", "type": "deployment", "description": "Deployed e-commerce v3.7.9 — failed health checks, auto-rollback triggered", "author": "ci-pipeline@company.com", "status": "failed"},

    # Notification Service
    {"service": "Notification Service", "type": "deployment", "description": "Deployed notification-svc v1.12.0 — added SMS provider failover", "author": "ci-pipeline@company.com", "status": "successful"},
    {"service": "Notification Service", "type": "config", "description": "Updated SendGrid API key rotation", "author": "security@company.com", "status": "successful"},
    {"service": "Notification Service", "type": "infrastructure", "description": "Increased SQS visibility timeout from 30s to 300s", "author": "ops@company.com", "status": "successful"},

    # Inventory Service
    {"service": "Inventory Service", "type": "deployment", "description": "Deployed inventory-service v2.5.0 — new stock reconciliation job", "author": "ci-pipeline@company.com", "status": "successful"},
    {"service": "Inventory Service", "type": "config", "description": "Increased Elasticsearch heap from 4g to 8g", "author": "ops@company.com", "status": "successful"},
    {"service": "Inventory Service", "type": "infrastructure", "description": "Added 500GB EBS volume to inventory-elastic-1", "author": "infra-team@company.com", "status": "successful"},

    # Auth Service
    {"service": "Auth Service", "type": "deployment", "description": "Deployed auth-service v4.2.0 — migrated from JWT to opaque tokens", "author": "ci-pipeline@company.com", "status": "successful"},
    {"service": "Auth Service", "type": "config", "description": "Rotated OAuth2 client secrets for all downstream services", "author": "security@company.com", "status": "successful"},
    {"service": "Auth Service", "type": "deployment", "description": "Deployed auth-service v4.1.8 — fixed token refresh race condition", "author": "ci-pipeline@company.com", "status": "successful"},

    # Search Service
    {"service": "Search Service", "type": "deployment", "description": "Deployed search-service v1.7.0 — added fuzzy matching for product queries", "author": "ci-pipeline@company.com", "status": "successful"},
    {"service": "Search Service", "type": "config", "description": "Updated Elasticsearch index refresh_interval from 1s to 5s", "author": "ops@company.com", "status": "successful"},

    # API Gateway (internal)
    {"service": "API Gateway", "type": "deployment", "description": "Deployed api-gateway v2.0.0 — new rate limiting middleware", "author": "ci-pipeline@company.com", "status": "successful"},
    {"service": "API Gateway", "type": "config", "description": "Updated rate limit from 1000 to 500 req/min per client", "author": "ops@company.com", "status": "successful"},
    {"service": "API Gateway", "type": "infrastructure", "description": "Added WAF rules for SQL injection protection", "author": "security@company.com", "status": "successful"},

    # Order Processing
    {"service": "Order Processing", "type": "deployment", "description": "Deployed order-processor v3.1.0 — async order validation pipeline", "author": "ci-pipeline@company.com", "status": "successful"},
    {"service": "Order Processing", "type": "config", "description": "Increased Kafka consumer group concurrency from 4 to 8", "author": "ops@company.com", "status": "successful"},
    {"service": "Order Processing", "type": "deployment", "description": "Deployed order-processor v3.0.9 — fixed deadlock in order state machine", "author": "ci-pipeline@company.com", "status": "successful"},
]


async def seed_changes():
    """Seed change records with realistic timestamps spread over the last 24 hours."""
    now = datetime.utcnow()

    async with engine.begin() as conn:
        for i, change in enumerate(CHANGES):
            # Spread changes: most recent ones within last 30 min (correlatable),
            # older ones spread over 24 hours
            if i < 8:
                # Recent (last 5-25 minutes) — these should correlate with alerts
                minutes_ago = random.randint(5, 25)
            elif i < 18:
                # Medium age (30 min - 6 hours)
                minutes_ago = random.randint(30, 360)
            else:
                # Old (6-24 hours)
                minutes_ago = random.randint(360, 1440)

            ts = now - timedelta(minutes=minutes_ago)
            await conn.execute(
                text("""
                    INSERT INTO "change" (id, service, type, description, author, status, metadata, timestamp, created_at)
                    VALUES (:id, :service, :type, :description, :author, :status, :metadata, :timestamp, :created_at)
                    ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id": str(uuid.uuid4()),
                    "service": change["service"],
                    "type": change["type"],
                    "description": change["description"],
                    "author": change["author"],
                    "status": change["status"],
                    "metadata": "{}",
                    "timestamp": ts,
                    "created_at": ts,
                },
            )
    print(f"Seeded {len(CHANGES)} change records")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_changes())
