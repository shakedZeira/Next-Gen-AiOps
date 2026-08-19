-- Migration 003: Add team column to CI table
ALTER TABLE ci ADD COLUMN IF NOT EXISTS team VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_ci_team ON ci(team);
