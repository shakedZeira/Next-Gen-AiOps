# Plan: Horizontal Scalability

**Impact: MEDIUM | Effort: MEDIUM (3-4 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Support adding servers to increase capacity, enabling the platform to handle growing environments without vertical scaling limits.

## Current State
- Single-instance architecture (one of each service)
- Redis is single instance
- PostgreSQL is single instance
- No load balancing between instances

## Design

### Scalability Layers
| Component | Scaling Strategy |
|-----------|-----------------|
| UI (nginx) | Stateless, horizontal behind load balancer |
| API Gateway | Stateless, horizontal (httpx shared nothing) |
| Alert-NOC | Redis-backed, stateless, horizontal |
| Chatbot | Ollama can be multi-instance |
| Network-Sim | Stateful (in-memory), single instance |
| PostgreSQL | Read replicas + connection pooling (PgBouncer) |
| Redis | Redis Sentinel or Cluster |

## Implementation

### Backend
1. `docker-compose.scalable.yml` (NEW) - scalable compose overlay
   - Multiple api-gateway replicas
   - Multiple alert-noc replicas
   - PgBouncer connection pooler
   - Redis Sentinel (3 nodes)
2. `core_platform/health.py` - enhanced health checks for load balancer
3. Session affinity not required (JWT stateless)

### Infrastructure
4. Docker Compose profiles for single-node vs multi-node
5. Environment-based service discovery (DNS)
6. Shared Redis for all state

### Frontend
7. No changes needed (stateless, served by nginx)

## Verification
1. Scale api-gateway to 3 replicas -> requests distributed
2. Scale alert-noc to 2 replicas -> alerts still delivered via WS
3. Kill one replica -> others continue serving
4. Redis Sentinel failover -> service continues
