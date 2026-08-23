# Plan: Kubernetes Integration

**Impact: MEDIUM | Effort: MEDIUM (3-4 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Deploy and manage the platform on Kubernetes, and provide visibility into K8s cluster state (pods, deployments, services) within the topology.

## Current State
- Docker Compose deployment only
- No K8s manifest or Helm chart
- No K8s cluster visibility in CMDB

## Design

### K8s Deployment
- Helm chart for platform deployment
- ConfigMaps/Secrets for configuration
- Ingress for external access
- PersistentVolumes for PostgreSQL/Redis

### K8s Visibility
- Import K8s resources as CIs in CMDB
- Map pod status to alert states
- Show K8s services in topology

## Implementation

### Backend
1. `plugins/k8s_collector/collector.py` (NEW) - K8s API client
   - Watch pods, services, deployments
   - Map to CMDB CIs
   - Status -> alert mapping
2. `plugins/k8s_collector/router.py` (NEW) - K8s API proxy

### Helm Chart
3. `helm/nextgen-aiops/Chart.yaml` (NEW)
4. `helm/nextgen-aiops/values.yaml` (NEW)
5. `helm/nextgen-aiops/templates/` (NEW) - deployment, service, ingress

### Frontend
6. `ui/src/pages/K8sOverview.tsx` (NEW) - K8s cluster view
7. `ui/src/pages/CMDBExplorer.tsx` - K8s CI type badges

## Verification
1. Deploy via Helm chart -> all pods running
2. K8s CIs appear in CMDB topology
3. Pod crash -> alert generated
4. K8s services shown in topology graph
