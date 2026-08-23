# Plan: ABAC Permissions

**Impact: LOW | Effort: MEDIUM (3-4 days)**
**Status: NOT STARTED**
**Dependencies: Multi-tenancy (`multi-tenancy.md`)**

---

## Goal
Attribute-Based Access Control (ABAC) for fine-grained authorization beyond RBAC, allowing policies based on user attributes, resource attributes, and environment conditions.

## Current State
- No authentication/authorization system
- Single-user mode
- No access control

## Design

### ABAC Policy Model
```
ALLOW action IF:
  user.role == "operator"
  AND resource.team == user.team
  AND environment.time BETWEEN 09:00-17:00
```

### Policy Attributes
| Category | Attributes |
|----------|-----------|
| User | role, team, clearance_level, shift |
| Resource | owner, severity, service, classification |
| Environment | time, ip_address, location |

## Implementation

### Backend
1. `core_platform/auth/abac.py` (NEW) - policy engine
   - `evaluate(user, resource, action, env)` -> allow/deny
   - JSON-based policy definitions
   - Policy cache in Redis (5 min TTL)
2. `core_platform/auth/policies.py` (NEW) - policy store
   - CRUD for ABAC policies
   - Default policies for common scenarios
3. `core_platform/auth/middleware.py` (NEW) - auth middleware
   - Extract user from JWT
   - Evaluate ABAC policy per request

### Frontend
4. `ui/src/pages/PolicyManager.tsx` (NEW) - policy editor
5. `ui/src/components/AccessDenied.tsx` (NEW) - denied overlay

## Verification
1. Operator can view alerts but not delete
2. Team member can only see their team's services
3. After-hours access denied for non-oncall
4. Policy change -> immediate effect
