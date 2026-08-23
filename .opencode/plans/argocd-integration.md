# Plan: Argo CD Integration

**Impact: LOW | Effort: LOW-MEDIUM (2 days)**
**Status: NOT STARTED**
**Dependencies: Kubernetes Integration (`kubernetes-integration.md`)**

---

## Goal
Display Argo CD application status and deployment history in the platform, and correlate deployments with alerts.

## Current State
- No Argo CD visibility
- Deployment changes not tracked
- No correlation between deploys and alerts

## Design

### Integration Points
- Argo CD REST API for application status
- Webhook receiver for deployment events
- Correlate deploy events with alert timeline

## Implementation

### Backend
1. `plugins/integrations/argocd.py` (NEW) - Argo CD client
   - `get_applications()` -> list apps with status
   - `get_application(name)` -> detailed status
   - `handle_webhook(event)` -> process deployment event
2. `plugins/integrations/router.py` - add Argo CD endpoints

### Frontend
3. `ui/src/components/ArgoCDApps.tsx` (NEW) - application status grid
4. `ui/src/pages/IncidentDetail.tsx` - deployment events in timeline

## Verification
1. Argo CD apps listed with sync status
2. Deployment event appears in incident timeline
3. Failed deploy -> correlated alert highlighted
