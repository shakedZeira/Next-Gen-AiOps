import uuid, json
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://aiops:aiops@postgres:5432/aiops"
engine = create_engine(DATABASE_URL)

seed_globals = {}
with open("/db/seed.py") as f:
    code = f.read().replace(
        'DATABASE_URL = "postgresql://aiops:aiops@localhost:5432/aiops"',
        'DATABASE_URL = "postgresql://aiops:aiops@postgres:5432/aiops"'
    )
exec(code, seed_globals)

services = seed_globals["services"]
cis = seed_globals["cis"]
relationships = seed_globals["relationships"]
name_to_idx = seed_globals["name_to_idx"]

SITE_PREFIX = {"global-hq": 0, "regional-dc-1": 1, "metro-ring-1": 2, "branch-nyc": 3, "branch-london": 4}
mc, lc = {}, {}
hc = {}      # hosts/servers
dbc = {}     # databases
cc = {}      # caches
mqc = {}     # message queues
stc = {}     # storage

def assign_ips(ci):
    site = ci.get("site", "")
    ci_type = ci.get("type", "")
    sp = SITE_PREFIX.get(site, 0)
    if ci_type == "router":
        lc.setdefault(site, 1); ci["loopback_ip"] = f"10.{sp}.0.{lc[site]}"; lc[site] += 1
        mc.setdefault(site, 1); ci["management_ip"] = f"10.{sp}.1.{mc[site]}"; mc[site] += 1
        ci["subnet"] = f"10.{sp}.0.0/24"
    elif ci_type == "switch":
        mc.setdefault(site, 1); ci["management_ip"] = f"10.{sp}.1.{mc[site]}"; mc[site] += 1
        ci["subnet"] = f"10.{sp}.1.0/24"
    elif ci_type == "firewall":
        mc.setdefault(site, 1); ci["management_ip"] = f"10.{sp}.2.{mc[site]}"; mc[site] += 1
        ci["subnet"] = f"10.{sp}.2.0/24"
    elif ci_type == "load_balancer":
        mc.setdefault(site, 1); ci["management_ip"] = f"10.{sp}.3.{mc[site]}"; mc[site] += 1
        ci["subnet"] = f"10.{sp}.3.0/24"
    elif ci_type in ("physical_server", "host"):
        hc.setdefault(site, 1); ci["management_ip"] = f"10.{sp}.10.{hc[site]}"; hc[site] += 1
        ci["subnet"] = f"10.{sp}.10.0/24"
    elif ci_type == "database":
        dbc.setdefault(site, 1); ci["management_ip"] = f"10.{sp}.20.{dbc[site]}"; ci["loopback_ip"] = f"10.{sp}.20.{dbc[site]+100}"; dbc[site] += 1
        ci["subnet"] = f"10.{sp}.20.0/24"
    elif ci_type == "cache":
        cc.setdefault(site, 1); ci["management_ip"] = f"10.{sp}.30.{cc[site]}"; cc[site] += 1
        ci["subnet"] = f"10.{sp}.30.0/24"
    elif ci_type == "message_queue":
        mqc.setdefault(site, 1); ci["management_ip"] = f"10.{sp}.40.{mqc[site]}"; mqc[site] += 1
        ci["subnet"] = f"10.{sp}.40.0/24"
    elif ci_type == "storage":
        stc.setdefault(site, 1); ci["management_ip"] = f"10.{sp}.50.{stc[site]}"; stc[site] += 1
        ci["subnet"] = f"10.{sp}.50.0/24"

for ci in cis:
    ci.setdefault("management_ip", None)
    ci.setdefault("loopback_ip", None)
    ci.setdefault("subnet", None)
    assign_ips(ci)
    ci.setdefault("management_ip", None)
    ci.setdefault("loopback_ip", None)
    ci.setdefault("subnet", None)

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
        ci_params = dict(ci)
        ci_params["labels"] = json.dumps(ci_params["labels"])
        conn.execute(text("INSERT INTO ci (id, name, type, provider, environment, team, site, site_type, network_layer, topology_type, management_ip, loopback_ip, subnet, labels) VALUES (:id, :name, :type, :provider, :environment, :team, :site, :site_type, :network_layer, :topology_type, :management_ip, :loopback_ip, :subnet, CAST(:labels AS jsonb))"), ci_params)
    conn.commit()

    for rel in relationships:
        conn.execute(text("INSERT INTO relationship (id, source_id, target_id, type) VALUES (gen_random_uuid(), :source_id, :target_id, :type)"), {"source_id": cis[rel["source"]]["id"], "target_id": cis[rel["target"]]["id"], "type": rel["type"]})
    conn.commit()

    for svc_name, ci_names in service_ci_map.items():
        svc_id = name_to_svc.get(svc_name)
        if svc_id:
            for cn in ci_names:
                cid = name_to_ci.get(cn)
                if cid:
                    conn.execute(text("INSERT INTO service_ci (service_id, ci_id, role) VALUES (:svc_id, :ci_id, :role)"), {"svc_id": svc_id, "ci_id": cid, "role": "dependency"})
    conn.commit()

    result = conn.execute(text("SELECT COUNT(*) FROM ci"))
    count = result.scalar()
    result2 = conn.execute(text("SELECT COUNT(*) FROM ci WHERE management_ip IS NOT NULL"))
    ip_count = result2.scalar()
    print(f"Seeded {count} CIs, {ip_count} with IPs")
    result3 = conn.execute(text("SELECT name, management_ip, loopback_ip FROM ci WHERE management_ip IS NOT NULL LIMIT 10"))
    for row in result3:
        print(f"  {row[0]}: mgmt={row[1]}, lo={row[2]}")
