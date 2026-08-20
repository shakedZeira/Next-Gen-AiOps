import json
import uuid

from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://aiops:aiops@localhost:5432/aiops"
engine = create_engine(DATABASE_URL)

services = [
    {"id": str(uuid.uuid4()), "name": "E-Commerce Platform", "owner_team": "frontend", "sla_tier": "gold"},
    {"id": str(uuid.uuid4()), "name": "Payment Gateway", "owner_team": "payments", "sla_tier": "gold"},
    {"id": str(uuid.uuid4()), "name": "Inventory Service", "owner_team": "backend", "sla_tier": "silver"},
    {"id": str(uuid.uuid4()), "name": "Notification Service", "owner_team": "platform", "sla_tier": "bronze"},
    {"id": str(uuid.uuid4()), "name": "Order Processing", "owner_team": "backend", "sla_tier": "gold"},
    {"id": str(uuid.uuid4()), "name": "Analytics Pipeline", "owner_team": "data", "sla_tier": "silver"},
    {"id": str(uuid.uuid4()), "name": "Auth Service", "owner_team": "security", "sla_tier": "gold"},
    {"id": str(uuid.uuid4()), "name": "Network Infrastructure", "owner_team": "network", "sla_tier": "gold"},
]

# ============================================================================
# SITE 1: Global HQ (Three-Tier Hierarchical)
# ============================================================================
# Topology: Core -> Distribution -> Access -> Endpoints
# 2 core switches, 4 distribution switches, 8 access switches
# WAN edge routers, firewalls, servers, containers, pods

# Core layer (2 switches paired)
# Distribution layer (2 pairs = 4 switches)
# Access layer (8 switches, 4 per distribution block)

cis = [
    # --- SITE: global-hq (Three-Tier Hierarchical) ---
    # Application CIs
    {"id": str(uuid.uuid4()), "name": "nginx-lb-1", "type": "load_balancer", "provider": "f5", "environment": "prod", "team": "sre", "site": "global-hq", "site_type": "hq", "network_layer": "core", "topology_type": "hierarchical", "labels": {"app": "nginx", "tier": "frontend", "vendor": "f5"}},
    {"id": str(uuid.uuid4()), "name": "web-server-1", "type": "host", "provider": "dell", "environment": "prod", "team": "frontend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "ecommerce", "tier": "frontend", "os": "linux"}},
    {"id": str(uuid.uuid4()), "name": "web-server-2", "type": "host", "provider": "dell", "environment": "prod", "team": "frontend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "ecommerce", "tier": "frontend", "os": "linux"}},
    {"id": str(uuid.uuid4()), "name": "api-gateway-ci", "type": "api_gateway", "provider": "aws", "environment": "prod", "team": "sre", "site": "global-hq", "site_type": "hq", "network_layer": "distribution", "topology_type": "hierarchical", "labels": {"app": "api-gateway", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "postgres-payments", "type": "database", "provider": "aws", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "payments", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "redis-cache", "type": "cache", "provider": "aws", "environment": "prod", "team": "platform", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "redis", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "kafka-broker-1", "type": "message_queue", "provider": "aws", "environment": "prod", "team": "platform", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "kafka", "tier": "messaging"}},
    {"id": str(uuid.uuid4()), "name": "payment-processor-1", "type": "microservice", "provider": "aws", "environment": "prod", "team": "payments", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "payments", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "inventory-db", "type": "database", "provider": "aws", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "inventory", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "notification-svc", "type": "microservice", "provider": "aws", "environment": "prod", "team": "platform", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "notifications", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "order-api", "type": "api_gateway", "provider": "aws", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "orders", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "order-service", "type": "microservice", "provider": "aws", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "orders", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "order-db", "type": "database", "provider": "aws", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "orders", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "analytics-api", "type": "microservice", "provider": "aws", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "analytics", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "clickhouse-db", "type": "database", "provider": "gcp", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "analytics", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "s3-data-lake", "type": "storage", "provider": "aws", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "analytics", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "auth-api", "type": "microservice", "provider": "aws", "environment": "prod", "team": "security", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "auth", "tier": "backend"}},
    {"id": str(uuid.uuid4()), "name": "postgres-auth", "type": "database", "provider": "aws", "environment": "prod", "team": "security", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "auth", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "notification-db", "type": "database", "provider": "aws", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "notifications", "tier": "data"}},
    {"id": str(uuid.uuid4()), "name": "analytics-ui", "type": "host", "provider": "aws", "environment": "prod", "team": "frontend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"app": "analytics", "tier": "frontend"}},
    # HQ Network - Core Layer (2 switches paired)
    {"id": str(uuid.uuid4()), "name": "hq-core-sw-1", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9600", "ports": "48", "role": "core", "speed_uplink": "100G"}},
    {"id": str(uuid.uuid4()), "name": "hq-core-sw-2", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9600", "ports": "48", "role": "core", "speed_uplink": "100G"}},
    # HQ Network - Distribution Layer (2 pairs = 4 switches)
    {"id": str(uuid.uuid4()), "name": "hq-dist-sw-1a", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "distribution", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9500", "ports": "48", "role": "distribution", "speed_uplink": "40G", "ha_pair": "hq-dist-sw-1b"}},
    {"id": str(uuid.uuid4()), "name": "hq-dist-sw-1b", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "distribution", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9500", "ports": "48", "role": "distribution", "speed_uplink": "40G", "ha_pair": "hq-dist-sw-1a"}},
    {"id": str(uuid.uuid4()), "name": "hq-dist-sw-2a", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "distribution", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9500", "ports": "48", "role": "distribution", "speed_uplink": "40G", "ha_pair": "hq-dist-sw-2b"}},
    {"id": str(uuid.uuid4()), "name": "hq-dist-sw-2b", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "distribution", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9500", "ports": "48", "role": "distribution", "speed_uplink": "40G", "ha_pair": "hq-dist-sw-2a"}},
    # HQ Network - Access Layer (8 switches)
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-1", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-2", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-3", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-4", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-5", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-6", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-7", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-8", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    # HQ Network - WAN Edge & Firewall
    {"id": str(uuid.uuid4()), "name": "hq-wan-router-1", "type": "router", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "wan_edge", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "csr-1000v", "role": "wan_edge", "transport": "mpls", "sdwan_color": "mpls"}},
    {"id": str(uuid.uuid4()), "name": "hq-wan-router-2", "type": "router", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "wan_edge", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "csr-1000v", "role": "wan_edge", "transport": "internet", "sdwan_color": "public-internet"}},
    {"id": str(uuid.uuid4()), "name": "hq-firewall-1", "type": "firewall", "provider": "paloalto", "environment": "prod", "team": "security", "site": "global-hq", "site_type": "hq", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "paloalto", "model": "pa-5250", "role": "perimeter", "ha_pair": "hq-firewall-2"}},
    {"id": str(uuid.uuid4()), "name": "hq-firewall-2", "type": "firewall", "provider": "paloalto", "environment": "prod", "team": "security", "site": "global-hq", "site_type": "hq", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "paloalto", "model": "pa-5250", "role": "perimeter", "ha_pair": "hq-firewall-1"}},
    # HQ Physical servers
    {"id": str(uuid.uuid4()), "name": "hq-web-host-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "frontend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "16", "ram_gb": "64", "rack": "A1"}},
    {"id": str(uuid.uuid4()), "name": "hq-web-host-2", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "frontend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "16", "ram_gb": "64", "rack": "A2"}},
    {"id": str(uuid.uuid4()), "name": "hq-app-host-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "32", "ram_gb": "128", "rack": "B1"}},
    {"id": str(uuid.uuid4()), "name": "hq-app-host-2", "type": "physical_server", "provider": "hp", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "windows", "os_version": "server-2022", "cpu": "32", "ram_gb": "128", "rack": "B2"}},
    {"id": str(uuid.uuid4()), "name": "hq-db-host-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "64", "ram_gb": "256", "rack": "C1"}},
    {"id": str(uuid.uuid4()), "name": "hq-monitor-host-1", "type": "physical_server", "provider": "hp", "environment": "prod", "team": "sre", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "windows", "os_version": "server-2022", "cpu": "16", "ram_gb": "32", "rack": "D1"}},
    # HQ Containers
    {"id": str(uuid.uuid4()), "name": "hq-nginx-proxy", "type": "container", "provider": "docker", "environment": "prod", "team": "frontend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "nginx:1.25", "host": "hq-web-host-1", "port": "443"}},
    {"id": str(uuid.uuid4()), "name": "hq-ecommerce-app", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "node:20", "host": "hq-app-host-1", "port": "3000"}},
    {"id": str(uuid.uuid4()), "name": "hq-payments-app", "type": "container", "provider": "docker", "environment": "prod", "team": "payments", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "python:3.11", "host": "hq-app-host-1", "port": "8080"}},
    {"id": str(uuid.uuid4()), "name": "hq-inventory-app", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "python:3.11", "host": "hq-app-host-2", "port": "8081"}},
    {"id": str(uuid.uuid4()), "name": "hq-redis-node", "type": "container", "provider": "docker", "environment": "prod", "team": "platform", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "redis:7", "host": "hq-app-host-1", "port": "6379"}},
    {"id": str(uuid.uuid4()), "name": "hq-kafka-node", "type": "container", "provider": "docker", "environment": "prod", "team": "platform", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "confluentinc/cp-kafka:7.5", "host": "hq-app-host-2", "port": "9092"}},
    # HQ Kubernetes Pods
    {"id": str(uuid.uuid4()), "name": "hq-order-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-app-host-1", "deployment": "order-service"}},
    {"id": str(uuid.uuid4()), "name": "hq-order-pod-2", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-app-host-2", "deployment": "order-service"}},
    {"id": str(uuid.uuid4()), "name": "hq-analytics-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-db-host-1", "deployment": "analytics-api"}},
    {"id": str(uuid.uuid4()), "name": "hq-auth-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "security", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-app-host-1", "deployment": "auth-api"}},
    {"id": str(uuid.uuid4()), "name": "hq-notification-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "platform", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-app-host-2", "deployment": "notification-svc"}},

    # --- SITE: regional-dc-1 (Hub-and-Spoke Hub) ---
    # Regional Data Center acting as hub for branches
    {"id": str(uuid.uuid4()), "name": "dc1-core-sw-1", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "regional-dc-1", "site_type": "dc", "network_layer": "core", "topology_type": "hub_and_spoke", "labels": {"vendor": "juniper", "model": "qfx5120", "ports": "48", "role": "core", "speed_uplink": "100G"}},
    {"id": str(uuid.uuid4()), "name": "dc1-core-sw-2", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "regional-dc-1", "site_type": "dc", "network_layer": "core", "topology_type": "hub_and_spoke", "labels": {"vendor": "juniper", "model": "qfx5120", "ports": "48", "role": "core", "speed_uplink": "100G"}},
    {"id": str(uuid.uuid4()), "name": "dc1-dist-sw-1", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "regional-dc-1", "site_type": "dc", "network_layer": "distribution", "topology_type": "hub_and_spoke", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "48", "role": "distribution", "speed_uplink": "40G"}},
    {"id": str(uuid.uuid4()), "name": "dc1-dist-sw-2", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "regional-dc-1", "site_type": "dc", "network_layer": "distribution", "topology_type": "hub_and_spoke", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "48", "role": "distribution", "speed_uplink": "40G"}},
    {"id": str(uuid.uuid4()), "name": "dc1-wan-router-1", "type": "router", "provider": "juniper", "environment": "prod", "team": "network", "site": "regional-dc-1", "site_type": "dc", "network_layer": "wan_edge", "topology_type": "hub_and_spoke", "labels": {"vendor": "juniper", "model": "mx204", "role": "wan_edge", "transport": "mpls", "sdwan_color": "mpls"}},
    {"id": str(uuid.uuid4()), "name": "dc1-wan-router-2", "type": "router", "provider": "juniper", "environment": "prod", "team": "network", "site": "regional-dc-1", "site_type": "dc", "network_layer": "wan_edge", "topology_type": "hub_and_spoke", "labels": {"vendor": "juniper", "model": "mx204", "role": "wan_edge", "transport": "internet", "sdwan_color": "biz-internet"}},
    {"id": str(uuid.uuid4()), "name": "dc1-firewall-1", "type": "firewall", "provider": "paloalto", "environment": "prod", "team": "security", "site": "regional-dc-1", "site_type": "dc", "network_layer": "core", "topology_type": "hub_and_spoke", "labels": {"vendor": "paloalto", "model": "pa-3260", "role": "perimeter"}},
    {"id": str(uuid.uuid4()), "name": "dc1-lb-1", "type": "load_balancer", "provider": "f5", "environment": "prod", "team": "sre", "site": "regional-dc-1", "site_type": "dc", "network_layer": "distribution", "topology_type": "hub_and_spoke", "labels": {"vendor": "f5", "model": "bigip-i5800", "role": "application"}},
    {"id": str(uuid.uuid4()), "name": "dc1-storage-1", "type": "storage", "provider": "netapp", "environment": "prod", "team": "data", "site": "regional-dc-1", "site_type": "dc", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"vendor": "netapp", "model": "astra-fas9000", "protocol": "nfs", "capacity_tb": "500"}},
    {"id": str(uuid.uuid4()), "name": "dc1-db-server-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "data", "site": "regional-dc-1", "site_type": "dc", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"os": "linux", "os_version": "rhel-9", "cpu": "128", "ram_gb": "512", "role": "database"}},
    {"id": str(uuid.uuid4()), "name": "dc1-db-server-2", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "data", "site": "regional-dc-1", "site_type": "dc", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"os": "linux", "os_version": "rhel-9", "cpu": "128", "ram_gb": "512", "role": "database"}},
    {"id": str(uuid.uuid4()), "name": "dc1-app-server-1", "type": "physical_server", "provider": "hp", "environment": "prod", "team": "backend", "site": "regional-dc-1", "site_type": "dc", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "64", "ram_gb": "256", "role": "application"}},
    {"id": str(uuid.uuid4()), "name": "dc1-app-server-2", "type": "physical_server", "provider": "hp", "environment": "prod", "team": "backend", "site": "regional-dc-1", "site_type": "dc", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "64", "ram_gb": "256", "role": "application"}},
    {"id": str(uuid.uuid4()), "name": "dc1-postgres-primary", "type": "database", "provider": "postgresql", "environment": "prod", "team": "data", "site": "regional-dc-1", "site_type": "dc", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"engine": "postgresql", "version": "15", "role": "primary", "replication": "streaming"}},
    {"id": str(uuid.uuid4()), "name": "dc1-postgres-replica", "type": "database", "provider": "postgresql", "environment": "prod", "team": "data", "site": "regional-dc-1", "site_type": "dc", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"engine": "postgresql", "version": "15", "role": "replica", "replication": "streaming"}},
    {"id": str(uuid.uuid4()), "name": "dc1-redis-cluster", "type": "cache", "provider": "redis", "environment": "prod", "team": "platform", "site": "regional-dc-1", "site_type": "dc", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"engine": "redis", "version": "7.2", "cluster_mode": "true", "nodes": "6"}},
    {"id": str(uuid.uuid4()), "name": "dc1-kafka-cluster", "type": "message_queue", "provider": "confluent", "environment": "prod", "team": "platform", "site": "regional-dc-1", "site_type": "dc", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"engine": "kafka", "version": "3.5", "brokers": "3", "replication_factor": "3"}},

    # --- SITE: metro-ring-1 (ERPS Ring Topology) ---
    # 6 switches in ring + 2 in sub-ring
    {"id": str(uuid.uuid4()), "name": "ring-sw-1", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-2", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-3", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-4", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-5", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1", "rpl_owner": "true"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-6", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    # Sub-ring access switches
    {"id": str(uuid.uuid4()), "name": "ring-acc-sw-1", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex2300", "ports": "48", "role": "access", "ring_id": "metro-ring-01-sub"}},
    {"id": str(uuid.uuid4()), "name": "ring-acc-sw-2", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex2300", "ports": "48", "role": "access", "ring_id": "metro-ring-01-sub"}},
    # Ring PE routers
    {"id": str(uuid.uuid4()), "name": "ring-pe-router-1", "type": "router", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "wan_edge", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "mx204", "role": "pe", "connected_to_ring": "ring-sw-1,ring-sw-2"}},
    # Ring servers
    {"id": str(uuid.uuid4()), "name": "ring-app-server-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "32", "ram_gb": "128"}},
    {"id": str(uuid.uuid4()), "name": "ring-app-server-2", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "32", "ram_gb": "128"}},
    {"id": str(uuid.uuid4()), "name": "ring-db-server-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "data", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"os": "linux", "os_version": "rhel-9", "cpu": "64", "ram_gb": "256", "role": "database"}},
    # Ring containers
    {"id": str(uuid.uuid4()), "name": "ring-app-1", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"image": "node:20", "host": "ring-app-server-1", "port": "3000"}},
    {"id": str(uuid.uuid4()), "name": "ring-app-2", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"image": "python:3.11", "host": "ring-app-server-2", "port": "8080"}},
    # Ring database
    {"id": str(uuid.uuid4()), "name": "ring-postgres-1", "type": "database", "provider": "postgresql", "environment": "prod", "team": "data", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"engine": "postgresql", "version": "15", "role": "primary"}},

    # --- SITE: branch-nyc (Collapsed Core) ---
    # 2 distribution/core switches (collapsed), 4 access switches
    {"id": str(uuid.uuid4()), "name": "nyc-core-sw-1", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9400", "ports": "48", "role": "collapsed_core", "speed_uplink": "40G"}},
    {"id": str(uuid.uuid4()), "name": "nyc-core-sw-2", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9400", "ports": "48", "role": "collapsed_core", "speed_uplink": "40G"}},
    {"id": str(uuid.uuid4()), "name": "nyc-acc-sw-1", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "nyc-acc-sw-2", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "nyc-acc-sw-3", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "nyc-acc-sw-4", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "nyc-sdwan-edge-1", "type": "router", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "wan_edge", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "vedge-1000", "role": "sdwan_edge", "sdwan_color": "mpls", "transport": "mpls"}},
    {"id": str(uuid.uuid4()), "name": "nyc-sdwan-edge-2", "type": "router", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "wan_edge", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "vedge-1000", "role": "sdwan_edge", "sdwan_color": "public-internet", "transport": "internet"}},
    {"id": str(uuid.uuid4()), "name": "nyc-firewall-1", "type": "firewall", "provider": "fortinet", "environment": "prod", "team": "security", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "fortinet", "model": "fg-200f", "role": "branch_firewall"}},
    {"id": str(uuid.uuid4()), "name": "nyc-server-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "32", "ram_gb": "128"}},
    {"id": str(uuid.uuid4()), "name": "nyc-server-2", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "32", "ram_gb": "128"}},
    {"id": str(uuid.uuid4()), "name": "nyc-app-1", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "node:20", "host": "nyc-server-1", "port": "3000"}},
    {"id": str(uuid.uuid4()), "name": "nyc-cache-1", "type": "cache", "provider": "redis", "environment": "prod", "team": "platform", "site": "branch-nyc", "site_type": "large_branch", "network_layer": "access", "topology_type": "hierarchical", "labels": {"engine": "redis", "version": "7.2"}},

    # --- SITE: branch-london (Small Branch) ---
    # 1 switch, 1 router, 1 server
    {"id": str(uuid.uuid4()), "name": "lon-access-switch", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-london", "site_type": "small_branch", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"vendor": "cisco", "model": "catalyst-9200", "ports": "24", "role": "access", "speed_uplink": "1G"}},
    {"id": str(uuid.uuid4()), "name": "lon-sdwan-edge", "type": "router", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-london", "site_type": "small_branch", "network_layer": "wan_edge", "topology_type": "hub_and_spoke", "labels": {"vendor": "cisco", "model": "vedge-100", "role": "sdwan_edge", "sdwan_color": "public-internet", "transport": "internet"}},
    {"id": str(uuid.uuid4()), "name": "lon-server-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "branch-london", "site_type": "small_branch", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "16", "ram_gb": "64"}},
    {"id": str(uuid.uuid4()), "name": "lon-app-1", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "branch-london", "site_type": "small_branch", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"image": "node:20", "host": "lon-server-1", "port": "3000"}},
    {"id": str(uuid.uuid4()), "name": "lon-local-cache", "type": "cache", "provider": "redis", "environment": "prod", "team": "platform", "site": "branch-london", "site_type": "small_branch", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"engine": "redis", "version": "7.2"}},
]

# Build index mapping for relationships
name_to_idx = {cis[i]["name"]: i for i in range(len(cis))}

relationships = [
    # ========================================================================
    # SITE 1: global-hq - Three-Tier Hierarchical
    # ========================================================================
    # Core pair cross-connect
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-core-sw-2"], "type": "connected_to"},
    # Distribution pair cross-connects (HA)
    {"source": name_to_idx["hq-dist-sw-1a"], "target": name_to_idx["hq-dist-sw-1b"], "type": "connected_to"},
    {"source": name_to_idx["hq-dist-sw-2a"], "target": name_to_idx["hq-dist-sw-2b"], "type": "connected_to"},
    # Core -> Distribution (each dist connects to both core switches)
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-dist-sw-1a"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-dist-sw-2a"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-2"], "target": name_to_idx["hq-dist-sw-1b"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-2"], "target": name_to_idx["hq-dist-sw-2b"], "type": "routes_to"},
    # Distribution -> Access (each access dual-homed to both dist in its block)
    {"source": name_to_idx["hq-dist-sw-1a"], "target": name_to_idx["hq-acc-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-1a"], "target": name_to_idx["hq-acc-sw-2"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-1a"], "target": name_to_idx["hq-acc-sw-3"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-1a"], "target": name_to_idx["hq-acc-sw-4"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-1b"], "target": name_to_idx["hq-acc-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-1b"], "target": name_to_idx["hq-acc-sw-2"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-1b"], "target": name_to_idx["hq-acc-sw-3"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-1b"], "target": name_to_idx["hq-acc-sw-4"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-2a"], "target": name_to_idx["hq-acc-sw-5"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-2a"], "target": name_to_idx["hq-acc-sw-6"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-2a"], "target": name_to_idx["hq-acc-sw-7"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-2a"], "target": name_to_idx["hq-acc-sw-8"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-2b"], "target": name_to_idx["hq-acc-sw-5"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-2b"], "target": name_to_idx["hq-acc-sw-6"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-2b"], "target": name_to_idx["hq-acc-sw-7"], "type": "routes_to"},
    {"source": name_to_idx["hq-dist-sw-2b"], "target": name_to_idx["hq-acc-sw-8"], "type": "routes_to"},
    # Core -> WAN Edge
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-wan-router-1"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-2"], "target": name_to_idx["hq-wan-router-2"], "type": "routes_to"},
    # Core -> Firewall
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-firewall-1"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-2"], "target": name_to_idx["hq-firewall-2"], "type": "routes_to"},
    # Access -> Servers (servers connected to access switches)
    {"source": name_to_idx["hq-acc-sw-1"], "target": name_to_idx["hq-web-host-1"], "type": "connects_to"},
    {"source": name_to_idx["hq-acc-sw-2"], "target": name_to_idx["hq-web-host-2"], "type": "connects_to"},
    {"source": name_to_idx["hq-acc-sw-3"], "target": name_to_idx["hq-app-host-1"], "type": "connects_to"},
    {"source": name_to_idx["hq-acc-sw-4"], "target": name_to_idx["hq-app-host-2"], "type": "connects_to"},
    {"source": name_to_idx["hq-acc-sw-5"], "target": name_to_idx["hq-db-host-1"], "type": "connects_to"},
    {"source": name_to_idx["hq-acc-sw-6"], "target": name_to_idx["hq-monitor-host-1"], "type": "connects_to"},
    {"source": name_to_idx["hq-acc-sw-7"], "target": name_to_idx["nginx-lb-1"], "type": "connects_to"},
    # Servers -> Containers
    {"source": name_to_idx["hq-web-host-1"], "target": name_to_idx["hq-nginx-proxy"], "type": "hosts"},
    {"source": name_to_idx["hq-app-host-1"], "target": name_to_idx["hq-ecommerce-app"], "type": "hosts"},
    {"source": name_to_idx["hq-app-host-1"], "target": name_to_idx["hq-payments-app"], "type": "hosts"},
    {"source": name_to_idx["hq-app-host-1"], "target": name_to_idx["hq-redis-node"], "type": "hosts"},
    {"source": name_to_idx["hq-app-host-2"], "target": name_to_idx["hq-inventory-app"], "type": "hosts"},
    {"source": name_to_idx["hq-app-host-2"], "target": name_to_idx["hq-kafka-node"], "type": "hosts"},
    # Servers -> Pods
    {"source": name_to_idx["hq-app-host-1"], "target": name_to_idx["hq-order-pod-1"], "type": "runs"},
    {"source": name_to_idx["hq-app-host-2"], "target": name_to_idx["hq-order-pod-2"], "type": "runs"},
    {"source": name_to_idx["hq-db-host-1"], "target": name_to_idx["hq-analytics-pod-1"], "type": "runs"},
    {"source": name_to_idx["hq-app-host-1"], "target": name_to_idx["hq-auth-pod-1"], "type": "runs"},
    {"source": name_to_idx["hq-app-host-2"], "target": name_to_idx["hq-notification-pod-1"], "type": "runs"},
    # Application flow
    {"source": name_to_idx["nginx-lb-1"], "target": name_to_idx["hq-web-host-1"], "type": "routes_to"},
    {"source": name_to_idx["nginx-lb-1"], "target": name_to_idx["hq-web-host-2"], "type": "routes_to"},
    {"source": name_to_idx["hq-web-host-1"], "target": name_to_idx["api-gateway-ci"], "type": "calls"},
    {"source": name_to_idx["hq-web-host-2"], "target": name_to_idx["api-gateway-ci"], "type": "calls"},
    {"source": name_to_idx["api-gateway-ci"], "target": name_to_idx["postgres-payments"], "type": "depends_on"},
    {"source": name_to_idx["api-gateway-ci"], "target": name_to_idx["redis-cache"], "type": "depends_on"},
    {"source": name_to_idx["api-gateway-ci"], "target": name_to_idx["kafka-broker-1"], "type": "publishes_to"},
    {"source": name_to_idx["kafka-broker-1"], "target": name_to_idx["payment-processor-1"], "type": "delivers_to"},
    {"source": name_to_idx["payment-processor-1"], "target": name_to_idx["postgres-payments"], "type": "depends_on"},
    {"source": name_to_idx["kafka-broker-1"], "target": name_to_idx["notification-svc"], "type": "delivers_to"},
    {"source": name_to_idx["notification-svc"], "target": name_to_idx["notification-db"], "type": "depends_on"},
    {"source": name_to_idx["order-api"], "target": name_to_idx["order-service"], "type": "calls"},
    {"source": name_to_idx["order-service"], "target": name_to_idx["order-db"], "type": "depends_on"},
    {"source": name_to_idx["order-service"], "target": name_to_idx["inventory-db"], "type": "depends_on"},
    {"source": name_to_idx["analytics-ui"], "target": name_to_idx["analytics-api"], "type": "calls"},
    {"source": name_to_idx["analytics-api"], "target": name_to_idx["clickhouse-db"], "type": "depends_on"},
    {"source": name_to_idx["analytics-api"], "target": name_to_idx["s3-data-lake"], "type": "depends_on"},
    {"source": name_to_idx["auth-api"], "target": name_to_idx["postgres-auth"], "type": "depends_on"},
    {"source": name_to_idx["auth-api"], "target": name_to_idx["redis-cache"], "type": "depends_on"},
    {"source": name_to_idx["api-gateway-ci"], "target": name_to_idx["auth-api"], "type": "calls"},

    # ========================================================================
    # SITE 2: regional-dc-1 - Hub-and-Spoke Hub
    # ========================================================================
    # Core pair
    {"source": name_to_idx["dc1-core-sw-1"], "target": name_to_idx["dc1-core-sw-2"], "type": "connected_to"},
    # Core -> Distribution
    {"source": name_to_idx["dc1-core-sw-1"], "target": name_to_idx["dc1-dist-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["dc1-core-sw-2"], "target": name_to_idx["dc1-dist-sw-2"], "type": "routes_to"},
    # Core -> WAN
    {"source": name_to_idx["dc1-core-sw-1"], "target": name_to_idx["dc1-wan-router-1"], "type": "routes_to"},
    {"source": name_to_idx["dc1-core-sw-2"], "target": name_to_idx["dc1-wan-router-2"], "type": "routes_to"},
    # Core -> Firewall
    {"source": name_to_idx["dc1-core-sw-1"], "target": name_to_idx["dc1-firewall-1"], "type": "routes_to"},
    # Distribution -> Servers
    {"source": name_to_idx["dc1-dist-sw-1"], "target": name_to_idx["dc1-lb-1"], "type": "connects_to"},
    {"source": name_to_idx["dc1-dist-sw-1"], "target": name_to_idx["dc1-db-server-1"], "type": "connects_to"},
    {"source": name_to_idx["dc1-dist-sw-1"], "target": name_to_idx["dc1-db-server-2"], "type": "connects_to"},
    {"source": name_to_idx["dc1-dist-sw-2"], "target": name_to_idx["dc1-app-server-1"], "type": "connects_to"},
    {"source": name_to_idx["dc1-dist-sw-2"], "target": name_to_idx["dc1-app-server-2"], "type": "connects_to"},
    {"source": name_to_idx["dc1-dist-sw-2"], "target": name_to_idx["dc1-storage-1"], "type": "connects_to"},
    # Servers -> Databases
    {"source": name_to_idx["dc1-db-server-1"], "target": name_to_idx["dc1-postgres-primary"], "type": "hosts"},
    {"source": name_to_idx["dc1-db-server-2"], "target": name_to_idx["dc1-postgres-replica"], "type": "hosts"},
    # Database replication
    {"source": name_to_idx["dc1-postgres-primary"], "target": name_to_idx["dc1-postgres-replica"], "type": "connected_to"},
    # Servers -> Cache/MQ
    {"source": name_to_idx["dc1-app-server-1"], "target": name_to_idx["dc1-redis-cluster"], "type": "hosts"},
    {"source": name_to_idx["dc1-app-server-2"], "target": name_to_idx["dc1-kafka-cluster"], "type": "hosts"},

    # ========================================================================
    # SITE 3: metro-ring-1 - ERPS Ring Topology
    # ========================================================================
    # Ring connections (closed loop: 1-2-3-4-5-6-1)
    {"source": name_to_idx["ring-sw-1"], "target": name_to_idx["ring-sw-2"], "type": "connected_to"},
    {"source": name_to_idx["ring-sw-2"], "target": name_to_idx["ring-sw-3"], "type": "connected_to"},
    {"source": name_to_idx["ring-sw-3"], "target": name_to_idx["ring-sw-4"], "type": "connected_to"},
    {"source": name_to_idx["ring-sw-4"], "target": name_to_idx["ring-sw-5"], "type": "connected_to"},
    {"source": name_to_idx["ring-sw-5"], "target": name_to_idx["ring-sw-6"], "type": "connected_to"},
    {"source": name_to_idx["ring-sw-6"], "target": name_to_idx["ring-sw-1"], "type": "connected_to"},
    # Sub-ring connections (access switches connect to ring nodes 1 and 2)
    {"source": name_to_idx["ring-sw-1"], "target": name_to_idx["ring-acc-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["ring-sw-2"], "target": name_to_idx["ring-acc-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["ring-sw-2"], "target": name_to_idx["ring-acc-sw-2"], "type": "routes_to"},
    {"source": name_to_idx["ring-sw-3"], "target": name_to_idx["ring-acc-sw-2"], "type": "routes_to"},
    # PE router connects to ring
    {"source": name_to_idx["ring-pe-router-1"], "target": name_to_idx["ring-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["ring-pe-router-1"], "target": name_to_idx["ring-sw-2"], "type": "routes_to"},
    # Access -> Servers
    {"source": name_to_idx["ring-acc-sw-1"], "target": name_to_idx["ring-app-server-1"], "type": "connects_to"},
    {"source": name_to_idx["ring-acc-sw-2"], "target": name_to_idx["ring-app-server-2"], "type": "connects_to"},
    {"source": name_to_idx["ring-acc-sw-1"], "target": name_to_idx["ring-db-server-1"], "type": "connects_to"},
    # Servers -> Containers
    {"source": name_to_idx["ring-app-server-1"], "target": name_to_idx["ring-app-1"], "type": "hosts"},
    {"source": name_to_idx["ring-app-server-2"], "target": name_to_idx["ring-app-2"], "type": "hosts"},
    # Servers -> Database
    {"source": name_to_idx["ring-db-server-1"], "target": name_to_idx["ring-postgres-1"], "type": "hosts"},
    # Application flow
    {"source": name_to_idx["ring-app-1"], "target": name_to_idx["ring-postgres-1"], "type": "depends_on"},
    {"source": name_to_idx["ring-app-2"], "target": name_to_idx["ring-postgres-1"], "type": "depends_on"},

    # ========================================================================
    # SITE 4: branch-nyc - Collapsed Core
    # ========================================================================
    # Core pair cross-connect
    {"source": name_to_idx["nyc-core-sw-1"], "target": name_to_idx["nyc-core-sw-2"], "type": "connected_to"},
    # Core -> Access
    {"source": name_to_idx["nyc-core-sw-1"], "target": name_to_idx["nyc-acc-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["nyc-core-sw-1"], "target": name_to_idx["nyc-acc-sw-2"], "type": "routes_to"},
    {"source": name_to_idx["nyc-core-sw-2"], "target": name_to_idx["nyc-acc-sw-3"], "type": "routes_to"},
    {"source": name_to_idx["nyc-core-sw-2"], "target": name_to_idx["nyc-acc-sw-4"], "type": "routes_to"},
    # Core -> WAN Edge
    {"source": name_to_idx["nyc-core-sw-1"], "target": name_to_idx["nyc-sdwan-edge-1"], "type": "routes_to"},
    {"source": name_to_idx["nyc-core-sw-2"], "target": name_to_idx["nyc-sdwan-edge-2"], "type": "routes_to"},
    # Core -> Firewall
    {"source": name_to_idx["nyc-core-sw-1"], "target": name_to_idx["nyc-firewall-1"], "type": "routes_to"},
    # Access -> Servers
    {"source": name_to_idx["nyc-acc-sw-1"], "target": name_to_idx["nyc-server-1"], "type": "connects_to"},
    {"source": name_to_idx["nyc-acc-sw-2"], "target": name_to_idx["nyc-server-2"], "type": "connects_to"},
    # Servers -> Containers
    {"source": name_to_idx["nyc-server-1"], "target": name_to_idx["nyc-app-1"], "type": "hosts"},
    {"source": name_to_idx["nyc-server-1"], "target": name_to_idx["nyc-cache-1"], "type": "hosts"},

    # ========================================================================
    # SITE 5: branch-london - Small Branch
    # ========================================================================
    # Router -> Switch
    {"source": name_to_idx["lon-sdwan-edge"], "target": name_to_idx["lon-access-switch"], "type": "routes_to"},
    # Switch -> Server
    {"source": name_to_idx["lon-access-switch"], "target": name_to_idx["lon-server-1"], "type": "connects_to"},
    # Server -> Container
    {"source": name_to_idx["lon-server-1"], "target": name_to_idx["lon-app-1"], "type": "hosts"},
    {"source": name_to_idx["lon-server-1"], "target": name_to_idx["lon-local-cache"], "type": "hosts"},

    # ========================================================================
    # INTER-SITE CONNECTIONS (WAN Links)
    # ========================================================================
    # HQ <-> Regional DC (MPLS)
    {"source": name_to_idx["hq-wan-router-1"], "target": name_to_idx["dc1-wan-router-1"], "type": "routes_to"},
    # HQ <-> Metro Ring (MPLS)
    {"source": name_to_idx["hq-wan-router-1"], "target": name_to_idx["ring-pe-router-1"], "type": "routes_to"},
    # Regional DC <-> Branch NYC (SD-WAN)
    {"source": name_to_idx["dc1-wan-router-1"], "target": name_to_idx["nyc-sdwan-edge-1"], "type": "routes_to"},
    # Regional DC <-> Branch London (SD-WAN)
    {"source": name_to_idx["dc1-wan-router-2"], "target": name_to_idx["lon-sdwan-edge"], "type": "routes_to"},
    # HQ <-> Branch NYC (backup VPN)
    {"source": name_to_idx["hq-wan-router-2"], "target": name_to_idx["nyc-sdwan-edge-2"], "type": "routes_to"},
]

service_ci_map = [
    (0, 0, "entry_point"), (0, 1, "dependency"), (0, 2, "dependency"), (0, 3, "dependency"),
    (0, 37, "dependency"), (0, 33, "dependency"), (0, 34, "dependency"), (0, 24, "dependency"),
    (1, 4, "entry_point"), (1, 7, "dependency"), (1, 39, "dependency"),
    (2, 8, "entry_point"),
    (3, 9, "entry_point"), (3, 18, "dependency"), (3, 49, "dependency"),
    (4, 10, "entry_point"), (4, 11, "dependency"), (4, 12, "dependency"),
    (4, 45, "dependency"), (4, 46, "dependency"),
    (5, 13, "entry_point"), (5, 14, "dependency"), (5, 15, "dependency"),
    (5, 47, "dependency"), (5, 35, "dependency"),
    (6, 16, "entry_point"), (6, 17, "dependency"), (6, 48, "dependency"),
    (7, 21, "entry_point"), (7, 22, "dependency"), (7, 23, "dependency"), (7, 24, "dependency"),
]


def populate_rack(session, rack_id, site_name, rack_type="standard"):
    """Populate a rack with realistic equipment."""
    prefix = site_name[:3].upper()
    equipment = []

    if rack_type == "spine":
        for u in [1, 3, 5, 7]:
            equipment.append({"name": f"SPINE-{prefix}-{u:02d}", "equipment_type": "switch", "u_start": u, "u_height": 1, "manufacturer": "Cisco", "model": "Nexus 9364C", "power_consumption_w": 450.0})
        equipment.append({"name": f"PP-SPINE-{prefix}", "equipment_type": "patch_panel", "u_start": 40, "u_height": 1, "manufacturer": None, "model": None, "power_consumption_w": None})
        equipment.append({"name": f"OOSW-{prefix}", "equipment_type": "switch", "u_start": 42, "u_height": 1, "manufacturer": "Cisco", "model": "Catalyst 9200", "power_consumption_w": 120.0})
    elif rack_type == "server":
        equipment.append({"name": f"LEAF-A-{prefix}", "equipment_type": "switch", "u_start": 42, "u_height": 1, "manufacturer": "Cisco", "model": "Nexus 9348", "power_consumption_w": 350.0})
        equipment.append({"name": f"LEAF-B-{prefix}", "equipment_type": "switch", "u_start": 41, "u_height": 1, "manufacturer": "Cisco", "model": "Nexus 9348", "power_consumption_w": 350.0})
        for i, u in enumerate(range(4, 36, 2)):
            equipment.append({"name": f"SRV-{prefix}-{i+1:03d}", "equipment_type": "server", "u_start": u, "u_height": 1, "manufacturer": "Dell", "model": "PowerEdge R750", "power_consumption_w": 350.0})
        equipment.append({"name": f"PDU-A-{prefix}", "equipment_type": "pdu", "u_start": 1, "u_height": 1, "manufacturer": "APC", "model": "Switched PDU", "power_consumption_w": None})
        equipment.append({"name": f"PDU-B-{prefix}", "equipment_type": "pdu", "u_start": 2, "u_height": 1, "manufacturer": "APC", "model": "Switched PDU", "power_consumption_w": None})
    else:
        equipment.append({"name": f"SW-{prefix}-01", "equipment_type": "switch", "u_start": 42, "u_height": 1, "manufacturer": "Cisco", "model": "Catalyst 9300", "power_consumption_w": 200.0})
        equipment.append({"name": f"FW-{prefix}", "equipment_type": "switch", "u_start": 40, "u_height": 1, "manufacturer": "Palo Alto", "model": "PA-440", "power_consumption_w": 150.0})
        if rack_type != "closet":
            equipment.append({"name": f"SRV-{prefix}-001", "equipment_type": "server", "u_start": 10, "u_height": 1, "manufacturer": "Dell", "model": "PowerEdge R650", "power_consumption_w": 250.0})
        equipment.append({"name": f"PDU-{prefix}", "equipment_type": "pdu", "u_start": 1, "u_height": 1, "manufacturer": "APC", "model": "Basic PDU", "power_consumption_w": None})

    for eq in equipment:
        session.execute(text(
            "INSERT INTO dc_rack_equipment (rack_id, name, equipment_type, u_start, u_height, manufacturer, model, power_consumption_w, labels, status) "
            "VALUES (:rack_id, :name, :equipment_type, :u_start, :u_height, :manufacturer, :model, :power_consumption_w, '{}', 'active')"
        ), {**eq, "rack_id": rack_id})


def seed_dc_data(session):
    """Seed DC rooms, racks, and equipment."""
    # --- global-hq: DC1-Main (Tier III) ---
    session.execute(text(
        "INSERT INTO dc_room (name, site, room_type, tier_rating, total_racks, power_capacity_kw, cooling_type, pue_target, labels) "
        "VALUES (:name, :site, :room_type, :tier_rating, :total_racks, :power_capacity_kw, :cooling_type, :pue_target, '{}')"
    ), {"name": "DC1-Main", "site": "global-hq", "room_type": "data_center", "tier_rating": 3, "total_racks": 10, "power_capacity_kw": 500.0, "cooling_type": "crac", "pue_target": 1.4})
    dc1_room_id = session.execute(text("SELECT id FROM dc_room WHERE name = 'DC1-Main' AND site = 'global-hq'")).fetchone()[0]

    hq_racks = [
        ("A", 1, "spine", 12.0, 24.5), ("A", 2, "server", 8.0, 25.1),
        ("B", 1, "server", 8.0, 24.8), ("B", 2, "server", 8.0, 25.3),
        ("C", 1, "server", 8.0, 24.6), ("C", 2, "server", 8.0, 25.0),
        ("D", 1, "server", 8.0, 24.9), ("D", 2, "server", 8.0, 25.2),
        ("E", 1, "standard", 5.0, 23.8), ("E", 2, "standard", 5.0, 24.1),
    ]
    for row_letter, rack_num, rtype, power, temp in hq_racks:
        rack_name = f"{row_letter}{rack_num:02d}"
        session.execute(text(
            "INSERT INTO dc_rack (name, room_id, site, \"row\", rack_number, u_height, max_power_kw, current_temp_c, status, labels) "
            "VALUES (:name, :room_id, :site, :row, :rack_number, 42, :max_power_kw, :current_temp_c, 'active', '{}')"
        ), {"name": rack_name, "room_id": dc1_room_id, "site": "global-hq", "row": row_letter, "rack_number": rack_num, "max_power_kw": power, "current_temp_c": temp})
        rack_id = session.execute(text("SELECT id FROM dc_rack WHERE name = :name AND room_id = :room_id"), {"name": rack_name, "room_id": dc1_room_id}).fetchone()[0]
        populate_rack(session, rack_id, "global-hq", rtype)

    # --- global-hq: DC2-Backup ---
    session.execute(text(
        "INSERT INTO dc_room (name, site, room_type, tier_rating, total_racks, power_capacity_kw, cooling_type, pue_target, labels) "
        "VALUES (:name, :site, :room_type, :tier_rating, :total_racks, :power_capacity_kw, :cooling_type, :pue_target, '{}')"
    ), {"name": "DC2-Backup", "site": "global-hq", "room_type": "data_center", "tier_rating": 2, "total_racks": 5, "power_capacity_kw": 200.0, "cooling_type": "crah", "pue_target": 1.6})
    dc2_room_id = session.execute(text("SELECT id FROM dc_room WHERE name = 'DC2-Backup' AND site = 'global-hq'")).fetchone()[0]

    hq2_racks = [
        ("A", 1, "server", 6.0, 23.5), ("A", 2, "server", 6.0, 23.8),
        ("B", 1, "server", 6.0, 24.0), ("B", 2, "standard", 4.0, 23.2),
        ("C", 1, "standard", 4.0, 23.0),
    ]
    for row_letter, rack_num, rtype, power, temp in hq2_racks:
        rack_name = f"{row_letter}{rack_num:02d}"
        session.execute(text(
            "INSERT INTO dc_rack (name, room_id, site, \"row\", rack_number, u_height, max_power_kw, current_temp_c, status, labels) "
            "VALUES (:name, :room_id, :site, :row, :rack_number, 42, :max_power_kw, :current_temp_c, 'active', '{}')"
        ), {"name": rack_name, "room_id": dc2_room_id, "site": "global-hq", "row": row_letter, "rack_number": rack_num, "max_power_kw": power, "current_temp_c": temp})
        rack_id = session.execute(text("SELECT id FROM dc_rack WHERE name = :name AND room_id = :room_id"), {"name": rack_name, "room_id": dc2_room_id}).fetchone()[0]
        populate_rack(session, rack_id, "global-hq", rtype)

    # --- regional-dc-1: RDC1-Compute ---
    session.execute(text(
        "INSERT INTO dc_room (name, site, room_type, tier_rating, total_racks, power_capacity_kw, cooling_type, pue_target, labels) "
        "VALUES (:name, :site, :room_type, :tier_rating, :total_racks, :power_capacity_kw, :cooling_type, :pue_target, '{}')"
    ), {"name": "RDC1-Compute", "site": "regional-dc-1", "room_type": "data_center", "tier_rating": 2, "total_racks": 6, "power_capacity_kw": 120.0, "cooling_type": "in_row", "pue_target": 1.5})
    rdc_room_id = session.execute(text("SELECT id FROM dc_room WHERE name = 'RDC1-Compute' AND site = 'regional-dc-1'")).fetchone()[0]

    rdc_racks = [
        ("A", 1, "spine", 5.0, 22.5), ("A", 2, "server", 4.0, 23.1), ("A", 3, "server", 4.0, 23.4),
        ("B", 1, "server", 4.0, 22.8), ("B", 2, "server", 4.0, 23.0), ("B", 3, "standard", 3.0, 22.5),
    ]
    for row_letter, rack_num, rtype, power, temp in rdc_racks:
        rack_name = f"{row_letter}{rack_num:02d}"
        session.execute(text(
            "INSERT INTO dc_rack (name, room_id, site, \"row\", rack_number, u_height, max_power_kw, current_temp_c, status, labels) "
            "VALUES (:name, :room_id, :site, :row, :rack_number, 42, :max_power_kw, :current_temp_c, 'active', '{}')"
        ), {"name": rack_name, "room_id": rdc_room_id, "site": "regional-dc-1", "row": row_letter, "rack_number": rack_num, "max_power_kw": power, "current_temp_c": temp})
        rack_id = session.execute(text("SELECT id FROM dc_rack WHERE name = :name AND room_id = :room_id"), {"name": rack_name, "room_id": rdc_room_id}).fetchone()[0]
        populate_rack(session, rack_id, "regional-dc-1", rtype)

    # --- metro-ring-1: WC-Metro ---
    session.execute(text(
        "INSERT INTO dc_room (name, site, room_type, tier_rating, total_racks, power_capacity_kw, cooling_type, pue_target, labels) "
        "VALUES (:name, :site, :room_type, :tier_rating, :total_racks, :power_capacity_kw, :cooling_type, :pue_target, '{}')"
    ), {"name": "WC-Metro", "site": "metro-ring-1", "room_type": "wiring_closet", "tier_rating": 1, "total_racks": 2, "power_capacity_kw": 20.0, "cooling_type": "split", "pue_target": 1.8})
    wc_room_id = session.execute(text("SELECT id FROM dc_room WHERE name = 'WC-Metro' AND site = 'metro-ring-1'")).fetchone()[0]

    metro_racks = [("A", 1, "standard", 3.0, 25.0), ("A", 2, "standard", 3.0, 25.3)]
    for row_letter, rack_num, rtype, power, temp in metro_racks:
        rack_name = f"{row_letter}{rack_num:02d}"
        session.execute(text(
            "INSERT INTO dc_rack (name, room_id, site, \"row\", rack_number, u_height, max_power_kw, current_temp_c, status, labels) "
            "VALUES (:name, :room_id, :site, :row, :rack_number, 42, :max_power_kw, :current_temp_c, 'active', '{}')"
        ), {"name": rack_name, "room_id": wc_room_id, "site": "metro-ring-1", "row": row_letter, "rack_number": rack_num, "max_power_kw": power, "current_temp_c": temp})
        rack_id = session.execute(text("SELECT id FROM dc_rack WHERE name = :name AND room_id = :room_id"), {"name": rack_name, "room_id": wc_room_id}).fetchone()[0]
        populate_rack(session, rack_id, "metro-ring-1", rtype)

    # --- branch-nyc: IDF-NYC ---
    session.execute(text(
        "INSERT INTO dc_room (name, site, room_type, tier_rating, total_racks, power_capacity_kw, cooling_type, pue_target, labels) "
        "VALUES (:name, :site, :room_type, :tier_rating, :total_racks, :power_capacity_kw, :cooling_type, :pue_target, '{}')"
    ), {"name": "IDF-NYC", "site": "branch-nyc", "room_type": "wiring_closet", "tier_rating": 1, "total_racks": 2, "power_capacity_kw": 10.0, "cooling_type": "split", "pue_target": 1.9})
    nyc_room_id = session.execute(text("SELECT id FROM dc_room WHERE name = 'IDF-NYC' AND site = 'branch-nyc'")).fetchone()[0]

    nyc_racks = [("A", 1, "standard", 2.0, 26.0), ("A", 2, "closet", 1.5, 26.5)]
    for row_letter, rack_num, rtype, power, temp in nyc_racks:
        rack_name = f"{row_letter}{rack_num:02d}"
        session.execute(text(
            "INSERT INTO dc_rack (name, room_id, site, \"row\", rack_number, u_height, max_power_kw, current_temp_c, status, labels) "
            "VALUES (:name, :room_id, :site, :row, :rack_number, 42, :max_power_kw, :current_temp_c, 'active', '{}')"
        ), {"name": rack_name, "room_id": nyc_room_id, "site": "branch-nyc", "row": row_letter, "rack_number": rack_num, "max_power_kw": power, "current_temp_c": temp})
        rack_id = session.execute(text("SELECT id FROM dc_rack WHERE name = :name AND room_id = :room_id"), {"name": rack_name, "room_id": nyc_room_id}).fetchone()[0]
        populate_rack(session, rack_id, "branch-nyc", rtype)

    # --- branch-london: MDF-London ---
    session.execute(text(
        "INSERT INTO dc_room (name, site, room_type, tier_rating, total_racks, power_capacity_kw, cooling_type, pue_target, labels) "
        "VALUES (:name, :site, :room_type, :tier_rating, :total_racks, :power_capacity_kw, :cooling_type, :pue_target, '{}')"
    ), {"name": "MDF-London", "site": "branch-london", "room_type": "meet_me_room", "tier_rating": 1, "total_racks": 1, "power_capacity_kw": 5.0, "cooling_type": "split", "pue_target": 2.0})
    lon_room_id = session.execute(text("SELECT id FROM dc_room WHERE name = 'MDF-London' AND site = 'branch-london'")).fetchone()[0]

    session.execute(text(
        "INSERT INTO dc_rack (name, room_id, site, \"row\", rack_number, u_height, max_power_kw, current_temp_c, status, labels) "
        "VALUES (:name, :room_id, :site, :row, :rack_number, 42, :max_power_kw, :current_temp_c, 'active', '{}')"
    ), {"name": "A01", "room_id": lon_room_id, "site": "branch-london", "row": "A", "rack_number": 1, "max_power_kw": 2.0, "current_temp_c": 27.0})
    rack_id = session.execute(text("SELECT id FROM dc_rack WHERE name = 'A01' AND room_id = :room_id"), {"room_id": lon_room_id}).fetchone()[0]
    populate_rack(session, rack_id, "branch-london", "closet")


def seed():
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM dc_rack_equipment"))
        conn.execute(text("DELETE FROM dc_rack"))
        conn.execute(text("DELETE FROM dc_room"))
        conn.execute(text("DELETE FROM service_ci"))
        conn.execute(text("DELETE FROM relationship"))
        conn.execute(text("DELETE FROM ci"))
        conn.execute(text("DELETE FROM service"))
        conn.commit()

        for svc in services:
            conn.execute(text(
                "INSERT INTO service (id, name, owner_team, sla_tier) VALUES (:id, :name, :owner_team, :sla_tier)"
            ), svc)

        for ci in cis:
            conn.execute(text(
                """INSERT INTO ci (id, name, type, provider, environment, team, labels, site, site_type, network_layer, topology_type)
                   VALUES (:id, :name, :type, :provider, :environment, :team, CAST(:labels AS jsonb), :site, :site_type, :network_layer, :topology_type)"""
            ), {**ci, "labels": json.dumps(ci.get("labels", {}))})

        for svc_idx, ci_idx, role in service_ci_map:
            conn.execute(text(
                "INSERT INTO service_ci (service_id, ci_id, role) VALUES (:sid, :cid, :role)"
            ), {"sid": services[svc_idx]["id"], "cid": cis[ci_idx]["id"], "role": role})

        for rel in relationships:
            conn.execute(text(
                "INSERT INTO relationship (source_id, target_id, type, discovered_by) VALUES (:source_id, :target_id, :type, 'manual')"
            ), {"source_id": cis[rel["source"]]["id"], "target_id": cis[rel["target"]]["id"], "type": rel["type"]})

        seed_dc_data(conn)

        conn.commit()
    print(f"Seed data inserted: {len(services)} services, {len(cis)} CIs, {len(relationships)} relationships")
    sites = {}
    for ci in cis:
        s = ci.get("site", "unknown")
        sites[s] = sites.get(s, 0) + 1
    print(f"Sites: {sites}")


if __name__ == "__main__":
    seed()
