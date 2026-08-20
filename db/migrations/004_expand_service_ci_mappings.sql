-- 004: Expand service-to-CI mappings across all sites
-- Previously only global-hq CIs were mapped, preventing service filtering on other sites.

BEGIN;

-- Clear existing mappings
DELETE FROM service_ci;

-- E-Commerce Platform: spans all sites
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'entry_point' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'nginx-lb-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'web-server-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'web-server-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'api-gateway-ci';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'hq-firewall-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'hq-acc-sw-8';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'hq-wan-router-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'hq-dist-sw-2a';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'dc1-lb-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'dc1-app-server-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'ring-app-server-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'ring-app-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'nyc-server-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'nyc-app-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'lon-server-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'E-Commerce Platform' AND c.name = 'lon-app-1';

-- Payment Gateway: HQ + regional-dc-1
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'entry_point' FROM service s, ci c WHERE s.name = 'Payment Gateway' AND c.name = 'postgres-payments';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Payment Gateway' AND c.name = 'payment-processor-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Payment Gateway' AND c.name = 'hq-web-host-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Payment Gateway' AND c.name = 'dc1-postgres-primary';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Payment Gateway' AND c.name = 'dc1-redis-cluster';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Payment Gateway' AND c.name = 'dc1-kafka-cluster';

-- Inventory Service: HQ + regional-dc-1
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'entry_point' FROM service s, ci c WHERE s.name = 'Inventory Service' AND c.name = 'inventory-db';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Inventory Service' AND c.name = 'dc1-storage-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Inventory Service' AND c.name = 'dc1-postgres-replica';

-- Notification Service: HQ + metro-ring-1 + branch-nyc
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'entry_point' FROM service s, ci c WHERE s.name = 'Notification Service' AND c.name = 'notification-svc';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Notification Service' AND c.name = 'notification-db';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Notification Service' AND c.name = 'hq-kafka-node';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Notification Service' AND c.name = 'ring-app-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Notification Service' AND c.name = 'nyc-cache-1';

-- Order Processing: HQ + branch-nyc + branch-london
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'entry_point' FROM service s, ci c WHERE s.name = 'Order Processing' AND c.name = 'order-api';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Order Processing' AND c.name = 'order-service';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Order Processing' AND c.name = 'order-db';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Order Processing' AND c.name = 'hq-ecommerce-app';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Order Processing' AND c.name = 'hq-payments-app';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Order Processing' AND c.name = 'nyc-server-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Order Processing' AND c.name = 'lon-server-1';

-- Analytics Pipeline: HQ + regional-dc-1 + metro-ring-1
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'entry_point' FROM service s, ci c WHERE s.name = 'Analytics Pipeline' AND c.name = 'analytics-api';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Analytics Pipeline' AND c.name = 'clickhouse-db';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Analytics Pipeline' AND c.name = 's3-data-lake';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Analytics Pipeline' AND c.name = 'hq-wan-router-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Analytics Pipeline' AND c.name = 'hq-inventory-app';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Analytics Pipeline' AND c.name = 'dc1-db-server-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Analytics Pipeline' AND c.name = 'dc1-db-server-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Analytics Pipeline' AND c.name = 'ring-db-server-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Analytics Pipeline' AND c.name = 'ring-postgres-1';

-- Auth Service: HQ + branch-london
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'entry_point' FROM service s, ci c WHERE s.name = 'Auth Service' AND c.name = 'auth-api';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Auth Service' AND c.name = 'postgres-auth';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Auth Service' AND c.name = 'hq-redis-node';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Auth Service' AND c.name = 'lon-local-cache';

-- Network Infrastructure: all sites (network devices)
-- global-hq
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'entry_point' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-core-sw-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-core-sw-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-dist-sw-1a';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-dist-sw-1b';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-dist-sw-2a';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-dist-sw-2b';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-wan-router-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-wan-router-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-firewall-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'hq-firewall-2';
-- regional-dc-1
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'dc1-core-sw-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'dc1-core-sw-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'dc1-dist-sw-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'dc1-dist-sw-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'dc1-wan-router-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'dc1-wan-router-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'dc1-firewall-1';
-- metro-ring-1
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'ring-sw-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'ring-sw-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'ring-sw-3';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'ring-sw-4';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'ring-sw-5';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'ring-sw-6';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'ring-acc-sw-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'ring-acc-sw-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'ring-pe-router-1';
-- branch-nyc
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'nyc-core-sw-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'nyc-core-sw-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'nyc-acc-sw-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'nyc-acc-sw-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'nyc-acc-sw-3';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'nyc-acc-sw-4';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'nyc-sdwan-edge-1';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'nyc-sdwan-edge-2';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'nyc-firewall-1';
-- branch-london
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'lon-access-switch';
INSERT INTO service_ci (service_id, ci_id, role)
SELECT s.id, c.id, 'dependency' FROM service s, ci c WHERE s.name = 'Network Infrastructure' AND c.name = 'lon-sdwan-edge';

COMMIT;
