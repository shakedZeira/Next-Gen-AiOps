from __future__ import annotations
import ipaddress
import heapq
from collections import defaultdict
from plugins.network_sim.models import Device, Link, Route


def compute_shortest_paths(
    devices: dict[str, Device],
    links: list[Link],
) -> dict[str, dict[str, tuple[str, str, int]]]:
    """Compute shortest paths from every router to every prefix.

    Returns: {device_id: {prefix: (next_hop_ip, out_iface, metric)}}
    """
    graph: dict[str, list[tuple[int, str, str]]] = defaultdict(list)
    link_map: dict[tuple[str, str], Link] = {}

    for link in links:
        if link.state != "up":
            continue
        graph[link.a_id].append((link.cost, link.b_id, link.a_port))
        graph[link.b_id].append((link.cost, link.a_id, link.b_port))
        link_map[(link.a_id, link.b_id)] = link
        link_map[(link.b_id, link.a_id)] = link

    prefix_to_devices: dict[str, list[str]] = defaultdict(list)
    for dev in devices.values():
        if not dev.up:
            continue
        for iface in dev.interfaces:
            if iface.up:
                prefix_to_devices[iface.network()].append(dev.id)

    result: dict[str, dict[str, tuple[str, str, int]]] = {}

    for src_id, src_dev in devices.items():
        if not src_dev.up or src_dev.device_type not in ("router", "firewall", "load_balancer"):
            continue

        dist: dict[str, int] = {src_id: 0}
        prev: dict[str, tuple[str, str, int] | None] = {src_id: None}
        pq: list[tuple[int, str]] = [(0, src_id)]

        while pq:
            d, u = heapq.heappop(pq)
            if d > dist.get(u, float("inf")):
                continue
            for cost, v, port in graph.get(u, []):
                nd = d + cost
                if nd < dist.get(v, float("inf")):
                    dist[v] = nd
                    link = link_map.get((u, v))
                    latency = link.latency_ms if link else 1.0
                    prev[v] = (port, u, nd)
                    heapq.heappush(pq, (nd, v))

        routes: dict[str, tuple[str, str, int]] = {}
        for prefix, dst_dev_ids in prefix_to_devices.items():
            for dst_id in dst_dev_ids:
                if dst_id == src_id:
                    routes[prefix] = ("0.0.0.0", "Loopback0", 0)
                    break
                if dst_id in dist and dst_id != src_id:
                    current = dst_id
                    first_hop = dst_id
                    out_port = ""
                    while prev.get(current) is not None:
                        port, parent, metric = prev[current]
                        first_hop = parent
                        out_port = port
                        current = parent
                        if current == src_id:
                            break

                    if first_hop != src_id:
                        for iface in src_dev.interfaces:
                            if iface.name == out_port:
                                next_hop_ip = iface.ip
                                routes[prefix] = (next_hop_ip, out_port, dist[dst_id])
                                break
                    else:
                        for iface in src_dev.interfaces:
                            for b_dev_id in dst_dev_ids:
                                b_dev = devices.get(b_dev_id)
                                if b_dev:
                                    for b_iface in b_dev.interfaces:
                                        if iface.network() == b_iface.network():
                                            routes[prefix] = (b_iface.ip, iface.name, dist[dst_id])
                                            break
                    break

        result[src_id] = routes

    return result


def build_routing_tables(
    devices: dict[str, Device],
    links: list[Link],
) -> None:
    """Populate Device.routes from computed SPF."""
    prefix_routes = compute_shortest_paths(devices, links)

    for dev in devices.values():
        dev.routes.clear()

        if dev.device_type in ("router", "firewall", "load_balancer"):
            computed = prefix_routes.get(dev.id, {})
            for prefix, (next_hop, out_iface, metric) in computed.items():
                dev.routes.append(Route(
                    prefix=prefix,
                    next_hop_ip=next_hop,
                    out_iface=out_iface,
                    metric=metric,
                    proto="ospf",
                    admin_dist=110,
                ))
        else:
            for iface in dev.interfaces:
                if iface.up:
                    dev.routes.append(Route(
                        prefix=iface.network(),
                        next_hop_ip="0.0.0.0",
                        out_iface=iface.name,
                        metric=0,
                        proto="connected",
                        admin_dist=0,
                    ))


def lookup_route(device: Device, dst_ip: str) -> Route | None:
    """Longest-prefix match on device routing table."""
    dst = ipaddress.IPv4Address(dst_ip)
    best: Route | None = None
    best_prefix_len = -1

    for route in device.routes:
        if route.state != "active":
            continue
        try:
            net = ipaddress.IPv4Network(route.prefix, strict=False)
            if dst in net and net.prefixlen > best_prefix_len:
                best = route
                best_prefix_len = net.prefixlen
        except ValueError:
            continue

    return best
