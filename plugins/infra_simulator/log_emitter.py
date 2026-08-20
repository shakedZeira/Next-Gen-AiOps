import random
import time

from opentelemetry import _logs
from opentelemetry._logs import SeverityNumber
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource

from plugins.infra_simulator.topology import SimulatedDevice

SEVERITY_MAP = {
    "INFO": SeverityNumber.INFO,
    "WARNING": SeverityNumber.WARN,
    "ERROR": SeverityNumber.ERROR,
    "CRITICAL": SeverityNumber.FATAL,
}

SWITCH_LOGS = [
    ("INFO", "%SYS-5-PORTCONFIG: Interface GigabitEthernet0/{port} changed state to up"),
    ("INFO", "%SYS-5-PORTCONFIG: Interface GigabitEthernet0/{port} changed state to down"),
    ("INFO", "%STP-5-ROOTCHANGE: Root bridge changed for VLAN {vlan}"),
    ("WARNING", "%SYS-3-CPUHLTH: High CPU utilization detected ({cpu}%)"),
    ("WARNING", "%MAC_TABLE-4-FULL: MAC address table full on VLAN {vlan}"),
    ("ERROR", "%SYS-2-INTSCHED: Process exceeded stack limit"),
]

ROUTER_LOGS = [
    ("INFO", "%OSPF-5-ADJCHG: Process 1, Nbr {neighbor} on {iface} from Full to Down"),
    ("INFO", "%BGP-5-ADJCHANGE: neighbor {neighbor} Up"),
    ("INFO", "%LINEPROTO-5-UPDOWN: Line protocol on Interface {iface}, changed state to up"),
    ("WARNING", "%SYS-4-CPURISING: CPU utilization has increased to {cpu}%"),
    ("WARNING", "%OSPF-5-ADJCHG: Process 1, Nbr {neighbor} on {iface} from Loading to Full"),
    ("ERROR", "%BGP-5-ADJCHANGE: neighbor {neighbor} Down"),
]

LINUX_SERVER_LOGS = [
    ("INFO", "systemd[1]: Started {service}.service - {service_desc}."),
    ("INFO", "sshd[{pid}]: Accepted publickey for user from {ip} port {port}"),
    ("INFO", "kernel: [UFW BLOCK] IN=eth0 OUT= SRC={src} DST={dst} PROTO=TCP DPT={dpt}"),
    ("WARNING", "kernel: EXT4-fs warning: mounting unchecked fs, running e2fsck is recommended"),
    ("WARNING", "smartd[{pid}]: Device: /dev/sda, SMART Usage Attribute: 5 Reallocated_Sector_Ct changed from {old} to {new}"),
    ("ERROR", "kernel: Out of memory: Killed process {oom_pid} ({oom_name})"),
]

WINDOWS_SERVER_LOGS = [
    ("INFO", "Service Control Manager: The {service} service entered the running state."),
    ("INFO", "Security-Auditing: Logon successful. Account: {account}, Logon Type: 10"),
    ("WARNING", "Disk: The disk is {pct}% full on volume C:."),
    ("WARNING", "Memory: Available bytes on the system are low. Available: {avail} MB"),
    ("ERROR", "Service Control Manager: The {service} service terminated unexpectedly."),
]

CONTAINER_LOGS = [
    ("INFO", "dockerd[{pid}]: Container started (name={name}, image={image}, id={cid})"),
    ("INFO", "containerd[{pid}]: Task exited (container={cid}, status=0)"),
    ("WARNING", "dockerd[{pid}]: Health check failed: command [{cmd}] timed out"),
    ("WARNING", "dockerd[{pid}]: Container {name} restart count: {count}"),
    ("ERROR", "kernel: Memory cgroup out of memory: Killed process {oom_pid} (containerd-shim)"),
    ("ERROR", "dockerd[{pid}]: Failed to pull image {image}: manifest unknown"),
]

POD_LOGS = [
    ("INFO", "kubelet[{pid}]: Pulling image \"{image}\""),
    ("INFO", "kubelet[{pid}]: Started container {container} (pod={pod}, namespace={ns})"),
    ("INFO", "kubelet[{pid}]: Container {container} terminated (pod={pod}, exit=0)"),
    ("WARNING", "kubelet[{pid}]: Liveness probe failed for {container}: timeout after 30s"),
    ("WARNING", "kubelet[{pid}]: Readiness probe failed for {container}: connection refused"),
    ("ERROR", "kubelet[{pid}]: Container {container} failed with status CrashLoopBackOff (pod={pod})"),
    ("ERROR", "scheduler: Failed to schedule pod {pod}: Insufficient {resource}"),
    ("ERROR", "kubelet[{pid}]: Evicting pod {pod} due to resource pressure ({resource})"),
]


def init_log_emitter(service_name: str, endpoint: str) -> LoggerProvider:
    resource = Resource.create({SERVICE_NAME: service_name})
    url = endpoint.rstrip("/") + "/v1/logs"
    exporter = OTLPLogExporter(endpoint=url)
    provider = LoggerProvider(resource=resource)
    provider.add_log_record_processor(BatchLogRecordProcessor(exporter))
    _logs.set_logger_provider(provider)
    return provider


def _format_log(template: str, device: SimulatedDevice) -> str:
    port = random.randint(1, 48)
    vlan = random.randint(1, 4094)
    cpu = random.randint(70, 98)
    neighbor = f"10.0.0.{random.randint(1, 254)}"
    iface = f"GigabitEthernet0/{port}"
    pid = random.randint(1000, 65535)
    ip = f"192.168.{random.randint(0, 255)}.{random.randint(1, 254)}"
    placeholders = {
        "{port}": str(port),
        "{vlan}": str(vlan),
        "{cpu}": str(cpu),
        "{neighbor}": neighbor,
        "{iface}": iface,
        "{pid}": str(pid),
        "{ip}": ip,
        "{src}": f"10.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}",
        "{dst}": f"10.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}",
        "{dpt}": str(random.choice([22, 80, 443, 3306, 5432, 6379, 8080, 9092])),
        "{service}": random.choice(["nginx", "postgresql", "redis", "kafka", "docker"]),
        "{service_desc}": random.choice(["Web Server", "Database", "Cache", "Message Queue"]),
        "{count}": str(random.randint(3, 10)),
        "{cid}": f"{random.randint(0, 0xFFFFFFFF):08x}",
        "{image}": device.properties.get("image", random.choice(["nginx:1.25", "python:3.11", "node:20", "redis:7"])),
        "{name}": device.name,
        "{cmd}": "curl -f http://localhost/health",
        "{oom_pid}": str(random.randint(1000, 65535)),
        "{oom_name}": random.choice(["java", "python", "node"]),
        "{pct}": str(random.randint(85, 99)),
        "{avail}": str(random.randint(50, 200)),
        "{account}": "admin",
        "{old}": str(random.randint(0, 10)),
        "{new}": str(random.randint(11, 50)),
        "{pod}": device.name,
        "{ns}": device.properties.get("namespace", "production"),
        "{container}": device.properties.get("deployment", device.name),
        "{resource}": random.choice(["cpu", "memory", "disk"]),
    }
    result = template
    for k, v in placeholders.items():
        result = result.replace(k, v)
    return result


def emit_device_logs(logger, device: SimulatedDevice) -> None:
    if device.device_type == "switch":
        templates = SWITCH_LOGS
    elif device.device_type == "router":
        templates = ROUTER_LOGS
    elif device.device_type == "physical_server" and device.os == "windows":
        templates = WINDOWS_SERVER_LOGS
    elif device.device_type == "physical_server":
        templates = LINUX_SERVER_LOGS
    elif device.device_type == "container":
        templates = CONTAINER_LOGS
    elif device.device_type == "pod":
        templates = POD_LOGS
    else:
        templates = LINUX_SERVER_LOGS

    severity_str, template = random.choice(templates)
    body = _format_log(template, device)
    severity = SEVERITY_MAP[severity_str]

    logger.emit(
        _logs.LogRecord(
            timestamp=int(time.time() * 1e9),
            trace_id=0,
            span_id=0,
            trace_flags=0,
            severity_text=severity_str,
            severity_number=severity,
            body=body,
            attributes={
                "device.name": device.name,
                "device.type": device.device_type,
                "device.team": device.team,
            },
        )
    )
