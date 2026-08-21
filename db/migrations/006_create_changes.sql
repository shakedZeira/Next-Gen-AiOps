-- Migration 006: Create change table for change-aware correlation
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

CREATE INDEX IF NOT EXISTS idx_change_service ON "change"(service);
CREATE INDEX IF NOT EXISTS idx_change_timestamp ON "change"(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_change_service_timestamp ON "change"(service, timestamp DESC);
