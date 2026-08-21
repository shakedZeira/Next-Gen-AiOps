from __future__ import annotations
import ipaddress
import time
from plugins.network_sim.models import Device, Link, Interface


def resolve_arp(
    devices: dict[str, Device],
    links: list[Link],
    src_device: Device,
    dst_ip: str,
) -> str | None:
    """Resolve destination IP to MAC via ARP cache or simulated broadcast."""
    src_iface = _find_source_interface(src_device, dst_ip, devices, links)
    if not src_iface:
        return None

    cached = src_device.arp_cache.get(dst_ip)
    if cached and (time.time() - cached.get("age", 0)) < 300:
        return cached["mac"]

    dst_device = _find_device_by_ip(devices, dst_ip)
    if not dst_device:
        return None

    dst_iface = dst_device.get_interface_by_ip(dst_ip)
    if not dst_iface:
        return None

    same_subnet = src_iface.network() == dst_iface.network()
    if not same_subnet:
        gw_ip = _find_default_gateway_ip(src_device, dst_ip, links, devices)
        if gw_ip:
            gw_mac = resolve_arp(devices, links, src_device, gw_ip)
            src_device.arp_cache[dst_ip] = {"mac": gw_mac, "age": time.time(), "state": "complete"}
            return gw_mac
        return None

    src_device.arp_cache[dst_ip] = {"mac": dst_iface.mac, "age": time.time(), "state": "complete"}
    _learn_mac_on_switches(devices, links, src_device.id, dst_iface.mac)
    return dst_iface.mac


def _find_source_interface(
    src_device: Device,
    dst_ip: str,
    devices: dict[str, Device],
    links: list[Link],
) -> Interface | None:
    dst = ipaddress.IPv4Address(dst_ip)
    for iface in src_device.interfaces:
        if not iface.up:
            continue
        try:
            net = ipaddress.IPv4Interface(f"{iface.ip}/{iface.prefix_len}").network
            if dst in net:
                return iface
        except ValueError:
            continue

    for iface in src_device.interfaces:
        if iface.up:
            return iface
    return None


def _find_device_by_ip(devices: dict[str, Device], ip: str) -> Device | None:
    for dev in devices.values():
        if not dev.up:
            continue
        for iface in dev.interfaces:
            if iface.ip == ip and iface.up:
                return dev
    return None


def _find_default_gateway_ip(
    device: Device,
    dst_ip: str,
    links: list[Link],
    devices: dict[str, Device],
) -> str | None:
    connected_nets = set()
    for iface in device.interfaces:
        if iface.up:
            connected_nets.add(iface.network())

    best_gw = None
    best_metric = float("inf")

    for route in device.routes:
        if route.proto == "connected" or route.state != "active":
            continue
        if route.next_hop_ip == "0.0.0.0":
            continue
        try:
            dst = ipaddress.IPv4Address(dst_ip)
            net = ipaddress.IPv4Network(route.prefix, strict=False)
            if dst in net and route.metric < best_metric:
                best_metric = route.metric
                best_gw = route.next_hop_ip
        except ValueError:
            continue

    return best_gw


def _learn_mac_on_switches(
    devices: dict[str, Device],
    links: list[Link],
    src_device_id: str,
    src_mac: str,
) -> None:
    for link in links:
        if link.state != "up":
            continue
        if link.a_id == src_device_id:
            port = link.a_port
            switch = devices.get(link.b_id)
            if switch and switch.device_type == "switch":
                switch.mac_table[src_mac] = port
        elif link.b_id == src_device_id:
            port = link.b_port
            switch = devices.get(link.a_id)
            if switch and switch.device_type == "switch":
                switch.mac_table[src_mac] = port
