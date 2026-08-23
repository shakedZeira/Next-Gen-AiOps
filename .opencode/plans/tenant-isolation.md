# Plan: Tenant Isolation

**Impact: LOW | Effort: MEDIUM (3-4 days)**
**Status: NOT STARTED**
**Dependencies: Multi-tenancy (`multi-tenancy.md`), ABAC Permissions (`abac-permissions.md`)**

---

## Goal
Enforce strict data isolation between tenants at database, cache, and network levels to meet security and compliance requirements.

## Current State
- Single-tenant data model
- No isolation boundaries
- Shared Redis/cache without prefixing

## Design

### Isolation Layers
| Layer | Strategy |
|-------|----------|
| Database | Row-level security (RLS) policies |
| Cache | Redis key prefix per tenant |
| Network | Optional: separate Redis instances per tenant |
| File Storage | Tenant-prefixed directories |

### Isolation Guarantees
- Tenant A cannot read/write Tenant B data
- Cross-tenant queries blocked at ORM level
- Audit log tracks cross-tenant access attempts

## Implementation

### Backend
1. `core_platform/db/isolation.py` (NEW) - RLS enforcer
   - PostgreSQL RLS policies on all tables
   - `SET app.current_tenant = '{tenant_id}'` per connection
2. `aiops_shared/cache.py` - modify to prefix all Redis keys with tenant
3. `core_platform/auth/tenant_guard.py` (NEW) - middleware
   - Validate tenant access on every request
   - Log cross-tenant attempts

### Database
4. Migration: enable RLS on all tables
5. Create tenant isolation policies

## Verification
1. Tenant A query -> only Tenant A data returned
2. Tenant A tries to access Tenant B data -> 403
3. Redis keys prefixed -> no cross-tenant cache hits
4. Audit log shows blocked access attempts
