# Plan: Certificate Management

**Impact: LOW | Effort: LOW-MEDIUM (1-2 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Track SSL/TLS certificates across all services and devices, monitor expiration, and alert before certificates expire.

## Current State
- No certificate visibility
- Certificates managed manually
- No expiration monitoring

## Design

### Certificate Tracking
- Import certificates from devices (SNMP, API)
- Track: issuer, subject, SAN, expiry, serial
- Auto-discover via TLS handshake

### Alert Rules
- Certificates expiring in 30 days -> warning
- Certificates expiring in 7 days -> critical
- Expired certificates -> critical

## Implementation

### Backend
1. `core_platform/certificates.py` (NEW) - cert manager
   - `check_certificates()` - scan all tracked certs
   - `import_from_device(ip, port)` - TLS handshake + import
   - `alert_expiring()` - generate alerts for expiring certs
2. `core_platform/routers/certificates.py` (NEW) - API
   - `GET /api/v1/certificates` - list all certs
   - `POST /api/v1/certificates/check` - trigger check
3. Background task: daily certificate check

### Frontend
4. `ui/src/pages/CertificateManager.tsx` (NEW) - cert list with expiry status
5. `ui/src/api/client.ts` - certificatesAPI

## Verification
1. Import cert -> appears in list with expiry date
2. Cert expiring in 5 days -> critical alert
3. Expired cert -> critical alert with "expired" badge
4. Daily check runs automatically
