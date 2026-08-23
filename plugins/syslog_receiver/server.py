import asyncio
import logging
import re
import time
from datetime import datetime

logger = logging.getLogger("syslog_receiver")

RFC3164_PATTERN = re.compile(
    r"<(\d{1,3})>([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*?)(?:\:\s*(.*))?$"
)

RFC5424_PATTERN = re.compile(
    r"<(\d{1,3})>\d+\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(?:-\s*)?(.*)$"
)


class SyslogMessage:
    def __init__(
        self,
        priority: int,
        timestamp: datetime,
        hostname: str,
        app_name: str,
        message: str,
        facility: str = "",
        severity: str = "",
    ):
        self.priority = priority
        self.timestamp = timestamp
        self.hostname = hostname
        self.app_name = app_name
        self.message = message
        self.facility = facility
        self.severity = severity


def parse_rfc3164(raw: str) -> SyslogMessage | None:
    match = RFC3164_PATTERN.match(raw.strip())
    if not match:
        return None

    priority = int(match.group(1))
    ts_str = match.group(2)
    hostname = match.group(3)
    app_msg = match.group(4)
    msg = match.group(5) or app_msg

    try:
        now = datetime.utcnow()
        parsed = datetime.strptime(ts_str, "%b %d %H:%M:%S")
        parsed = parsed.replace(year=now.year)
    except ValueError:
        parsed = datetime.utcnow()

    facility_num = priority >> 3
    level_num = priority % 8

    from plugins.syslog_receiver.patterns import FACILITY_MAP, SEVERITY_MAP

    return SyslogMessage(
        priority=priority,
        timestamp=parsed,
        hostname=hostname,
        app_name=app_msg.split(":")[0] if ":" in app_msg else app_msg,
        message=msg,
        facility=FACILITY_MAP.get(facility_num, f"facility-{facility_num}"),
        severity=SEVERITY_MAP.get(level_num, "medium"),
    )


def parse_rfc5424(raw: str) -> SyslogMessage | None:
    match = RFC5424_PATTERN.match(raw.strip())
    if not match:
        return None

    priority = int(match.group(1))
    hostname = match.group(3)
    app_name = match.group(4)
    msg = match.group(7) or ""

    try:
        ts_str = match.group(2)
        if ts_str.endswith("Z"):
            ts_str = ts_str[:-1] + "+00:00"
        parsed = datetime.fromisoformat(ts_str)
        if parsed.tzinfo:
            parsed = parsed.replace(tzinfo=None)
    except (ValueError, IndexError):
        parsed = datetime.utcnow()

    facility_num = priority >> 3
    level_num = priority % 8

    from plugins.syslog_receiver.patterns import FACILITY_MAP, SEVERITY_MAP

    return SyslogMessage(
        priority=priority,
        timestamp=parsed,
        hostname=hostname,
        app_name=app_name,
        message=msg,
        facility=FACILITY_MAP.get(facility_num, f"facility-{facility_num}"),
        severity=SEVERITY_MAP.get(level_num, "medium"),
    )


def parse_syslog(raw: str) -> SyslogMessage | None:
    msg = parse_rfc3164(raw)
    if msg:
        return msg
    msg = parse_rfc5424(raw)
    if msg:
        return msg

    return SyslogMessage(
        priority=13,
        timestamp=datetime.utcnow(),
        hostname="unknown",
        app_name="unknown",
        message=raw.strip(),
        facility="local0",
        severity="medium",
    )


class SyslogUDPServer:
    def __init__(self, handler):
        self.handler = handler
        self.transport = None

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        message = data.decode("utf-8", errors="replace")
        asyncio.ensure_future(self.handler(message, addr, "udp"))


class SyslogTCPServer:
    def __init__(self, handler):
        self.handler = handler
        self.buffer = b""

    def connection_made(self, transport):
        self.transport = transport
        self.buffer = b""

    def data_received(self, data):
        self.buffer += data
        while b"\n" in self.buffer:
            line, self.buffer = self.buffer.split(b"\n", 1)
            message = line.decode("utf-8", errors="replace").strip()
            if message:
                asyncio.ensure_future(
                    self.handler(message, None, "tcp")
                )

    def eof_received(self):
        if self.buffer:
            message = self.buffer.decode("utf-8", errors="replace").strip()
            if message:
                asyncio.ensure_future(
                    self.handler(message, None, "tcp")
                )
        return False
