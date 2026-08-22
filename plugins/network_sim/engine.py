from __future__ import annotations
import time
from plugins.network_sim.models import Device, Link, NetworkEvent
from plugins.network_sim.addressing import build_device_from_ci, assign_interface_ips
from plugins.network_sim.routing import build_routing_tables, lookup_route
from plugins.network_sim.l2 import resolve_arp
from plugins.network_sim.trace import simulate_ping, simulate_traceroute
from plugins.network_sim.events import EventLog


class NetworkEngine:
    def __init__(self):
        self.devices: dict[str, Device] = {}
        self.links: list[Link] = []
        self.event_log = EventLog()
        self._built = False

    def build_from_cmdb(self, topology: dict, cis: list[dict]) -> None:
        self.devices.clear()
        self.links.clear()
        self.event_log.clear()

        for ci in cis:
            dev = build_device_from_ci(ci)
            self.devices[dev.id] = dev

        edge_type_priority = {"connected_to": 1, "routes_to": 2, "connects_to": 3}
        seen_edges: set[tuple[str, str]] = set()

        for edge in topology.get("edges", []):
            src, tgt = edge["source"], edge["target"]
            key = tuple(sorted([src, tgt]))
            if key in seen_edges:
                continue
            seen_edges.add(key)

            edge_type = edge.get("type", "connected_to")
            if edge_type in ("hosts", "runs", "calls", "depends_on", "publishes_to", "delivers_to"):
                continue

            cost = 100
            if edge_type == "connected_to":
                cost = 10
            elif edge_type == "routes_to":
                cost = 100

            src_dev = self.devices.get(src)
            tgt_dev = self.devices.get(tgt)
            if not src_dev or not tgt_dev:
                continue

            src_name = src_dev.name
            tgt_name = tgt_dev.name
            src_port = f"GigabitEthernet0/{len(self.links)}"
            tgt_port = f"GigabitEthernet0/{len(self.links)}"

            self.links.append(Link(
                a_id=src,
                a_port=src_port,
                b_id=tgt,
                b_port=tgt_port,
                cost=cost,
                bandwidth=1000 if edge_type == "connected_to" else 100,
                latency_ms=0.5 if edge_type == "connected_to" else 5.0,
            ))

            if src_port not in [i.name for i in src_dev.interfaces]:
                from plugins.network_sim.addressing import generate_mac
                from plugins.network_sim.models import Interface
                src_dev.interfaces.append(Interface(
                    name=src_port,
                    mac=generate_mac(src_dev.name, len(src_dev.interfaces)),
                    ip=f"10.0.254.{len(self.links)}",
                    prefix_len=31,
                    subnet=f"10.0.254.{len(self.links) * 2}/31",
                ))
            if tgt_port not in [i.name for i in tgt_dev.interfaces]:
                from plugins.network_sim.addressing import generate_mac
                from plugins.network_sim.models import Interface
                tgt_dev.interfaces.append(Interface(
                    name=tgt_port,
                    mac=generate_mac(tgt_dev.name, len(tgt_dev.interfaces)),
                    ip=f"10.0.254.{len(self.links) + 100}",
                    prefix_len=31,
                    subnet=f"10.0.254.{len(self.links) * 2}/31",
                ))

        build_routing_tables(self.devices, self.links)
        self._built = True

    def get_device(self, device_id: str) -> Device | None:
        return self.devices.get(device_id)

    def get_routing_table(self, device_id: str) -> list[dict]:
        dev = self.devices.get(device_id)
        if not dev:
            return []
        return [r.to_dict() for r in dev.routes if r.state == "active"]

    def get_arp_cache(self, device_id: str) -> dict:
        dev = self.devices.get(device_id)
        if not dev:
            return {}
        return {ip: data for ip, data in dev.arp_cache.items()}

    def get_mac_table(self, device_id: str) -> dict:
        dev = self.devices.get(device_id)
        if not dev:
            return {}
        return dict(dev.mac_table)

    def ping(self, src_id: str, dst_ip: str) -> dict:
        if not self._built:
            return {"success": False, "error": "Engine not initialized"}
        return simulate_ping(self.devices, self.links, src_id, dst_ip)

    def traceroute(self, src_id: str, dst_ip: str) -> dict:
        if not self._built:
            return {"success": False, "error": "Engine not initialized"}
        return simulate_traceroute(self.devices, self.links, src_id, dst_ip)

    def inject_failure(self, target_id: str, failure_type: str = "link", interface_name: str | None = None) -> dict:
        affected_link_info = None

        if failure_type == "link":
            if interface_name:
                link = self._find_link_for_interface(target_id, interface_name)
                if link:
                    link.state = "down"
                    affected_link_info = {"a_id": link.a_id, "b_id": link.b_id, "a_port": link.a_port, "b_port": link.b_port}
                    self.event_log.append(NetworkEvent(
                        timestamp=time.time(),
                        event_type="LINK_DOWN",
                        device=target_id,
                        detail=f"Interface {interface_name} link failure injected",
                    ))
            else:
                affected_links = [l for l in self.links if l.a_id == target_id or l.b_id == target_id]
                for link in affected_links:
                    link.state = "down"
                self.event_log.append(NetworkEvent(
                    timestamp=time.time(),
                    event_type="LINK_DOWN",
                    device=target_id,
                    detail=f"Link failure injected on {len(affected_links)} links",
                ))
        elif failure_type == "device":
            dev = self.devices.get(target_id)
            if dev:
                dev.up = False
                for link in self.links:
                    if link.a_id == target_id or link.b_id == target_id:
                        link.state = "down"
                self.event_log.append(NetworkEvent(
                    timestamp=time.time(),
                    event_type="DEVICE_DOWN",
                    device=dev.name,
                    detail=f"Device {dev.name} taken offline",
                ))

        build_routing_tables(self.devices, self.links)

        dev = self.devices.get(target_id)
        return {
            "status": "ok",
            "affected": target_id,
            "device_name": dev.name if dev else target_id,
            "type": failure_type,
            "interface": interface_name,
            "affected_link": affected_link_info,
        }

    def recover(self, target_id: str, recovery_type: str = "link", interface_name: str | None = None) -> dict:
        recovered_link_info = None

        if recovery_type == "link":
            if interface_name:
                link = self._find_link_for_interface(target_id, interface_name)
                if link and link.state == "down":
                    link.state = "up"
                    recovered_link_info = {"a_id": link.a_id, "b_id": link.b_id, "a_port": link.a_port, "b_port": link.b_port}
                    self.event_log.append(NetworkEvent(
                        timestamp=time.time(),
                        event_type="LINK_UP",
                        device=target_id,
                        detail=f"Interface {interface_name} link recovered",
                    ))
            else:
                for link in self.links:
                    if (link.a_id == target_id or link.b_id == target_id) and link.state == "down":
                        link.state = "up"
                        self.event_log.append(NetworkEvent(
                            timestamp=time.time(),
                            event_type="LINK_UP",
                            device=target_id,
                            detail=f"Link recovered on {target_id}",
                        ))
        elif recovery_type == "device":
            dev = self.devices.get(target_id)
            if dev:
                dev.up = True
                for link in self.links:
                    if (link.a_id == target_id or link.b_id == target_id):
                        link.state = "up"
                self.event_log.append(NetworkEvent(
                    timestamp=time.time(),
                    event_type="DEVICE_UP",
                    device=dev.name,
                    detail=f"Device {dev.name} recovered",
                ))

        build_routing_tables(self.devices, self.links)
        return {"status": "ok", "recovered": target_id, "type": recovery_type, "interface": interface_name, "recovered_link": recovered_link_info}

    def get_all_devices_summary(self) -> list[dict]:
        return [
            {
                "id": dev.id,
                "name": dev.name,
                "type": dev.device_type,
                "site": dev.site,
                "up": dev.up,
                "interfaces": len(dev.interfaces),
                "routes": len(dev.routes),
                "arp_entries": len(dev.arp_cache),
            }
            for dev in self.devices.values()
        ]

    def get_interfaces(self, device_id: str) -> list[dict]:
        dev = self.devices.get(device_id)
        if not dev:
            return []
        return [
            {
                "name": iface.name,
                "ip": iface.ip,
                "mac": iface.mac,
                "up": iface.up,
                "subnet": iface.subnet,
            }
            for iface in dev.interfaces
        ]

    def get_link_states(self) -> list[dict]:
        return [
            {
                "a_id": link.a_id,
                "b_id": link.b_id,
                "a_port": link.a_port,
                "b_port": link.b_port,
                "state": link.state,
                "bandwidth": link.bandwidth,
            }
            for link in self.links
        ]

    def _find_link_for_interface(self, device_id: str, interface_name: str) -> Link | None:
        for link in self.links:
            if link.a_id == device_id and link.a_port == interface_name:
                return link
            if link.b_id == device_id and link.b_port == interface_name:
                return link
        return None


_engine: NetworkEngine | None = None


def get_engine() -> NetworkEngine:
    global _engine
    if _engine is None:
        _engine = NetworkEngine()
    return _engine
