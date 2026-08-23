# Plan: LDAP / SSO Integration

**Impact: MEDIUM | Effort: LOW-MEDIUM (2-3 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Enterprise authentication via LDAP/Active Directory and SSO (SAML 2.0 / OIDC) for single sign-on and centralized user management.

## Current State
- No authentication
- No user management
- Single-user mode

## Design

### Supported Protocols
| Protocol | Use Case |
|----------|----------|
| LDAP/AD | Corporate directory sync |
| SAML 2.0 | Enterprise SSO (Okta, Azure AD) |
| OIDC | Modern SSO (Auth0, Keycloak) |

### User Sync
- LDAP: periodic sync of users and groups
- SAML/OIDC: JIT (Just-In-Time) provisioning
- Group -> Role mapping

## Implementation

### Backend
1. `core_platform/auth/ldap.py` (NEW) - LDAP client
   - `authenticate(username, password)` -> user info
   - `sync_users()` -> import from directory
   - `sync_groups()` -> import groups
2. `core_platform/auth/saml.py` (NEW) - SAML SP
   - `/auth/saml/acs` - assertion consumer
   - `/auth/saml/metadata` - SP metadata
3. `core_platform/auth/oidc.py` (NEW) - OIDC client
   - Authorization code flow
   - Token refresh
4. `core_platform/routers/auth.py` (NEW) - auth endpoints

### Frontend
5. `ui/src/pages/Login.tsx` (NEW) - login page with SSO buttons
6. `ui/src/components/SSOButton.tsx` (NEW) - SSO login button
7. `ui/src/contexts/AuthContext.tsx` (NEW) - auth state management

### Config
8. LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASS
9. SAML_IDP_URL, SAML_CERT, SAMLACS_URL
10. OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ISSUER

## Verification
1. LDAP login -> authenticated with directory credentials
2. SAML SSO -> redirected to IdP -> authenticated
3. New user JIT -> account created on first SSO login
4. Group sync -> roles assigned from directory groups
