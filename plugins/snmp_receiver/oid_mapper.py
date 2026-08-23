SYS_UPTIME_OID = "1.3.6.1.2.1.1.3.0"
SNMP_TRAP_OID = "1.3.6.1.6.3.1.1.4.1.0"

LINK_DOWN_OID = "1.3.6.1.6.3.1.1.5.3"
LINK_UP_OID = "1.3.6.1.6.3.1.1.5.4"
AUTH_FAILURE_OID = "1.3.6.1.6.3.1.1.5.5"
CISCO_CPU_HIGH_OID = "1.3.6.1.4.1.9.9.109.2.0.1"
CISCO_MEMORY_THRESHOLD_OID = "1.3.6.1.4.1.9.9.221.2.0.1"
CISCO_ENV_TEMP_STATE_OID = "1.3.6.1.4.1.9.9.13.3.0.3"
OSPF_NBR_STATE_CHANGE_OID = "1.3.6.1.2.1.14.16.2.2"
ROOT_BRIDGE_CHANGE_OID = "1.3.6.1.2.1.17.0.1"

IF_INDEX_PREFIX = "1.3.6.1.2.1.2.2.1.1."

TRAP_METADATA = {
    LINK_DOWN_OID: {
        "name": "linkDown",
        "severity": "critical",
        "description": "Interface operational state changed to down",
    },
    LINK_UP_OID: {
        "name": "linkUp",
        "severity": "info",
        "description": "Interface operational state changed to up",
    },
    CISCO_CPU_HIGH_OID: {
        "name": "cpmCPUHighThreshold",
        "severity": "high",
        "description": "CPU utilization exceeded the high threshold",
    },
    CISCO_MEMORY_THRESHOLD_OID: {
        "name": "cpmMemoryThreshold",
        "severity": "high",
        "description": "Memory pool usage exceeded the threshold",
    },
    CISCO_ENV_TEMP_STATE_OID: {
        "name": "ciscoEnvMonTemperatureState",
        "severity": "critical",
        "description": "Environmental temperature alarm state reported",
    },
    OSPF_NBR_STATE_CHANGE_OID: {
        "name": "ospfNbrStateChange",
        "severity": "medium",
        "description": "OSPF neighbor state changed",
    },
    ROOT_BRIDGE_CHANGE_OID: {
        "name": "rootBridgeChange",
        "severity": "medium",
        "description": "Spanning tree elected a new root bridge",
    },
    AUTH_FAILURE_OID: {
        "name": "authFailure",
        "severity": "high",
        "description": "SNMP authentication failure detected",
    },
}

UNKNOWN_TRAP_META = {
    "name": "snmpTrap",
    "severity": "low",
    "description": "Unmapped SNMP trap received",
}

NAME_TO_OID = {meta["name"].lower(): oid for oid, meta in TRAP_METADATA.items()}


def lookup_trap(oid: str | None) -> dict:
    meta = TRAP_METADATA.get(oid or "", UNKNOWN_TRAP_META)
    return {"oid": oid, **meta}


def resolve_trap_identity(trap_oid: str | None, trap_name: str | None) -> str:
    if trap_oid:
        return trap_oid
    if trap_name:
        oid = NAME_TO_OID.get(trap_name.lower())
        if not oid:
            raise ValueError(f"Unknown trap name: {trap_name}")
        return oid
    raise ValueError("Either trap_oid or trap_name must be provided")


def describe_interface(meta_name: str, varbinds: list[dict]) -> str:
    if meta_name not in ("linkDown", "linkUp"):
        return ""
    for vb in varbinds:
        if vb["oid"].startswith(IF_INDEX_PREFIX):
            suffix = vb["oid"][len(IF_INDEX_PREFIX):]
            return f"Interface ifIndex {suffix}"
    return ""


def format_uptime(ticks: int) -> str:
    total_seconds = ticks / 100
    days = int(total_seconds // 86400)
    hours = int((total_seconds % 86400) // 3600)
    minutes = int((total_seconds % 3600) // 60)
    return f"{days}d {hours}h {minutes}m"
