from __future__ import annotations
import os


DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://aiops:aiops@postgres:5432/aiops",
)
CMDB_API_URL = os.environ.get("CMDB_API_URL", "http://api-gateway:8000")
REDIS_URL = os.environ.get("REDIS_URL", "redis://:changeme@redis:6379/0")
