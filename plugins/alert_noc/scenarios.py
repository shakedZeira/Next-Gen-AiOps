import asyncio
import logging

from plugins.alert_noc.models import AlertCreate, AlertSeverity

logger = logging.getLogger(__name__)

SCENARIOS = {
    "payment-outage": {
        "name": "Payment Service Outage",
        "description": "Cascading failure in payment processing pipeline",
        "alerts": [
            {"delay": 0,  "name": "High Latency P99 - payments-api", "service": "Payment Gateway", "severity": "high", "team": "payments", "description": "P99 latency exceeded 2s threshold on payments-api"},
            {"delay": 5,  "name": "Error Rate Spike - payments-api", "service": "Payment Gateway", "severity": "critical", "team": "payments", "description": "Error rate jumped to 12% on payments-api"},
            {"delay": 10, "name": "Request Timeout - payments-api", "service": "Payment Gateway", "severity": "critical", "team": "payments", "description": "Multiple request timeouts detected on payments-api"},
            {"delay": 15, "name": "OOM Killed - payments-app", "service": "Payment Gateway", "severity": "critical", "team": "payments", "description": "Container OOM killed due to memory leak"},
            {"delay": 20, "name": "Health Check Failed - payments-app", "service": "Payment Gateway", "severity": "medium", "team": "payments", "description": "Liveness probe failing after OOM restart"},
            {"delay": 30, "name": "DB Connection Pool Exhausted - postgres-payments", "service": "Payment Gateway", "severity": "high", "team": "payments", "description": "All 50 DB connections in use, requests queuing"},
        ],
    },
    "network-failure": {
        "name": "Network Failure",
        "description": "Core network device failures causing cascading connectivity issues",
        "alerts": [
            {"delay": 0,  "name": "BGP Peer Down - core-router-1", "service": "Network Infrastructure", "severity": "critical", "team": "sre", "description": "BGP session to upstream provider lost"},
            {"delay": 5,  "name": "OSPF Adjacency Change - core-router-2", "service": "Network Infrastructure", "severity": "high", "team": "sre", "description": "OSPF neighbor adjacency state changed to Down"},
            {"delay": 10, "name": "Link Down - GigabitEthernet0/1 - core-switch-1", "service": "Network Infrastructure", "severity": "critical", "team": "sre", "description": "Physical link down on core switch uplink"},
            {"delay": 15, "name": "High Latency P99 - ecommerce-api", "service": "E-Commerce Platform", "severity": "high", "team": "backend", "description": "Increased latency due to network path changes"},
            {"delay": 20, "name": "Request Timeout - order-service", "service": "Order Processing", "severity": "critical", "team": "backend", "description": "Order service cannot reach inventory service"},
        ],
    },
    "disk-exhaustion": {
        "name": "Disk Space Exhaustion",
        "description": "Progressive disk fill leading to service failures",
        "alerts": [
            {"delay": 0,  "name": "Disk Space Low - payments-app-server", "service": "Payment Gateway", "severity": "medium", "team": "payments", "description": "Disk usage at 78%, approaching threshold"},
            {"delay": 30, "name": "Disk Space Critical - payments-app-server", "service": "Payment Gateway", "severity": "high", "team": "payments", "description": "Disk usage at 92%, logs filling rapidly"},
            {"delay": 60, "name": "Disk Space Critical - payments-db-server", "service": "Payment Gateway", "severity": "high", "team": "payments", "description": "Database disk usage at 88%"},
            {"delay": 90, "name": "Service Down - postgres-payments", "service": "Payment Gateway", "severity": "critical", "team": "payments", "description": "PostgreSQL拒绝写入，磁盘已满"},
            {"delay": 120, "name": "Error Rate Spike - payments-api", "service": "Payment Gateway", "severity": "critical", "team": "payments", "description": "All write operations failing due to DB disk full"},
        ],
    },
    "cascading-microservice": {
        "name": "Cascading Microservice Failure",
        "description": "Single service failure cascading through dependency chain",
        "alerts": [
            {"delay": 0,  "name": "High Latency P99 - inventory-api", "service": "Inventory Service", "severity": "high", "team": "backend", "description": "Inventory service responding slowly"},
            {"delay": 5,  "name": "Error Rate Spike - inventory-api", "service": "Inventory Service", "severity": "critical", "team": "backend", "description": "Inventory service error rate at 15%"},
            {"delay": 10, "name": "High Latency P99 - order-service", "service": "Order Processing", "severity": "high", "team": "backend", "description": "Order service waiting on inventory timeouts"},
            {"delay": 15, "name": "Request Timeout - order-service", "service": "Order Processing", "severity": "critical", "team": "backend", "description": "Order processing timing out on inventory calls"},
            {"delay": 20, "name": "Error Rate Spike - ecommerce-api", "service": "E-Commerce Platform", "severity": "critical", "team": "backend", "description": "E-commerce failing due to order service breakdown"},
            {"delay": 25, "name": "Error Rate Spike - payments-api", "service": "Payment Gateway", "severity": "critical", "team": "payments", "description": "Payment processing affected by order failures"},
        ],
    },
    "database-failover": {
        "name": "Database Failover",
        "description": "Primary database failure triggering failover and cascading issues",
        "alerts": [
            {"delay": 0,  "name": "Memory Critical - postgres-payments-server", "service": "Payment Gateway", "severity": "high", "team": "payments", "description": "Database server memory at 95%"},
            {"delay": 10, "name": "Service Down - postgres-payments", "service": "Payment Gateway", "severity": "critical", "team": "payments", "description": "PostgreSQL主库进程异常退出"},
            {"delay": 15, "name": "DB Connection Pool Exhausted - payments-api", "service": "Payment Gateway", "severity": "high", "team": "payments", "description": "Connection pool saturated, new connections refused"},
            {"delay": 20, "name": "High Latency P99 - payments-api", "service": "Payment Gateway", "severity": "critical", "team": "payments", "description": "Extreme latency as connections wait for failover"},
            {"delay": 25, "name": "Request Timeout - payments-api", "service": "Payment Gateway", "severity": "critical", "team": "payments", "description": "Requests timing out during database failover"},
        ],
    },
}


class ScenarioRunner:
    def __init__(self, alert_store):
        self.store = alert_store

    async def run(self, scenario_name: str):
        scenario = SCENARIOS.get(scenario_name)
        if not scenario:
            logger.warning("Unknown scenario: %s", scenario_name)
            return

        logger.info("Starting scenario: %s (%d alerts)", scenario["name"], len(scenario["alerts"]))
        prev_delay = 0
        for alert_def in scenario["alerts"]:
            delay = alert_def["delay"] - prev_delay
            if delay > 0:
                await asyncio.sleep(delay)
            prev_delay = alert_def["delay"]

            data = AlertCreate(
                name=alert_def["name"],
                service=alert_def["service"],
                severity=AlertSeverity(alert_def["severity"]),
                description=alert_def["description"],
                team=alert_def.get("team", "unassigned"),
                labels={"scenario": scenario_name, "source": "scenario-simulator"},
            )
            try:
                await self.store.create_alert(data)
                logger.info("Scenario [%s] created alert: %s", scenario_name, alert_def["name"])
            except Exception as e:
                logger.warning("Failed to create alert in scenario %s: %s", scenario_name, e)

        logger.info("Scenario completed: %s", scenario["name"])
