# Plan: SRE Operational Excellence (Fixes 38-46)

**Impact: HIGH | Effort: MEDIUM (3-4 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Production-ready operations: migrations, backup, graceful shutdown, CI/CD, DR.

## Current State
- No Alembic migrations (raw SQL only)
- No database backup
- No graceful shutdown
- No Docker Compose profiles
- No CI/CD Docker build
- No Loki/Tempo retention configs
- No Kubernetes manifests
- No secret rotation
- No DR documentation

## Implementation

### Fix 38: Alembic Schema Migrations
- File: `alembic/` (NEW directory)
- Initialize Alembic with async SQLAlchemy support
- Create initial migration from existing schema
- Add migration scripts for future changes
- Expected: `alembic upgrade head` applies all migrations

### Fix 39: PostgreSQL Backup Sidecar
- File: `docker-compose.yml`
- Add `postgres-backup` service:
  ```yaml
  postgres-backup:
    image: prodrigestivill/postgres-backup-local
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_DB=aiops
      - POSTGRES_USER=aiops
      - POSTGRES_PASSWORD=aiops
      - SCHEDULE=@daily
      - BACKUP_KEEP_DAYS=7
      - BACKUP_KEEP_WEEKS=4
    volumes:
      - ./backups:/backups
    depends_on:
      - postgres
  ```

### Fix 40: Graceful Shutdown
- File: `core_platform/main.py`
- Add signal handlers for SIGTERM/SIGINT
- Close database sessions
- Close Redis connections
- Drain in-flight requests
- Expected: No data loss on restart

### Fix 41: Docker Compose Profiles
- File: `docker-compose.yml`
- Add profiles:
  - `dev`: core services only (postgres, redis, api-gateway, ui)
  - `full`: all services including plugins
  - `monitoring`: otel-lgtm stack
- Expected: `docker compose --profile dev up` for development

### Fix 42: CI/CD Docker Build Job
- File: `.github/workflows/ci.yml`
- Add Docker build step after tests pass
- Build and push images to GitHub Container Registry
- Tag with commit SHA and `latest`
- Expected: `ghcr.io/next-gen-aiops/api-gateway:sha-abc123`

### Fix 43: Loki/Tempo Retention Configs
- File: `otel-lgtm/config/loki-config.yaml` (NEW)
```yaml
auth_enabled: false
server:
  http_listen_port: 3100
storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
schema_config:
  configs:
    - from: "2024-01-01"
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h
limits_config:
  retention_period: 7d
```

- File: `otel-lgtm/config/tempo-config.yaml` (NEW)
```yaml
server:
  http_listen_port: 3200
storage:
  trace:
    backend: local
    local:
      path: /tempo/traces
    wal:
      path: /tempo/wal
retention:
  traces: 7d
```

### Fix 44: Kubernetes Manifests
- File: `k8s/` (NEW directory)
- Create basic K8s manifests:
  - `deployment.yaml` — API gateway deployment
  - `service.yaml` — ClusterIP service
  - `configmap.yaml` — environment variables
  - `secret.yaml` — sensitive data
  - `ingress.yaml` — ingress with TLS
- Expected: `kubectl apply -f k8s/` deploys to cluster

### Fix 45: Secret Rotation Script
- File: `scripts/rotate-secrets.sh` (NEW)
```bash
#!/bin/bash
# Rotate PostgreSQL password
NEW_PASSWORD=$(openssl rand -base64 32)
kubectl create secret generic aiops-secrets \
  --from-literal=postgres-password=$NEW_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secrets
kubectl rollout restart deployment/api-gateway
```

### Fix 46: DR Documentation
- File: `docs/DISASTER_RECOVERY.md` (NEW)
- Recovery time objective (RTO): 1 hour
- Recovery point objective (RPO): 1 hour
- Backup restoration steps
- Database failover procedures
- Communication plan

## Files to Create/Modify
- `alembic/` — NEW: Alembic migrations
- `docker-compose.yml` — Fix 39: backup sidecar, Fix 41: profiles
- `core_platform/main.py` — Fix 40: graceful shutdown
- `.github/workflows/ci.yml` — Fix 42: Docker build
- `otel-lgtm/config/loki-config.yaml` — NEW: Fix 43
- `otel-lgtm/config/tempo-config.yaml` — NEW: Fix 43
- `k8s/` — NEW: Fix 44: K8s manifests
- `scripts/rotate-secrets.sh` — NEW: Fix 45
- `docs/DISASTER_RECOVERY.md` — NEW: Fix 46

## Verification
1. Run `alembic upgrade head` — migrations apply cleanly
2. Run `docker compose --profile dev up` — only core services start
3. Run `docker compose --profile full up` — all services start
4. Trigger SIGTERM → graceful shutdown in < 30s
5. Run `.github/workflows/ci.yml` → Docker images built and pushed
6. Run `kubectl apply -f k8s/` → deploys to cluster
7. Run `scripts/rotate-secrets.sh` → secrets rotated
