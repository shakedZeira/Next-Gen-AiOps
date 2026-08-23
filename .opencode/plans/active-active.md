# Plan: Active/Active Deployment

**Impact: LOW | Effort: HIGH (5+ days)**
**Status: NOT STARTED**
**Dependencies: Horizontal Scalability (`horizontal-scalability.md`)**

---

## Goal
Run multiple active instances simultaneously across availability zones for high throughput and zero-downtime deployments.

## Current State
- Single-instance architecture
- No multi-AZ support
- Deployment requires downtime

## Design

### Active/Active Pattern
- Multiple API gateway instances behind DNS load balancer
- Each instance handles full request volume
- Shared PostgreSQL with read replicas
- Redis Cluster for shared state

### Conflict Resolution
- Alert state changes via Redis (last-writer-wins)
- PostgreSQL transactions for CI changes
- Idempotent operations

## Implementation

### Backend
1. `docker-compose.active-active.yml` (NEW) - multi-AZ compose
2. DNS-based load balancing (Route53 or Cloudflare)
3. Health-check based routing

### Infrastructure
4. PostgreSQL streaming replication (primary + 2 replicas)
5. Redis Cluster (3 masters, 3 replicas)
6. Cross-AZ networking

### Frontend
7. No changes (stateless)

## Verification
1. Two instances running -> requests distributed
2. Kill instance A -> instance B continues
3. Deploy to instance A -> no downtime
4. Database failover -> service continues
