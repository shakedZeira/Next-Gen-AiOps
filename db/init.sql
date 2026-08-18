-- Tables
CREATE TABLE IF NOT EXISTS ci (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    provider VARCHAR(50),
    environment VARCHAR(50),
    labels JSONB DEFAULT '{}',
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relationship (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES ci(id) ON DELETE CASCADE,
    target_id UUID REFERENCES ci(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    properties JSONB DEFAULT '{}',
    discovered_by VARCHAR(50),
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    owner_team VARCHAR(100),
    sla_tier VARCHAR(20) DEFAULT 'bronze',
    operational_status VARCHAR(20) DEFAULT 'operational',
    entry_point_ci_id UUID REFERENCES ci(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_ci (
    service_id UUID REFERENCES service(id) ON DELETE CASCADE,
    ci_id UUID REFERENCES ci(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'dependency',
    PRIMARY KEY (service_id, ci_id)
);

-- Indexes
CREATE INDEX idx_ci_type ON ci(type);
CREATE INDEX idx_ci_provider ON ci(provider);
CREATE INDEX idx_ci_environment ON ci(environment);
CREATE INDEX idx_ci_labels ON ci USING GIN(labels);
CREATE INDEX idx_relationship_source ON relationship(source_id);
CREATE INDEX idx_relationship_target ON relationship(target_id);
CREATE INDEX idx_relationship_type ON relationship(type);
CREATE INDEX idx_service_status ON service(operational_status);
