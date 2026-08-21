# Plan: Change-Aware Correlation

## Goal
Correlate alerts with recent deployments/config changes to identify likely root cause.

## Architecture
- **Changes table**: PostgreSQL `change` table tracking deployments, config updates, infrastructure changes
- **Correlation engine**: When an alert fires, check for changes to the same service within a 30-minute lookback window
- **Risk scoring**: Calculate risk based on timing proximity (closer = higher risk)
- **Frontend**: Show "Recent Changes" on alerts and incidents with risk indicator
- **Chatbot**: New `get_recent_changes` tool + reference changes in suggest-fix prompts

## Backend Components

### 1. Change Model (`aiops_shared/models/change.py`)
SQLAlchemy 2.0 style: id (UUID), service, type (deployment/config/infrastructure), description, author, metadata (JSONB), status (successful/failed/rolled_back), timestamp

### 2. Migration (`db/migrations/006_create_changes.sql`)
```sql
CREATE TABLE IF NOT EXISTS "change" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  author VARCHAR(255),
  status VARCHAR(50) DEFAULT 'successful',
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_change_service ON "change"(service);
CREATE INDEX idx_change_timestamp ON "change"(timestamp DESC);
```

### 3. Correlator (`core_platform/routers/changes.py`)
- `GET /changes` — list changes with optional service filter
- `POST /changes` — create a change record
- `GET /changes/recent/{service}` — get changes within lookback window
- `GET /changes/correlate/{service}` — get correlation analysis for a service

### 4. Alert Hook
In `plugins/alert_noc/store.py`, after creating an alert, query PostgreSQL for recent changes to the same service and attach correlation data to the alert response.

### 5. Seed Data (`db/seed_changes.py`)
~30 realistic changes across services: deployments, config updates, infra changes. Mix of successful, failed, and recent changes.

## Frontend Components

### 6. Changes Section in NOC Alerts
- "Recent Changes" badge/panel in the alert toolbar showing changes in the last 30 minutes
- Risk indicator (green/yellow/red) based on change proximity

### 7. Alert Detail Enhancement
- Show "Recent Changes" section in AlertTable hover/detail
- Risk score badge on correlated alerts

### 8. Incident Detail Enhancement
- Show all changes correlated with the incident's alerts

## Chatbot Integration

### 9. New Tool: `get_recent_changes`
Query recent changes for a service, return with timing context.

### 10. Updated Suggest-Fix Prompt
Include recent changes in the incident context sent to the LLM.

## Verification
- Seed 30 changes → create alerts → correlation shows recent changes
- Risk score accurately reflects timing proximity
- Chatbot references changes when suggesting fixes
