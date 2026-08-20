-- Tables
CREATE TABLE IF NOT EXISTS ci (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    provider VARCHAR(50),
    environment VARCHAR(50),
    team VARCHAR(100),
    site VARCHAR(100),
    site_type VARCHAR(50),
    network_layer VARCHAR(50),
    topology_type VARCHAR(50),
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
CREATE INDEX idx_ci_team ON ci(team);
CREATE INDEX idx_ci_site ON ci(site);
CREATE INDEX idx_relationship_source ON relationship(source_id);
CREATE INDEX idx_relationship_target ON relationship(target_id);
CREATE INDEX idx_relationship_type ON relationship(type);
CREATE INDEX idx_service_status ON service(operational_status);

-- Recursive CTE functions for topology queries
CREATE OR REPLACE FUNCTION get_upstream_dependencies(target_ci UUID)
RETURNS TABLE(ci_id UUID, ci_name VARCHAR, ci_type VARCHAR, depth INT)
AS $$
    WITH RECURSIVE deps AS (
        SELECT r.source_id AS ci_id, 1 AS depth
        FROM relationship r WHERE r.target_id = target_ci
        UNION ALL
        SELECT r.source_id, d.depth + 1
        FROM relationship r
        JOIN deps d ON r.target_id = d.ci_id
        WHERE d.depth < 10
    )
    SELECT d.ci_id, c.name, c.type, d.depth
    FROM deps d JOIN ci c ON c.id = d.ci_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION get_downstream_impact(source_ci UUID)
RETURNS TABLE(ci_id UUID, ci_name VARCHAR, ci_type VARCHAR, depth INT)
AS $$
    WITH RECURSIVE impact AS (
        SELECT r.target_id AS ci_id, 1 AS depth
        FROM relationship r WHERE r.source_id = source_ci
        UNION ALL
        SELECT r.target_id, i.depth + 1
        FROM relationship r
        JOIN impact i ON r.source_id = i.ci_id
        WHERE i.depth < 10
    )
    SELECT i.ci_id, c.name, c.type, i.depth
    FROM impact i JOIN ci c ON c.id = i.ci_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION get_service_topology(svc UUID)
RETURNS TABLE(
    ci_id UUID, ci_name VARCHAR, ci_type VARCHAR,
    rel_source UUID, rel_target UUID, rel_type VARCHAR
)
AS $$
    SELECT c.id, c.name, c.type, r.source_id, r.target_id, r.type
    FROM service_ci sc
    JOIN ci c ON c.id = sc.ci_id
    LEFT JOIN relationship r ON (r.source_id = c.id OR r.target_id = c.id)
    WHERE sc.service_id = svc;
$$ LANGUAGE sql;

-- ============================================================================
-- DC Room / Rack / Equipment Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS dc_room (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    site VARCHAR NOT NULL,
    room_type VARCHAR,
    tier_rating INTEGER,
    total_racks INTEGER DEFAULT 0,
    power_capacity_kw FLOAT,
    cooling_type VARCHAR,
    pue_target FLOAT,
    labels JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS dc_rack (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    room_id UUID REFERENCES dc_room(id),
    site VARCHAR NOT NULL,
    "row" VARCHAR,
    rack_number INTEGER,
    u_height INTEGER DEFAULT 42,
    max_power_kw FLOAT,
    current_temp_c FLOAT,
    status VARCHAR DEFAULT 'active',
    labels JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS dc_rack_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rack_id UUID REFERENCES dc_rack(id),
    ci_id UUID,
    name VARCHAR NOT NULL,
    equipment_type VARCHAR NOT NULL,
    u_start INTEGER NOT NULL,
    u_height INTEGER DEFAULT 1,
    manufacturer VARCHAR,
    model VARCHAR,
    serial_number VARCHAR,
    power_consumption_w FLOAT,
    mgmt_ip VARCHAR,
    status VARCHAR DEFAULT 'active',
    labels JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_dc_room_site ON dc_room(site);
CREATE INDEX IF NOT EXISTS idx_dc_rack_room ON dc_rack(room_id);
CREATE INDEX IF NOT EXISTS idx_dc_rack_equipment_rack ON dc_rack_equipment(rack_id);
