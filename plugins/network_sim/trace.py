from __future__ import annotations
import ipaddress
import time
from plugins.network_sim.models import Device, Link, NetworkEvent
from plugins.network_sim.routing import lookup_route
from plugins.network_sim.l2 import resolve_arp


def simulate_ping(
    devices: dict[str, Device],
    links: list[Link],
    src_id: str,
    dst_ip: str,
    max_hops: int = 30,
) -> dict:
    src = devices.get(src_id)
    if not src:
        return {"success": False, "error": "Source device not found"}

    events: list[NetworkEvent] = []
    hops: list[dict] = []
    visited: set[str] = set()
    current_device = src
    ttl = max_hops
    start_time = time.time()

    while ttl > 0:
        if current_device.id in visited:
            events.append(NetworkEvent(
                timestamp=time.time() - start_time,
                event_type="LOOP_DETECTED",
                device=current_device.name,
                detail=f"Loop detected at {current_device.name}",
            ))
            return {
                "success": False,
                "error": "Loop detected",
                "hops": hops,
                "events": [e.__dict__ for e in events],
            }
        visited.add(current_device.id)

        if current_device.name == _resolve_name_by_ip(devices, dst_ip):
            mac = resolve_arp(devices, links, current_device, dst_ip)
            events.append(NetworkEvent(
                timestamp=time.time() - start_time,
                event_type="HOP",
                src=src.name,
                dst=_resolve_name_by_ip(devices, dst_ip),
                device=current_device.name,
                detail=f"TTL={ttl} - Reached destination",
                data={"ttl": ttl, "latency_ms": 0.5},
            ))
            hops.append({
                "device": current_device.name,
                "ip": dst_ip,
                "latency_ms": 0.5,
                "reached": True,
            })
            return {
                "success": True,
                "hops": hops,
                "events": [e.__dict__ for e in events],
                "rtt_ms": round(time.time() - start_time, 3),
            }

        route = lookup_route(current_device, dst_ip)
        if not route:
            events.append(NetworkEvent(
                timestamp=time.time() - start_time,
                event_type="DEST_UNREACHABLE",
                device=current_device.name,
                detail=f"No route to {dst_ip}",
            ))
            hops.append({
                "device": current_device.name,
                "ip": _get_device_ip(current_device),
                "latency_ms": 0,
                "reached": False,
                "error": "No route to destination",
            })
            return {
                "success": False,
                "error": "No route to destination",
                "hops": hops,
                "events": [e.__dict__ for e in events],
            }

        next_hop_ip = route.next_hop_ip
        if next_hop_ip == "0.0.0.0":
            next_hop_ip = dst_ip

        mac = resolve_arp(devices, links, current_device, next_hop_ip)
        if not mac:
            events.append(NetworkEvent(
                timestamp=time.time() - start_time,
                event_type="ARP_FAILED",
                device=current_device.name,
                detail=f"ARP failed for {next_hop_ip}",
            ))
            hops.append({
                "device": current_device.name,
                "ip": _get_device_ip(current_device),
                "latency_ms": 0,
                "reached": False,
                "error": f"ARP failed for {next_hop_ip}",
            })
            return {
                "success": False,
                "error": f"ARP failed for {next_hop_ip}",
                "hops": hops,
                "events": [e.__dict__ for e in events],
            }

        latency = _get_link_latency(current_device.id, next_hop_ip, devices, links)
        events.append(NetworkEvent(
            timestamp=time.time() - start_time,
            event_type="HOP",
            src=src.name,
            dst=_resolve_name_by_ip(devices, dst_ip),
            device=current_device.name,
            detail=f"TTL={ttl} - {current_device.name} -> {next_hop_ip} via {route.out_iface}",
            data={"ttl": ttl, "next_hop": next_hop_ip, "iface": route.out_iface, "latency_ms": latency},
        ))
        hops.append({
            "device": current_device.name,
            "ip": _get_device_ip(current_device),
            "latency_ms": latency,
            "reached": False,
        })

        ttl -= 1
        next_device = _find_device_by_ip(devices, next_hop_ip)
        if not next_device:
            events.append(NetworkEvent(
                timestamp=time.time() - start_time,
                event_type="DEST_UNREACHABLE",
                device=current_device.name,
                detail=f"Next hop {next_hop_ip} not found",
            ))
            return {
                "success": False,
                "error": f"Next hop {next_hop_ip} not found",
                "hops": hops,
                "events": [e.__dict__ for e in events],
            }
        current_device = next_device

    events.append(NetworkEvent(
        timestamp=time.time() - start_time,
        event_type="TTL_EXPIRED",
        device=current_device.name,
        detail="TTL expired",
    ))
    return {
        "success": False,
        "error": "TTL expired",
        "hops": hops,
        "events": [e.__dict__ for e in events],
    }


def simulate_traceroute(
    devices: dict[str, Device],
    links: list[Link],
    src_id: str,
    dst_ip: str,
    max_hops: int = 30,
) -> dict:
    return simulate_ping(devices, links, src_id, dst_ip, max_hops)


def _find_device_by_ip(devices: dict[str, Device], ip: str) -> Device | None:
    for dev in devices.values():
        if not dev.up:
            continue
        for iface in dev.interfaces:
            if iface.ip == ip and iface.up:
                return dev
    return None


def _resolve_name_by_ip(devices: dict[str, Device], ip: str) -> str:
    for dev in devices.values():
        for iface in dev.interfaces:
            if iface.ip == ip:
                return dev.name
    return ip


def _get_device_ip(device: Device) -> str:
    for iface in device.interfaces:
        if iface.up and iface.name != "Loopback0":
            return iface.ip
    return ""


def _get_link_latency(
    src_id: str,
    dst_ip: str,
    devices: dict[str, Device],
    links: list[Link],
) -> float:
    for link in links:
        if link.state != "up":
            continue
        if link.a_id == src_id or link.b_id == src_id:
            dst_dev = _find_device_by_ip(devices, dst_ip)
            if dst_dev and (link.a_id == dst_dev.id or link.b_id == dst_dev.id):
                return link.latency_ms
    return 1.0
