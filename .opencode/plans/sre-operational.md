# Plan: SRE Operational Excellence

## Goal
Fix 10 operational gaps: migrations, CI/CD, backup, graceful shutdown, log retention, seed idempotency, compose profiles, K8s manifests, secret rotation, DR.

---

## Fix 38: Alembic Schema Migrations

### Problem
No migration tool. Schema changes require deleting the volume and re-seeding.

### Files
New: `alembic/`, `alembic.ini`
Modified: `pyproject.toml`

### Fix
Initialize Alembic with async SQLAlchemy:

```bash
# In the api-gateway container
pip install alembic
alembic init alembic
```

**`alembic.ini`:**
```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+asyncpg://aiops:aiops@postgres:5432/aiops
```

**`alembic/env.py`:**
```python
import asyncio
from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from aiops_shared.models import Base  # Import all models

config = context.config
target_metadata = Base.metadata

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    connectable = create_async_engine(config.get_main_option("sqlalchemy.url"))
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

**Create initial migration:**
```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

### Verification
- `alembic current` shows current revision
- `alembic history` shows migration chain
- Adding a new column: `alembic revision --autogenerate -m "add feature_x"` then `alembic upgrade head`

---

## Fix 39: Database Backup Sidecar

### Problem
`postgres_data` is a named Docker volume with no backup. Losing it means losing all data.

### Files
New: `docker-compose.backup.yml`
Modified: `docker-compose.yml`

### Fix
Add a backup sidecar service:

```yaml
# docker-compose.backup.yml
services:
  postgres-backup:
    image: postgres:16
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PGPASSWORD: ${POSTGRES_PASSWORD:-aiops}
      POSTGRES_HOST: postgres
      POSTGRES_DB: aiops
      POSTGRES_USER: aiops
      BACKUP_RETENTION_DAYS: 7
    volumes:
      - backup_data:/backups
    command: >
      sh -c 'while true; do
        echo "Starting backup at $$(date)";
        pg_dump -h postgres -U aiops -d aiops | gzip > /backups/aiops_$$(date +%Y%m%d_%H%M%S).sql.gz;
        echo "Backup completed at $$(date)";
        # Cleanup old backups
        find /backups -name "*.sql.gz" -mtime +$$BACKUP_RETENTION_DAYS -delete;
        sleep 3600;
      done'

volumes:
  backup_data:
```

**Add to main docker-compose.yml:**
```yaml
postgres-backup:
  profiles: ["backup"]
  image: postgres:16
  # ... (reference backup compose file)
```

### Verification
- `docker compose --profile backup up -d` starts backup service
- Backups appear in `backup_data` volume
- Old backups (> 7 days) are automatically deleted

---

## Fix 40: Graceful Shutdown

### Problem
Background task services don't wait for tasks to complete or flush OTel data on shutdown.

### Files
`plugins/generator/main.py`, `plugins/infra_simulator/main.py`, `plugins/agent_monitor/main.py`

### Fix
Improve lifespan handler:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    global running
    running = True
    
    # Start background task
    task = asyncio.create_task(generate_traffic())
    
    yield
    
    # Graceful shutdown
    running = False
    task.cancel()
    try:
        await task  # Wait for task to complete
    except asyncio.CancelledError:
        pass
    
    # Flush OTel data
    from opentelemetry import trace
    provider = trace.get_tracer_provider()
    if hasattr(provider, 'shutdown'):
        provider.shutdown()
    
    logger.info("Service shut down gracefully")
```

### Verification
- `docker compose stop generator` → logs show "Service shut down gracefully"
- No "task was destroyed but it is pending" warnings
- OTel spans are flushed before shutdown

---

## Fix 41: Docker Compose Profiles

### Problem
All 12 services start with `docker compose up`. Ollama downloads multi-GB models, generators create noise, no lightweight dev mode.

### File
`docker-compose.yml`

### Fix
Add profiles:

```yaml
services:
  # Core services (always start)
  postgres:
    # ... no profile
  redis:
    # ... no profile
  api-gateway:
    # ... no profile
  ui:
    # ... no profile
  chatbot:
    # ... no profile
  
  # Monitoring services
  alert-noc:
    profiles: ["full", "monitoring"]
  agent-monitor:
    profiles: ["full", "monitoring"]
  
  # AI services
  ollama:
    profiles: ["full", "ai"]
  rca-engine:
    profiles: ["full", "ai"]
  
  # Simulation services
  generator:
    profiles: ["full", "sim"]
  infra-simulator:
    profiles: ["full", "sim"]
  
  # Observability
  otel-lgtm:
    profiles: ["full", "observability"]
```

**Usage:**
```bash
# Lightweight dev mode (core only)
docker compose up -d

# Full stack
docker compose --profile full up -d

# Just core + AI
docker compose --profile ai up -d
```

### Verification
- `docker compose up -d` starts only 5 core services
- `docker compose --profile full up -d` starts all 12 services
- No model download in dev mode

---

## Fix 42: CI/CD Docker Build

### Problem
GitHub Actions CI runs lint/test but doesn't build Docker images.

### File
`.github/workflows/ci.yml`

### Fix
Add Docker build step:

```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Build API Gateway
        uses: docker/build-push-action@v5
        with:
          context: .
          file: core_platform/Dockerfile.core
          push: false
          tags: nextgen-aiops/api-gateway:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build UI
        uses: docker/build-push-action@v5
        with:
          context: ./ui
          push: false
          tags: nextgen-aiops/ui:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build Chatbot
        uses: docker/build-push-action@v5
        with:
          context: .
          file: plugins/chatbot/Dockerfile
          push: false
          tags: nextgen-aiops/chatbot:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Verification
- CI pipeline shows green Docker build steps
- Images are built successfully
- Build cache reduces subsequent build times

---

## Fix 43: Log Retention Configuration

### Problem
Loki and Tempo consume disk indefinitely with no retention policy.

### Files
New: `otel-lgtm/config/loki-config.yaml`, `otel-lgtm/config/tempo-config.yaml`

### Fix
Add retention configs:

**Loki retention:**
```yaml
limits_config:
  retention_period: 720h  # 30 days
  max_query_series: 5000

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
  filesystem:
    directory: /loki/chunks

chunk_store_config:
  max_look_back_period: 720h
```

**Tempo retention:**
```yaml
metrics_generator:
  ring:
    kvstore:
      store: inmemory

storage:
  trace:
    backend: local
    local:
      path: /tempo/traces
    wal:
      path: /tempo/wal

overrides:
  defaults:
    retention: 720h  # 30 days
```

### Verification
- Grafana LGTM disk usage stays bounded
- Traces older than 30 days are automatically cleaned up
- No query errors due to missing data

---

## Fix 44: Kubernetes Manifests

### Problem
No path to production deployment. Docker Compose is fine for dev but not production.

### Files
New: `k8s/` directory with basic manifests

### Fix
Create minimal K8s manifests:

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: aiops

# k8s/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: aiops
spec:
  replicas: 1
  serviceName: postgres
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: aiops
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: aiops-secrets
              key: postgres-user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: aiops-secrets
              key: postgres-password
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi

# k8s/api-gateway.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: aiops
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: nextgen-aiops/api-gateway:latest
        ports:
        - containerPort: 8000
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: aiops
spec:
  selector:
    app: api-gateway
  ports:
  - port: 80
    targetPort: 8000
  type: LoadBalancer

# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: aiops-secrets
  namespace: aiops
type: Opaque
stringData:
  postgres-user: aiops
  postgres-password: changeme
  jwt-secret: minimum-32-characters-for-jwt-secret-key
  redis-password: changeme
```

**`k8s/kustomization.yaml`:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - namespace.yaml
  - secret.yaml
  - postgres.yaml
  - api-gateway.yaml
  - service.yaml
```

### Verification
- `kubectl apply -k k8s/` deploys the stack
- `kubectl get pods -n aiops` shows all pods running
- `kubectl get svc -n aiops` shows services

---

## Fix 45: Secret Rotation

### Problem
JWT secret, DB password, Redis password are static with no rotation mechanism.

### Files
New: `scripts/rotate-secrets.sh`

### Fix
Create a rotation script:

```bash
#!/bin/bash
# scripts/rotate-secrets.sh

set -e

echo "=== Secret Rotation Script ==="
echo "This script rotates secrets for the AiOps platform."
echo ""

# Generate new secrets
NEW_JWT_SECRET=$(openssl rand -hex 32)
NEW_REDIS_PASSWORD=$(openssl rand -hex 16)
NEW_POSTGRES_PASSWORD=$(openssl rand -hex 16)

echo "New JWT secret: ${NEW_JWT_SECRET:0:8}...${NEW_JWT_SECRET: -8}"
echo "New Redis password: ${NEW_REDIS_PASSWORD:0:4}****"
echo "New Postgres password: ${NEW_POSTGRES_PASSWORD:0:4}****"
echo ""

read -p "Apply new secrets? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Update .env file
sed -i "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$NEW_JWT_SECRET/" .env
sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$NEW_REDIS_PASSWORD/" .env
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_POSTGRES_PASSWORD/" .env

# Update Redis password
docker compose exec redis redis-cli -a "$OLD_REDIS_PASSWORD" CONFIG SET requirepass "$NEW_REDIS_PASSWORD"

# Update Postgres password
docker compose exec postgres psql -U aiops -c "ALTER USER aiops WITH PASSWORD '$NEW_POSTGRES_PASSWORD';"

# Restart services
docker compose restart api-gateway chatbot alert-noc

echo "Secrets rotated successfully!"
echo "Remember to update any external systems that use these credentials."
```

### Verification
- Script runs without errors
- All services restart and connect with new credentials
- Old credentials no longer work

---

## Fix 46: DR Documentation

### Problem
No disaster recovery plan. Losing the Docker host means losing everything.

### Files
New: `docs/DISASTER_RECOVERY.md`

### Fix
Document DR procedures:

```markdown
# Disaster Recovery Plan

## Backup Strategy
- **Database**: Automated daily backups via `postgres-backup` sidecar
- **Redis**: Snapshot every 15 minutes to `redis_data` volume
- **Configuration**: All config in version control (Git)
- **Secrets**: Documented in password manager

## Recovery Procedures

### Database Recovery
1. List available backups: `docker compose exec postgres-backup ls /backups/`
2. Restore from backup: `gunzip < /backups/aiops_YYYYMMDD_HHMMSS.sql.gz | docker compose exec -T postgres psql -U aiops -d aiops`

### Full Stack Recovery
1. Clone repository: `git clone <repo-url>`
2. Copy `.env` file from password manager
3. Pull images: `docker compose pull`
4. Start stack: `docker compose --profile full up -d`
5. Verify health: `curl http://localhost:8000/health`

### Redis Recovery
- Redis data is ephemeral (approval states, alert cache)
- After restart, alerts regenerate from generator
- Approval states are lost (users must re-approve)

## RTO/RPO Targets
- **RTO** (Recovery Time Objective): 15 minutes
- **RPO** (Recovery Point Objective): 24 hours (daily backups)

## Monitoring
- Backup success: Check `postgres-backup` container logs
- Backup age: Alert if no backup in last 25 hours
```

### Verification
- DR doc exists and is accurate
- Recovery procedure can be followed step-by-step
- RTO/RPO targets are realistic

---

## Execution Order

All 9 fixes are independent. Execute in parallel:
38. Alembic migrations
39. Database backup sidecar
40. Graceful shutdown
41. Docker compose profiles
42. CI/CD Docker build
43. Log retention
44. K8s manifests
45. Secret rotation
46. DR documentation

### Final Step: Rebuild & Verify
```bash
docker compose --profile full build
docker compose --profile full up -d
```
