import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime

from plugins.snmp_receiver.oid_mapper import (
    SNMP_TRAP_OID,
    SYS_UPTIME_OID,
    resolve_trap_identity,
)

logger = logging.getLogger("snmp_receiver")

GENERIC_TRAP_NAMES = {
    0: "coldStart",
    1: "warmStart",
    2: "linkDown",
    3: "linkUp",
    4: "authenticationFailure",
    5: "egpNeighborLoss",
    6: "enterpriseSpecific",
}

GENERIC_TRAP_TO_OID = {
    0: "1.3.6.1.6.3.1.1.5.1",
    1: "1.3.6.1.6.3.1.1.5.2",
    2: "1.3.6.1.6.3.1.1.5.3",
    3: "1.3.6.1.6.3.1.1.5.4",
    4: "1.3.6.1.6.3.1.1.5.5",
    5: "1.3.6.1.6.3.1.1.5.6",
}


@dataclass
class ParsedTrap:
    trap_oid: str
    source_ip: str
    source_port: int = 0
    snmp_version: str = "unknown"
    uptime_ticks: int | None = None
    varbinds: list[dict] = field(default_factory=list)
    received_at: str = field(
        default_factory=lambda: datetime.now(UTC).isoformat()
    )

    @property
    def uptime_seconds(self) -> float | None:
        if self.uptime_ticks is None:
            return None
        return round(self.uptime_ticks / 100, 2)


def normalize_varbinds(raw_varbinds) -> list[dict]:
    varbinds = []
    for item in raw_varbinds or []:
        try:
            oid, value = item[0], item[1]
            varbinds.append({"oid": oid.prettyPrint(), "value": value.prettyPrint()})
        except Exception:
            logger.debug("Skipping unparseable varbind: %r", item)
    return varbinds


def parse_trap(raw_varbinds, source_ip: str, source_port: int, snmp_version: str) -> ParsedTrap:
    varbinds = normalize_varbinds(raw_varbinds)

    uptime_ticks = None
    for vb in varbinds:
        if vb["oid"] == SYS_UPTIME_OID and vb["value"].isdigit():
            uptime_ticks = int(vb["value"])
            break

    trap_oid = None
    for vb in varbinds:
        if vb["oid"] == SNMP_TRAP_OID:
            trap_oid = vb["value"]
            break

    if not trap_oid:
        trap_oid = next((vb["oid"] for vb in varbinds if vb["oid"] != SYS_UPTIME_OID), "")

    return ParsedTrap(
        trap_oid=trap_oid,
        source_ip=source_ip,
        source_port=source_port,
        snmp_version=snmp_version,
        uptime_ticks=uptime_ticks,
        varbinds=varbinds,
    )


def build_manual_trap(payload: dict) -> ParsedTrap:
    trap_oid = resolve_trap_identity(payload.get("trap_oid"), payload.get("trap_name"))
    varbinds = [
        {"oid": SNMP_TRAP_OID, "value": trap_oid},
        *[
            {"oid": vb["oid"], "value": str(vb.get("value", ""))}
            for vb in payload.get("varbinds", [])
        ],
    ]
    uptime_ticks = payload.get("uptime_ticks")
    if isinstance(uptime_ticks, (int, float)):
        varbinds.append({"oid": SYS_UPTIME_OID, "value": str(int(uptime_ticks))})

    return ParsedTrap(
        trap_oid=trap_oid,
        source_ip=payload.get("source_ip", "127.0.0.1"),
        snmp_version=payload.get("snmp_version", "v2c"),
        uptime_ticks=int(uptime_ticks) if isinstance(uptime_ticks, (int, float)) else None,
        varbinds=varbinds,
    )
