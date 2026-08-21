from __future__ import annotations
import ipaddress
import hashlib
from plugins.network_sim.models import Device, Interface


SITE_PREFIX_MAP = {
    "global-hq": 0,
    "regional-dc-1": 1,
    "metro-ring-1": 2,
    "branch-nyc": 3,
    "branch-london": 4,
}

TYPE_OCTET_MAP = {
    "router": (0, 1),
    "switch": (1, 1),
    "firewall": (2, 1),
    "load_balancer": (3, 1),
    "physical_server": (10, 1),
    "host": (10, 1),
    "database": (20, 1),
    "cache": (30, 1),
    "message_queue": (40, 1),
    "storage": (50, 1),
}

LOOPBACK_TYPES = {"router", "database"}


def generate_mac(name: str, iface_idx: int = 0) -> str:
    h = hashlib.md5(f"{name}:{iface_idx}".encode()).hexdigest()[:12]
    return ":".join(h[i : i + 2] for i in range(0, 12, 2))


def build_interfaces(ci: dict) -> list[Interface]:
    site = ci.get("site", "global-hq")
    ci_type = ci.get("type", "host")
    name = ci.get("name", "unknown")
    mgmt_ip = ci.get("management_ip")
    loopback_ip = ci.get("loopback_ip")

    if not mgmt_ip:
        return []

    site_prefix = SITE_PREFIX_MAP.get(site, 0)
    type_octet, _ = TYPE_OCTET_MAP.get(ci_type, (10, 1))

    interfaces = []

    mgmt_subnet = f"10.{site_prefix}.{type_octet}.0/24"
    interfaces.append(Interface(
        name="Management0",
        mac=generate_mac(name, 0),
        ip=mgmt_ip,
        prefix_len=24,
        subnet=mgmt_subnet,
    ))

    if loopback_ip and ci_type in LOOPBACK_TYPES:
        interfaces.append(Interface(
            name="Loopback0",
            mac=generate_mac(name, 1),
            ip=loopback_ip,
            prefix_len=32,
            subnet=f"10.{site_prefix}.0.0/24",
        ))

    return interfaces


def build_device_from_ci(ci: dict) -> Device:
    interfaces = build_interfaces(ci)
    return Device(
        id=ci["id"],
        name=ci.get("name", "unknown"),
        device_type=ci.get("type", "host"),
        site=ci.get("site", ""),
        interfaces=interfaces,
    )


def assign_interface_ips(
    devices: dict[str, Device],
    links: list,
    cis: list[dict],
) -> None:
    """Assign point-to-point IPs for links that don't have devices on the same subnet."""
    ci_map = {ci["id"]: ci for ci in cis}

    for link in links:
        a_dev = devices.get(link.a_id)
        b_dev = devices.get(link.b_id)
        if not a_dev or not b_dev:
            continue

        a_has_same_subnet = False
        for a_iface in a_dev.interfaces:
            for b_iface in b_dev.interfaces:
                if a_iface.network() == b_iface.network():
                    a_has_same_subnet = True
                    break
            if a_has_same_subnet:
                break

        if not a_has_same_subnet and a_dev.interfaces and b_dev.interfaces:
            a_ci = ci_map.get(link.a_id, {})
            b_ci = ci_map.get(link.b_id, {})
            a_site = SITE_PREFIX_MAP.get(a_ci.get("site", "global-hq"), 0)

            pt_net = ipaddress.IPv4Network(f"10.{a_site}.100.0/31", strict=False)
            pt_prefix = 31

            a_ip = str(list(pt_net.hosts())[0])
            b_ip = str(list(pt_net.hosts())[1])

            a_port = link.a_port
            b_port = link.b_port

            a_iface_exists = any(i.name == a_port for i in a_dev.interfaces)
            if not a_iface_exists:
                a_dev.interfaces.append(Interface(
                    name=a_port,
                    mac=generate_mac(a_dev.name, len(a_dev.interfaces)),
                    ip=a_ip,
                    prefix_len=pt_prefix,
                    subnet=str(pt_net),
                ))

            b_iface_exists = any(i.name == b_port for i in b_dev.interfaces)
            if not b_iface_exists:
                b_dev.interfaces.append(Interface(
                    name=b_port,
                    mac=generate_mac(b_dev.name, len(b_dev.interfaces)),
                    ip=b_ip,
                    prefix_len=pt_prefix,
                    subnet=str(pt_net),
                ))
