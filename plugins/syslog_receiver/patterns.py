import re
from dataclasses import dataclass


@dataclass
class AlertPattern:
    regex: re.Pattern
    alert_name: str
    default_severity: str


PATTERNS: list[AlertPattern] = [
    AlertPattern(
        re.compile(r"%LINK-(?:UP|DOWN)", re.IGNORECASE),
        "Interface State Change",
        "medium",
    ),
    AlertPattern(
        re.compile(r"%LINEPROTO-(?:UP|DOWN)", re.IGNORECASE),
        "Line Protocol State Change",
        "medium",
    ),
    AlertPattern(
        re.compile(r"%STP|spanning.tree", re.IGNORECASE),
        "Spanning Tree Change",
        "medium",
    ),
    AlertPattern(
        re.compile(r"%OSPF|ospf.*nbr.*change", re.IGNORECASE),
        "OSPF Neighbor Change",
        "medium",
    ),
    AlertPattern(
        re.compile(r"%CPU|cpu.*utilization.*(?:exceed|high|threshold)", re.IGNORECASE),
        "High CPU Usage",
        "high",
    ),
    AlertPattern(
        re.compile(r"%MEMORY|memory.*(?:exceed|high|threshold|low)", re.IGNORECASE),
        "High Memory Usage",
        "high",
    ),
    AlertPattern(
        re.compile(r"%(?:Disk|FILESYS|disk.*(?:full|low|space|threshold))", re.IGNORECASE),
        "Disk Space Alert",
        "high",
    ),
    AlertPattern(
        re.compile(r"%(?:auth|login|AAA|SECURITY|login.*fail|auth.*fail)", re.IGNORECASE),
        "Authentication Failure",
        "critical",
    ),
    AlertPattern(
        re.compile(r"%TEMP|temperature.*(?:exceed|high|threshold)", re.IGNORECASE),
        "Temperature Alert",
        "high",
    ),
    AlertPattern(
        re.compile(r"%POWER|power.*(?:fail|supply|loss)", re.IGNORECASE),
        "Power Supply Alert",
        "critical",
    ),
    AlertPattern(
        re.compile(r"%BGP|bgp.*(?:down|establish|flap)", re.IGNORECASE),
        "BGP State Change",
        "high",
    ),
    AlertPattern(
        re.compile(r"%HSRP|hsrp.*(?:state|failover)", re.IGNORECASE),
        "HSRP State Change",
        "medium",
    ),
    AlertPattern(
        re.compile(r"%VLAN|vlan.*(?:add|delete|down)", re.IGNORECASE),
        "VLAN Change",
        "low",
    ),
    AlertPattern(
        re.compile(r"%UNICAST|unicast.*storm", re.IGNORECASE),
        "Unicast Storm",
        "high",
    ),
    AlertPattern(
        re.compile(r"%SNMP|snmp.*trap", re.IGNORECASE),
        "SNMP Trap",
        "low",
    ),
    AlertPattern(
        re.compile(r"error|fail|crit|emerg|panic", re.IGNORECASE),
        "System Error",
        "high",
    ),
]


def match_alert(message: str) -> tuple[str, str] | None:
    for pattern in PATTERNS:
        if pattern.regex.search(message):
            return pattern.alert_name, pattern.default_severity
    return None


SEVERITY_MAP = {
    0: "critical",
    1: "critical",
    2: "critical",
    3: "high",
    4: "high",
    5: "medium",
    6: "medium",
    7: "low",
}


def priority_to_severity(priority: int) -> str:
    level = priority % 8
    return SEVERITY_MAP.get(level, "medium")


FACILITY_MAP = {
    0: "kernel",
    1: "user",
    2: "mail",
    3: "daemon",
    4: "auth",
    5: "syslog",
    6: "lpr",
    7: "news",
    8: "uucp",
    9: "cron",
    10: "authpriv",
    11: "ftp",
    12: "ntp",
    13: "security",
    14: "console",
    15: "solaris-cron",
    16: "local0",
    17: "local1",
    18: "local2",
    19: "local3",
    20: "local4",
    21: "local5",
    22: "local6",
    23: "local7",
}


def priority_to_facility(priority: int) -> str:
    facility = priority >> 3
    return FACILITY_MAP.get(facility, f"facility-{facility}")
