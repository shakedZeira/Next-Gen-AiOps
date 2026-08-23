# Plan: Ticketing Integration (Jira)

**Impact: MEDIUM | Effort: LOW-MEDIUM (2-3 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Create and link Jira tickets from alerts/incidents for formal incident management tracking.

## Current State
- Alerts managed in NOC console only
- No external ticketing system integration
- No way to track resolution in Jira

## Design

### Integration Flow
Alert fires -> Operator clicks "Create Jira Ticket" -> System creates ticket via Jira REST API -> Ticket key stored on alert -> bidirectional sync (comment/status)

### Jira Ticket Fields
| Field | Source |
|-------|--------|
| Summary | Alert/incident title |
| Description | Full alert details + topology context |
| Priority | Severity mapping (critical=P1, high=P2, medium=P3, low=P4) |
| Labels | service, team, severity |
| Assignee | Team lead from service ownership |
| Components | Service name |

## Implementation

### Backend
1. `plugins/integrations/jira.py` (NEW) - Jira REST API client (httpx)
   - `create_ticket(alert, service_info)` -> Jira key
   - `add_comment(jira_key, comment)`
   - `update_status(jira_key, status)`
   - Config: JIRA_URL, JIRA_USER, JIRA_TOKEN (env vars)
2. `plugins/integrations/router.py` (NEW) - API endpoints
   - `POST /api/v1/integrations/jira/create` - create ticket from alert
   - `POST /api/v1/integrations/jira/{key}/comment` - add comment
3. Wire into alert-noc: store jira_key on alert when ticket created

### Frontend
4. `ui/src/components/JiraButton.tsx` (NEW) - "Create Jira Ticket" button on AlertDetail and IncidentDetail
5. `ui/src/components/JiraLink.tsx` (NEW) - shows linked Jira key with external link
6. `ui/src/api/client.ts` - integrationsAPI.jira.create(), .comment()

### Config
7. Environment variables: JIRA_URL, JIRA_USER, JIRA_API_TOKEN, JIRA_PROJECT_KEY
8. Docker Compose: add env vars to api-gateway

## Verification
1. Click "Create Jira Ticket" on alert -> ticket created in Jira
2. Jira key appears on alert detail
3. Click Jira key -> opens Jira in new tab
4. Add comment from NOC -> comment appears in Jira
