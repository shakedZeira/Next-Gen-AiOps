# Plan: High Availability (HA)

**Impact: LOW | Effort: HIGH (5+ days)**
**Status: NOT STARTED**
**Dependencies: Active/Active (`active-active.md`), Horizontal Scalability (`horizontal-scalability.md`)**

---

## Goal
Eliminate single points of failure across all system components for 99.99% uptime SLA.

## Current State
- Single-instance for all services
- Single PostgreSQL, single Redis
- Any component failure = platform down

## Design

### HA Components
| Component | HA Strategy | Min Instances |
|-----------|-------------|---------------|
| API Gateway | Active/Active | 2 |
| Alert-NOC | Active/Active | 2 |
| Chatbot | Active/Active | 2 |
| PostgreSQL | Primary + Replica + PgBouncer | 3 |
| Redis | Sentinel (3 nodes) | 3 |
| Ollama | Load balanced | 2 |

### Health Checks
- Liveness: `/health` endpoint (200 OK)
- Readiness: `/ready` endpoint (dependencies OK)
- Auto-restart on failure (Docker healthcheck)

## Implementation

### Backend
1. Enhanced health endpoints on all services
2. Graceful shutdown handling
3. Connection pool management

### Infrastructure
4. Docker Compose with replicas and healthchecks
5. PgBouncer for connection pooling
6. Redis Sentinel for automatic failover

## Verification
1. Kill API Gateway instance -> second continues
2. Kill PostgreSQL primary -> replica promoted
3. Kill Redis master -> Sentinel promotes replica
4. All services recover without manual intervention
