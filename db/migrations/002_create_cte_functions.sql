-- Recursive CTE: Get upstream dependencies (what does this CI depend on?)
CREATE OR REPLACE FUNCTION get_upstream_dependencies(p_ci_id UUID)
RETURNS TABLE(ci_id UUID, ci_name VARCHAR, ci_type VARCHAR, depth INT) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE upstream AS (
        SELECT r.target_id, 1 AS depth
        FROM relationship r
        WHERE r.source_id = p_ci_id
        UNION ALL
        SELECT r.target_id, u.depth + 1
        FROM relationship r
        INNER JOIN upstream u ON r.source_id = u.target_id
        WHERE u.depth < 10
    )
    SELECT DISTINCT c.id, c.name, c.type, u.depth
    FROM upstream u
    JOIN ci c ON c.id = u.target_id;
END;
$$ LANGUAGE plpgsql;

-- Recursive CTE: Get downstream impact (what is impacted if this CI fails?)
CREATE OR REPLACE FUNCTION get_downstream_impact(p_ci_id UUID)
RETURNS TABLE(ci_id UUID, ci_name VARCHAR, ci_type VARCHAR, depth INT) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE downstream AS (
        SELECT r.source_id, 1 AS depth
        FROM relationship r
        WHERE r.target_id = p_ci_id
        UNION ALL
        SELECT r.source_id, d.depth + 1
        FROM relationship r
        INNER JOIN downstream d ON r.target_id = d.source_id
        WHERE d.depth < 10
    )
    SELECT DISTINCT c.id, c.name, c.type, d.depth
    FROM downstream d
    JOIN ci c ON c.id = d.source_id;
END;
$$ LANGUAGE plpgsql;

-- Get full service topology
CREATE OR REPLACE FUNCTION get_service_topology(p_service_id UUID)
RETURNS TABLE(ci_id UUID, ci_name VARCHAR, ci_type VARCHAR, rel_type VARCHAR, rel_source UUID, rel_target UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.name, c.type, r.type, r.source_id, r.target_id
    FROM service_ci sc
    JOIN ci c ON c.id = sc.ci_id
    LEFT JOIN relationship r ON (r.source_id = c.id OR r.target_id = c.id)
    WHERE sc.service_id = p_service_id;
END;
$$ LANGUAGE plpgsql;
