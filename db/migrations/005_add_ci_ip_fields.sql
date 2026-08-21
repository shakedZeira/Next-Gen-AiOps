-- Migration 005: Add IP address fields to CI table
-- Plan 2: IP Address Assignment

ALTER TABLE ci ADD COLUMN management_ip INET;
ALTER TABLE ci ADD COLUMN loopback_ip INET;
ALTER TABLE ci ADD COLUMN subnet CIDR;

CREATE INDEX idx_ci_management_ip ON ci (management_ip);
CREATE INDEX idx_ci_loopback_ip ON ci (loopback_ip);
CREATE INDEX idx_ci_subnet ON ci (subnet);
