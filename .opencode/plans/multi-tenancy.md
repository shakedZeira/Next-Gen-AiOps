# Plan: Multi-domain / Tenants

**Impact: LOW | Effort: HIGH (5+ days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Support multiple independent organizational domains (tenants) within a single deployment, each with isolated data, users, and configurations.

## Current State
- Single-tenant architecture
- All data shared across all users
- No organizational boundary isolation

## Design

### Tenant Model
- Each tenant has its own CIs, alerts, incidents, users
- Tenant ID on all database tables (row-level isolation)
- Shared infrastructure (PostgreSQL, Redis) with tenant prefix

### Tenant Admin
- Tenant admin manages users, roles, service ownership
- Super-admin can create/modify tenants
- Tenant-scoped API keys

## Implementation

### Backend
1. `core_platform/db/tenant.py` (NEW) - tenant context middleware
   - Set tenant_id from JWT token
   - All queries automatically filtered by tenant
2. `core_platform/routers/tenants.py` (NEW) - tenant CRUD
3. Database migration: add `tenant_id` to all tables
4. Redis key prefix: `{tenant_id}:alerts:*`

### Frontend
5. `ui/src/components/TenantSelector.tsx` (NEW) - tenant switcher (admin only)
6. All pages scoped to current tenant

## Verification
1. Create tenant A and B -> data isolated
2. User in tenant A cannot see tenant B alerts
3. Tenant admin manages only their users
