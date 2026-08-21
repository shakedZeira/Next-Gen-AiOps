#!/usr/bin/env python3
"""Standalone seed script that runs inside the api-gateway container."""
import uuid
import json
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://aiops:aiops@postgres:5432/aiops"
engine = create_engine(DATABASE_URL)

SITE_PREFIX = {"global-hq": 0, "regional-dc-1": 1, "metro-ring-1": 2, "branch-nyc": 3, "branch-london": 4}
mc = {}
lc = {}
hc = {}

def assign_ips(ci):
    site = ci.get("site", "")
    ci_type = ci.get("type", "")
    sp = SITE_PREFIX.get(site, 0)
    if ci_type == "router":
        lc.setdefault(site, 1)
        ci["loopback_ip"] = f"10.{sp}.0.{lc[site]}"
        lc[site] += 1
        mc.setdefault(site, 1)
        ci["management_ip"] = f"10.{sp}.1.{mc[site]}"
        mc[site] += 1
        ci["subnet"] = f"10.{sp}.0.0/24"
    elif ci_type == "switch":
        mc.setdefault(site, 1)
        ci["management_ip"] = f"10.{sp}.1.{mc[site]}"
        mc[site] += 1
        ci["subnet"] = f"10.{sp}.1.0/24"
    elif ci_type == "firewall":
        mc.setdefault(site, 1)
        ci["management_ip"] = f"10.{sp}.2.{mc[site]}"
        mc[site] += 1
        ci["subnet"] = f"10.{sp}.2.0/24"
    elif ci_type == "load_balancer":
        mc.setdefault(site, 1)
        ci["management_ip"] = f"10.{sp}.3.{mc[site]}"
        mc[site] += 1
        ci["subnet"] = f"10.{sp}.3.0/24"
    elif ci_type in ("physical_server", "host"):
        hc.setdefault(site, 1)
        ci["management_ip"] = f"10.{sp}.10.{hc[site]}"
        hc[site] += 1
        ci["subnet"] = f"10.{sp}.10.0/24"
    elif ci_type == "database":
        hc.setdefault(site, 100)
        ci["management_ip"] = f"10.{sp}.20.{hc[site] - 99}"
        ci["loopback_ip"] = f"10.{sp}.20.{hc[site]}"
        hc[site] += 1
        ci["subnet"] = f"10.{sp}.20.0/24"
    elif ci_type == "cache":
        hc.setdefault(site, 200)
        ci["management_ip"] = f"10.{sp}.30.{hc[site] - 199}"
        hc[site] += 1
        ci["subnet"] = f"10.{sp}.30.0/24"
    elif ci_type == "message_queue":
        hc.setdefault(site, 300)
        ci["management_ip"] = f"10.{sp}.40.{hc[site] - 299}"
        hc[site] += 1
        ci["subnet"] = f"10.{sp}.40.0/24"
    elif ci_type == "storage":
        hc.setdefault(site, 400)
        ci["management_ip"] = f"10.{sp}.50.{hc[site] - 399}"
        hc[site] += 1
        ci["subnet"] = f"10.{sp}.50.0/24"


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

cis = [
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
    {"id": str(uuid.uuid4()), "name": "hq-core-sw-1", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9600", "ports": "48", "role": "core", "speed_uplink": "100G"}},
    {"id": str(uuid.uuid4()), "name": "hq-core-sw-2", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9600", "ports": "48", "role": "core", "speed_uplink": "100G"}},
    {"id": str(uuid.uuid4()), "name": "hq-dist-sw-1a", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "distribution", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9500", "ports": "48", "role": "distribution", "speed_uplink": "40G", "ha_pair": "hq-dist-sw-1b"}},
    {"id": str(uuid.uuid4()), "name": "hq-dist-sw-1b", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "distribution", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9500", "ports": "48", "role": "distribution", "speed_uplink": "40G", "ha_pair": "hq-dist-sw-1a"}},
    {"id": str(uuid.uuid4()), "name": "hq-dist-sw-2a", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "distribution", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9500", "ports": "48", "role": "distribution", "speed_uplink": "40G", "ha_pair": "hq-dist-sw-2b"}},
    {"id": str(uuid.uuid4()), "name": "hq-dist-sw-2b", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "distribution", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9500", "ports": "48", "role": "distribution", "speed_uplink": "40G", "ha_pair": "hq-dist-sw-2a"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-1", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-2", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-3", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-4", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-5", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-6", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-7", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-acc-sw-8", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "catalyst-9300", "ports": "48", "role": "access", "speed_uplink": "10G"}},
    {"id": str(uuid.uuid4()), "name": "hq-wan-router-1", "type": "router", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "wan_edge", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "csr-1000v", "role": "wan_edge", "transport": "mpls", "sdwan_color": "mpls"}},
    {"id": str(uuid.uuid4()), "name": "hq-wan-router-2", "type": "router", "provider": "cisco", "environment": "prod", "team": "network", "site": "global-hq", "site_type": "hq", "network_layer": "wan_edge", "topology_type": "hierarchical", "labels": {"vendor": "cisco", "model": "csr-1000v", "role": "wan_edge", "transport": "internet", "sdwan_color": "public-internet"}},
    {"id": str(uuid.uuid4()), "name": "hq-firewall-1", "type": "firewall", "provider": "paloalto", "environment": "prod", "team": "security", "site": "global-hq", "site_type": "hq", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "paloalto", "model": "pa-5250", "role": "perimeter", "ha_pair": "hq-firewall-2"}},
    {"id": str(uuid.uuid4()), "name": "hq-firewall-2", "type": "firewall", "provider": "paloalto", "environment": "prod", "team": "security", "site": "global-hq", "site_type": "hq", "network_layer": "core", "topology_type": "hierarchical", "labels": {"vendor": "paloalto", "model": "pa-5250", "role": "perimeter", "ha_pair": "hq-firewall-1"}},
    {"id": str(uuid.uuid4()), "name": "hq-web-host-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "frontend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "16", "ram_gb": "64", "rack": "A1"}},
    {"id": str(uuid.uuid4()), "name": "hq-web-host-2", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "frontend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "16", "ram_gb": "64", "rack": "A2"}},
    {"id": str(uuid.uuid4()), "name": "hq-app-host-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "32", "ram_gb": "128", "rack": "B1"}},
    {"id": str(uuid.uuid4()), "name": "hq-app-host-2", "type": "physical_server", "provider": "hp", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "windows", "os_version": "server-2022", "cpu": "32", "ram_gb": "128", "rack": "B2"}},
    {"id": str(uuid.uuid4()), "name": "hq-db-host-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "64", "ram_gb": "256", "rack": "C1"}},
    {"id": str(uuid.uuid4()), "name": "hq-monitor-host-1", "type": "physical_server", "provider": "hp", "environment": "prod", "team": "sre", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"os": "windows", "os_version": "server-2022", "cpu": "16", "ram_gb": "32", "rack": "D1"}},
    {"id": str(uuid.uuid4()), "name": "hq-nginx-proxy", "type": "container", "provider": "docker", "environment": "prod", "team": "frontend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "nginx:1.25", "host": "hq-web-host-1", "port": "443"}},
    {"id": str(uuid.uuid4()), "name": "hq-ecommerce-app", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "node:20", "host": "hq-app-host-1", "port": "3000"}},
    {"id": str(uuid.uuid4()), "name": "hq-payments-app", "type": "container", "provider": "docker", "environment": "prod", "team": "payments", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "python:3.11", "host": "hq-app-host-1", "port": "8080"}},
    {"id": str(uuid.uuid4()), "name": "hq-inventory-app", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "python:3.11", "host": "hq-app-host-2", "port": "8081"}},
    {"id": str(uuid.uuid4()), "name": "hq-redis-node", "type": "container", "provider": "docker", "environment": "prod", "team": "platform", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "redis:7", "host": "hq-app-host-1", "port": "6379"}},
    {"id": str(uuid.uuid4()), "name": "hq-kafka-node", "type": "container", "provider": "docker", "environment": "prod", "team": "platform", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"image": "confluentinc/cp-kafka:7.5", "host": "hq-app-host-2", "port": "9092"}},
    {"id": str(uuid.uuid4()), "name": "hq-order-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-app-host-1", "deployment": "order-service"}},
    {"id": str(uuid.uuid4()), "name": "hq-order-pod-2", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "backend", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-app-host-2", "deployment": "order-service"}},
    {"id": str(uuid.uuid4()), "name": "hq-analytics-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "data", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-db-host-1", "deployment": "analytics-api"}},
    {"id": str(uuid.uuid4()), "name": "hq-auth-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "security", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-app-host-1", "deployment": "auth-api"}},
    {"id": str(uuid.uuid4()), "name": "hq-notification-pod-1", "type": "pod", "provider": "kubernetes", "environment": "prod", "team": "platform", "site": "global-hq", "site_type": "hq", "network_layer": "access", "topology_type": "hierarchical", "labels": {"namespace": "production", "node": "hq-app-host-2", "deployment": "notification-svc"}},
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
    {"id": str(uuid.uuid4()), "name": "ring-sw-1", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-2", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-3", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-4", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-5", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1", "rpl_owner": "true"}},
    {"id": str(uuid.uuid4()), "name": "ring-sw-6", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "distribution", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex4400", "ports": "24", "role": "ring_node", "ring_id": "metro-ring-01", "ring_port_east": "xe-0/0/0", "ring_port_west": "xe-0/0/1"}},
    {"id": str(uuid.uuid4()), "name": "ring-acc-sw-1", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex2300", "ports": "48", "role": "access", "ring_id": "metro-ring-01-sub"}},
    {"id": str(uuid.uuid4()), "name": "ring-acc-sw-2", "type": "switch", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "ex2300", "ports": "48", "role": "access", "ring_id": "metro-ring-01-sub"}},
    {"id": str(uuid.uuid4()), "name": "ring-pe-router-1", "type": "router", "provider": "juniper", "environment": "prod", "team": "network", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "wan_edge", "topology_type": "ring", "labels": {"vendor": "juniper", "model": "mx204", "role": "pe", "connected_to_ring": "ring-sw-1,ring-sw-2"}},
    {"id": str(uuid.uuid4()), "name": "ring-app-server-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "32", "ram_gb": "128"}},
    {"id": str(uuid.uuid4()), "name": "ring-app-server-2", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "32", "ram_gb": "128"}},
    {"id": str(uuid.uuid4()), "name": "ring-db-server-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "data", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"os": "linux", "os_version": "rhel-9", "cpu": "64", "ram_gb": "256", "role": "database"}},
    {"id": str(uuid.uuid4()), "name": "ring-app-1", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"image": "node:20", "host": "ring-app-server-1", "port": "3000"}},
    {"id": str(uuid.uuid4()), "name": "ring-app-2", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"image": "python:3.11", "host": "ring-app-server-2", "port": "8080"}},
    {"id": str(uuid.uuid4()), "name": "ring-postgres-1", "type": "database", "provider": "postgresql", "environment": "prod", "team": "data", "site": "metro-ring-1", "site_type": "large_branch", "network_layer": "access", "topology_type": "ring", "labels": {"engine": "postgresql", "version": "15", "role": "primary"}},
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
    {"id": str(uuid.uuid4()), "name": "lon-access-switch", "type": "switch", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-london", "site_type": "small_branch", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"vendor": "cisco", "model": "catalyst-9200", "ports": "24", "role": "access", "speed_uplink": "1G"}},
    {"id": str(uuid.uuid4()), "name": "lon-sdwan-edge", "type": "router", "provider": "cisco", "environment": "prod", "team": "network", "site": "branch-london", "site_type": "small_branch", "network_layer": "wan_edge", "topology_type": "hub_and_spoke", "labels": {"vendor": "cisco", "model": "vedge-100", "role": "sdwan_edge", "sdwan_color": "public-internet", "transport": "internet"}},
    {"id": str(uuid.uuid4()), "name": "lon-server-1", "type": "physical_server", "provider": "dell", "environment": "prod", "team": "backend", "site": "branch-london", "site_type": "small_branch", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"os": "linux", "os_version": "ubuntu-22.04", "cpu": "16", "ram_gb": "64"}},
    {"id": str(uuid.uuid4()), "name": "lon-app-1", "type": "container", "provider": "docker", "environment": "prod", "team": "backend", "site": "branch-london", "site_type": "small_branch", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"image": "node:20", "host": "lon-server-1", "port": "3000"}},
    {"id": str(uuid.uuid4()), "name": "lon-local-cache", "type": "cache", "provider": "redis", "environment": "prod", "team": "platform", "site": "branch-london", "site_type": "small_branch", "network_layer": "access", "topology_type": "hub_and_spoke", "labels": {"engine": "redis", "version": "7.2"}},
]

for ci in cis:
    assign_ips(ci)

name_to_idx = {cis[i]["name"]: i for i in range(len(cis))}

relationships = [
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-core-sw-2"], "type": "connected_to"},
    {"source": name_to_idx["hq-dist-sw-1a"], "target": name_to_idx["hq-dist-sw-1b"], "type": "connected_to"},
    {"source": name_to_idx["hq-dist-sw-2a"], "target": name_to_idx["hq-dist-sw-2b"], "type": "connected_to"},
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-dist-sw-1a"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-dist-sw-2a"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-2"], "target": name_to_idx["hq-dist-sw-1b"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-2"], "target": name_to_idx["hq-dist-sw-2b"], "type": "routes_to"},
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
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-wan-router-1"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-wan-router-2"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-2"], "target": name_to_idx["hq-wan-router-1"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-2"], "target": name_to_idx["hq-wan-router-2"], "type": "routes_to"},
    {"source": name_to_idx["hq-core-sw-1"], "target": name_to_idx["hq-firewall-1"], "type": "connected_to"},
    {"source": name_to_idx["hq-core-sw-2"], "target": name_to_idx["hq-firewall-2"], "type": "connected_to"},
    {"source": name_to_idx["hq-firewall-1"], "target": name_to_idx["hq-firewall-2"], "type": "connected_to"},
    {"source": name_to_idx["hq-acc-sw-1"], "target": name_to_idx["nginx-lb-1"], "type": "routes_to"},
    {"source": name_to_idx["nginx-lb-1"], "target": name_to_idx["web-server-1"], "type": "load_balances"},
    {"source": name_to_idx["nginx-lb-1"], "target": name_to_idx["web-server-2"], "type": "load_balances"},
    {"source": name_to_idx["web-server-1"], "target": name_to_idx["api-gateway-ci"], "type": "routes_to"},
    {"source": name_to_idx["web-server-2"], "target": name_to_idx["api-gateway-ci"], "type": "routes_to"},
    {"source": name_to_idx["api-gateway-ci"], "target": name_to_idx["order-api"], "type": "routes_to"},
    {"source": name_to_idx["api-gateway-ci"], "target": name_to_idx["payment-processor-1"], "type": "routes_to"},
    {"source": name_to_idx["api-gateway-ci"], "target": name_to_idx["notification-svc"], "type": "routes_to"},
    {"source": name_to_idx["api-gateway-ci"], "target": name_to_idx["auth-api"], "type": "routes_to"},
    {"source": name_to_idx["api-gateway-ci"], "target": name_to_idx["analytics-api"], "type": "routes_to"},
    {"source": name_to_idx["order-api"], "target": name_to_idx["order-service"], "type": "routes_to"},
    {"source": name_to_idx["order-service"], "target": name_to_idx["order-db"], "type": "connects_to"},
    {"source": name_to_idx["order-service"], "target": name_to_idx["inventory-db"], "type": "connects_to"},
    {"source": name_to_idx["payment-processor-1"], "target": name_to_idx["postgres-payments"], "type": "connects_to"},
    {"source": name_to_idx["notification-svc"], "target": name_to_idx["notification-db"], "type": "connects_to"},
    {"source": name_to_idx["auth-api"], "target": name_to_idx["postgres-auth"], "type": "connects_to"},
    {"source": name_to_idx["analytics-api"], "target": name_to_idx["clickhouse-db"], "type": "connects_to"},
    {"source": name_to_idx["analytics-api"], "target": name_to_idx["s3-data-lake"], "type": "connects_to"},
    {"source": name_to_idx["analytics-api"], "target": name_to_idx["analytics-ui"], "type": "routes_to"},
    {"source": name_to_idx["hq-wan-router-1"], "target": name_to_idx["dc1-wan-router-1"], "type": "wan_link"},
    {"source": name_to_idx["hq-wan-router-1"], "target": name_to_idx["ring-pe-router-1"], "type": "wan_link"},
    {"source": name_to_idx["dc1-core-sw-1"], "target": name_to_idx["dc1-core-sw-2"], "type": "connected_to"},
    {"source": name_to_idx["dc1-core-sw-1"], "target": name_to_idx["dc1-dist-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["dc1-core-sw-1"], "target": name_to_idx["dc1-dist-sw-2"], "type": "routes_to"},
    {"source": name_to_idx["dc1-core-sw-2"], "target": name_to_idx["dc1-dist-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["dc1-core-sw-2"], "target": name_to_idx["dc1-dist-sw-2"], "type": "routes_to"},
    {"source": name_to_idx["dc1-dist-sw-1"], "target": name_to_idx["dc1-lb-1"], "type": "routes_to"},
    {"source": name_to_idx["dc1-dist-sw-2"], "target": name_to_idx["dc1-firewall-1"], "type": "routes_to"},
    {"source": name_to_idx["dc1-lb-1"], "target": name_to_idx["dc1-app-server-1"], "type": "load_balances"},
    {"source": name_to_idx["dc1-lb-1"], "target": name_to_idx["dc1-app-server-2"], "type": "load_balances"},
    {"source": name_to_idx["dc1-core-sw-1"], "target": name_to_idx["dc1-wan-router-1"], "type": "routes_to"},
    {"source": name_to_idx["dc1-core-sw-1"], "target": name_to_idx["dc1-wan-router-2"], "type": "routes_to"},
    {"source": name_to_idx["dc1-core-sw-2"], "target": name_to_idx["dc1-wan-router-1"], "type": "routes_to"},
    {"source": name_to_idx["dc1-core-sw-2"], "target": name_to_idx["dc1-wan-router-2"], "type": "routes_to"},
    {"source": name_to_idx["dc1-app-server-1"], "target": name_to_idx["dc1-postgres-primary"], "type": "connects_to"},
    {"source": name_to_idx["dc1-app-server-2"], "target": name_to_idx["dc1-postgres-replica"], "type": "connects_to"},
    {"source": name_to_idx["dc1-app-server-1"], "target": name_to_idx["dc1-redis-cluster"], "type": "connects_to"},
    {"source": name_to_idx["dc1-app-server-1"], "target": name_to_idx["dc1-kafka-cluster"], "type": "connects_to"},
    {"source": name_to_idx["dc1-postgres-primary"], "target": name_to_idx["dc1-postgres-replica"], "type": "replication"},
    {"source": name_to_idx["dc1-wan-router-1"], "target": name_to_idx["nyc-sdwan-edge-1"], "type": "wan_link"},
    {"source": name_to_idx["dc1-wan-router-2"], "target": name_to_idx["lon-sdwan-edge"], "type": "wan_link"},
    {"source": name_to_idx["dc1-app-server-1"], "target": name_to_idx["dc1-storage-1"], "type": "connects_to"},
    {"source": name_to_idx["ring-sw-1"], "target": name_to_idx["ring-sw-2"], "type": "ring_link"},
    {"source": name_to_idx["ring-sw-2"], "target": name_to_idx["ring-sw-3"], "type": "ring_link"},
    {"source": name_to_idx["ring-sw-3"], "target": name_to_idx["ring-sw-4"], "type": "ring_link"},
    {"source": name_to_idx["ring-sw-4"], "target": name_to_idx["ring-sw-5"], "type": "ring_link"},
    {"source": name_to_idx["ring-sw-5"], "target": name_to_idx["ring-sw-6"], "type": "ring_link"},
    {"source": name_to_idx["ring-sw-6"], "target": name_to_idx["ring-sw-1"], "type": "ring_link"},
    {"source": name_to_idx["ring-sw-1"], "target": name_to_idx["ring-acc-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["ring-sw-3"], "target": name_to_idx["ring-acc-sw-2"], "type": "routes_to"},
    {"source": name_to_idx["ring-sw-1"], "target": name_to_idx["ring-pe-router-1"], "type": "routes_to"},
    {"source": name_to_idx["ring-sw-2"], "target": name_to_idx["ring-pe-router-1"], "type": "routes_to"},
    {"source": name_to_idx["ring-app-server-1"], "target": name_to_idx["ring-app-1"], "type": "hosts"},
    {"source": name_to_idx["ring-app-server-2"], "target": name_to_idx["ring-app-2"], "type": "hosts"},
    {"source": name_to_idx["ring-app-server-1"], "target": name_to_idx["ring-postgres-1"], "type": "connects_to"},
    {"source": name_to_idx["ring-app-server-2"], "target": name_to_idx["ring-postgres-1"], "type": "connects_to"},
    {"source": name_to_idx["nyc-core-sw-1"], "target": name_to_idx["nyc-core-sw-2"], "type": "connected_to"},
    {"source": name_to_idx["nyc-core-sw-1"], "target": name_to_idx["nyc-acc-sw-1"], "type": "routes_to"},
    {"source": name_to_idx["nyc-core-sw-1"], "target": name_to_idx["nyc-acc-sw-2"], "type": "routes_to"},
    {"source": name_to_idx["nyc-core-sw-2"], "target": name_to_idx["nyc-acc-sw-3"], "type": "routes_to"},
    {"source": name_to_idx["nyc-core-sw-2"], "target": name_to_idx["nyc-acc-sw-4"], "type": "routes_to"},
    {"source": name_to_idx["nyc-core-sw-1"], "target": name_to_idx["nyc-firewall-1"], "type": "routes_to"},
    {"source": name_to_idx["nyc-core-sw-2"], "target": name_to_idx["nyc-firewall-1"], "type": "routes_to"},
    {"source": name_to_idx["nyc-firewall-1"], "target": name_to_idx["nyc-sdwan-edge-1"], "type": "routes_to"},
    {"source": name_to_idx["nyc-firewall-1"], "target": name_to_idx["nyc-sdwan-edge-2"], "type": "routes_to"},
    {"source": name_to_idx["nyc-acc-sw-1"], "target": name_to_idx["nyc-server-1"], "type": "routes_to"},
    {"source": name_to_idx["nyc-acc-sw-2"], "target": name_to_idx["nyc-server-2"], "type": "routes_to"},
    {"source": name_to_idx["nyc-server-1"], "target": name_to_idx["nyc-app-1"], "type": "hosts"},
    {"source": name_to_idx["nyc-server-1"], "target": name_to_idx["nyc-cache-1"], "type": "connects_to"},
    {"source": name_to_idx["lon-access-switch"], "target": name_to_idx["lon-sdwan-edge"], "type": "routes_to"},
    {"source": name_to_idx["lon-access-switch"], "target": name_to_idx["lon-server-1"], "type": "routes_to"},
    {"source": name_to_idx["lon-server-1"], "target": name_to_idx["lon-app-1"], "type": "hosts"},
    {"source": name_to_idx["lon-server-1"], "target": name_to_idx["lon-local-cache"], "type": "connects_to"},
]

service_ci_map = {
    "E-Commerce Platform": ["nginx-lb-1", "web-server-1", "web-server-2", "api-gateway-ci", "order-api", "order-service"],
    "Payment Gateway": ["payment-processor-1", "postgres-payments"],
    "Inventory Service": ["inventory-db", "order-db"],
    "Notification Service": ["notification-svc", "notification-db"],
    "Order Processing": ["order-api", "order-service", "order-db"],
    "Analytics Pipeline": ["analytics-api", "clickhouse-db", "s3-data-lake", "analytics-ui"],
    "Auth Service": ["auth-api", "postgres-auth"],
    "Network Infrastructure": ["hq-core-sw-1", "hq-core-sw-2", "hq-dist-sw-1a", "hq-dist-sw-1b", "hq-dist-sw-2a", "hq-dist-sw-2b", "hq-wan-router-1", "hq-wan-router-2", "hq-firewall-1", "hq-firewall-2", "dc1-core-sw-1", "dc1-core-sw-2", "dc1-dist-sw-1", "dc1-dist-sw-2", "dc1-wan-router-1", "dc1-wan-router-2", "ring-sw-1", "ring-sw-2", "ring-sw-3", "ring-sw-4", "ring-sw-5", "ring-sw-6", "nyc-core-sw-1", "nyc-core-sw-2", "nyc-sdwan-edge-1", "nyc-sdwan-edge-2", "lon-access-switch", "lon-sdwan-edge"],
}
name_to_ci = {ci["name"]: ci["id"] for ci in cis}
name_to_svc = {s["name"]: s["id"] for s in services}

with engine.connect() as conn:
    for table in ["service_ci", "relationship", "ci", "service"]:
        conn.execute(text(f"DELETE FROM {table}"))
    conn.commit()

    for s in services:
        conn.execute(text("INSERT INTO service (id, name, owner_team, sla_tier) VALUES (:id, :name, :owner_team, :sla_tier)"), s)
    conn.commit()

    for ci in cis:
        conn.execute(text("INSERT INTO ci (id, name, type, provider, environment, team, site, site_type, network_layer, topology_type, management_ip, loopback_ip, subnet, labels) VALUES (:id, :name, :type, :provider, :environment, :team, :site, :site_type, :network_layer, :topology_type, :management_ip, :loopback_ip, :subnet, :labels)"), ci)
    conn.commit()

    for rel in relationships:
        conn.execute(text("INSERT INTO relationship (id, source_id, target_id, type) VALUES (gen_random_uuid(), :source_id, :target_id, :type)"), {"source_id": cis[rel["source"]]["id"], "target_id": cis[rel["target"]]["id"], "type": rel["type"]})
    conn.commit()

    for svc_name, ci_names in service_ci_map.items():
        svc_id = name_to_svc.get(svc_name)
        if svc_id:
            for ci_name in ci_names:
                ci_id = name_to_ci.get(ci_name)
                if ci_id:
                    conn.execute(text("INSERT INTO service_ci (id, service_id, ci_id, role) VALUES (gen_random_uuid(), :svc_id, :ci_id, :role)"), {"svc_id": svc_id, "ci_id": ci_id, "role": "dependency"})
    conn.commit()

    result = conn.execute(text("SELECT COUNT(*) FROM ci"))
    count = result.scalar()
    result2 = conn.execute(text("SELECT COUNT(*) FROM ci WHERE management_ip IS NOT NULL"))
    ip_count = result2.scalar()
    print(f"Seeded {count} CIs, {ip_count} with IPs")
    result3 = conn.execute(text("SELECT name, management_ip, loopback_ip FROM ci WHERE management_ip IS NOT NULL LIMIT 10"))
    for row in result3:
        print(f"  {row[0]}: mgmt={row[1]}, lo={row[2]}")
