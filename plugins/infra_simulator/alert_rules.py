import logging
import random

import httpx

from plugins.infra_simulator.topology import SERVICE_MAP, SimulatedDevice

logger = logging.getLogger(__name__)

SWITCH_ALERTS = [
    {"trigger": "link_down", "severity": "critical", "name_tpl": "Link Down - GigabitEthernet0/{port} - {device}"},
    {"trigger": "high_cpu", "severity": "medium", "name_tpl": "High CPU - {device}"},
    {"trigger": "mac_table_full", "severity": "high", "name_tpl": "MAC Table Full - {device}"},
]

ROUTER_ALERTS = [
    {"trigger": "ospf_flap", "severity": "high", "name_tpl": "OSPF Adjacency Change - {device}"},
    {"trigger": "bgp_down", "severity": "critical", "name_tpl": "BGP Peer Down - {device}"},
    {"trigger": "high_cpu", "severity": "medium", "name_tpl": "High CPU - {device}"},
]

LINUX_ALERTS = [
    {"trigger": "disk_low", "severity": "high", "name_tpl": "Disk Space Critical - {device}"},
    {"trigger": "memory_high", "severity": "high", "name_tpl": "Memory Critical - {device}"},
    {"trigger": "service_crash", "severity": "critical", "name_tpl": "Service Down - {svc} - {device}"},
    {"trigger": "smart_warning", "severity": "critical", "name_tpl": "Disk SMART Warning - {device}"},
]

WINDOWS_ALERTS = [
    {"trigger": "disk_low", "severity": "high", "name_tpl": "Disk Space Critical - {device}"},
    {"trigger": "memory_high", "severity": "high", "name_tpl": "Memory Critical - {device}"},
    {"trigger": "service_crash", "severity": "critical", "name_tpl": "Service Down - {svc} - {device}"},
]

CONTAINER_ALERTS = [
    {"trigger": "oom_killed", "severity": "critical", "name_tpl": "OOM Killed - {device}"},
    {"trigger": "restart_loop", "severity": "high", "name_tpl": "Restart Loop - {device}"},
    {"trigger": "health_check_failed", "severity": "medium", "name_tpl": "Health Check Failed - {device}"},
    {"trigger": "image_pull_failed", "severity": "high", "name_tpl": "Image Pull Failed - {device}"},
]

POD_ALERTS = [
    {"trigger": "crashloop", "severity": "critical", "name_tpl": "CrashLoopBackOff - {device}"},
    {"trigger": "unschedulable", "severity": "high", "name_tpl": "Pod Unschedulable - {device}"},
    {"trigger": "liveness_failed", "severity": "high", "name_tpl": "Liveness Probe Failed - {device}"},
    {"trigger": "evicted", "severity": "medium", "name_tpl": "Pod Evicted - {device}"},
]

ALERT_TEMPLATES = {
    "switch": SWITCH_ALERTS,
    "router": ROUTER_ALERTS,
    "physical_server": LINUX_ALERTS,
    "container": CONTAINER_ALERTS,
    "pod": POD_ALERTS,
}

SVC_NAMES = ["nginx", "postgresql", "redis", "kafka", "node", "python", "docker"]


def build_alert_payload(device: SimulatedDevice, alert_rule: dict) -> dict:
    port = random.randint(1, 48)
    svc = random.choice(SVC_NAMES)
    name = alert_rule["name_tpl"].replace("{device}", device.name).replace("{port}", str(port)).replace("{svc}", svc)
    service = SERVICE_MAP.get(device.name, "Unknown Service")
    description = f"Simulated {alert_rule['trigger']} on {device.name} ({device.device_type})"
    return {
        "name": name,
        "service": service,
        "severity": alert_rule["severity"],
        "description": description,
        "team": device.team,
        "labels": {
            "device.name": device.name,
            "device.type": device.device_type,
            "alert.trigger": alert_rule["trigger"],
            "source": "infra-simulator",
        },
    }


async def trigger_alert(device: SimulatedDevice, alert_noc_url: str) -> None:
    templates = ALERT_TEMPLATES.get(device.device_type)
    if not templates:
        return
    alert_rule = random.choice(templates)
    payload = build_alert_payload(device, alert_rule)
    try:
        async with httpx.AsyncClient() as client:
            await client.post(f"{alert_noc_url}/api/v1/alerts", json=payload, timeout=5)
    except Exception as e:
        logger.warning("Failed to create alert for %s: %s", device.name, e)
