# Plan: CI/CD Integrations (BitBucket, JFrog, WoodPecker)

**Impact: LOW | Effort: LOW-MEDIUM (2 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Integrate with CI/CD platforms to correlate code changes, artifacts, and deployments with operational events.

## Current State
- No CI/CD visibility
- Code changes not linked to alerts
- No artifact tracking

## Design

### Supported Platforms
| Platform | Integration Type |
|----------|-----------------|
| BitBucket | Webhook + REST API |
| JFrog Artifactory | REST API for artifact queries |
| WoodPecker CI | Webhook for build events |

### Data Collected
- Build status (success/failure)
- Artifact versions
- Commit-to-deploy traceability

## Implementation

### Backend
1. `plugins/integrations/cicd.py` (NEW) - unified CI/CD client
   - `BitBucketClient` - PR/build webhooks
   - `JFrogClient` - artifact queries
   - `WoodPeckerClient` - build status
2. `plugins/integrations/router.py` - add CI/CD endpoints
   - `GET /api/v1/integrations/cicd/builds` - recent builds
   - `POST /api/v1/integrations/cicd/webhook` - receive webhooks

### Frontend
3. `ui/src/components/CIBuildStatus.tsx` (NEW) - build status indicator
4. `ui/src/pages/IncidentDetail.tsx` - build events in timeline

## Verification
1. BitBucket webhook -> build status in platform
2. JFrog artifact query -> version info displayed
3. Failed build -> correlated with deployment alert
