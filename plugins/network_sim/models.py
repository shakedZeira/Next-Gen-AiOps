from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class Interface:
    name: str
    mac: str
    ip: str
    prefix_len: int = 24
    subnet: str = ""
    up: bool = True

    def network(self) -> str:
        import ipaddress
        iface = ipaddress.IPv4Interface(f"{self.ip}/{self.prefix_len}")
        return str(iface.network)


@dataclass
class Device:
    id: str
    name: str
    device_type: str  # host | switch | router | firewall | load_balancer
    site: str = ""
    interfaces: list[Interface] = field(default_factory=list)
    arp_cache: dict[str, dict] = field(default_factory=dict)  # ip -> {mac, age, state}
    mac_table: dict[str, str] = field(default_factory=dict)  # mac -> port
    routes: list[Route] = field(default_factory=list)
    up: bool = True

    def get_interface_by_network(self, network: str) -> Interface | None:
        for iface in self.interfaces:
            if iface.network() == network and iface.up:
                return iface
        return None

    def get_interface_by_ip(self, ip: str) -> Interface | None:
        for iface in self.interfaces:
            if iface.ip == ip and iface.up:
                return iface
        return None


@dataclass
class Link:
    a_id: str
    a_port: str
    b_id: str
    b_port: str
    cost: int = 100
    bandwidth: int = 1000  # Mbps
    state: str = "up"  # up | down
    latency_ms: float = 1.0

    def other(self, device_id: str) -> str:
        return self.b_id if device_id == self.a_id else self.a_id

    def port_for(self, device_id: str) -> str:
        return self.a_port if device_id == self.a_id else self.b_port


@dataclass
class Route:
    prefix: str
    next_hop_ip: str
    out_iface: str
    metric: int = 0
    proto: str = "connected"  # connected | static | ospf | bgp
    admin_dist: int = 0  # connected=0, static=1, eBGP=20, OSPF=110
    state: str = "active"  # active | inactive

    def to_dict(self) -> dict:
        return {
            "prefix": self.prefix,
            "next_hop_ip": self.next_hop_ip,
            "out_iface": self.out_iface,
            "metric": self.metric,
            "proto": self.proto,
            "admin_dist": self.admin_dist,
            "state": self.state,
        }


@dataclass
class NetworkEvent:
    timestamp: float
    event_type: str  # HOP, ARP_REQ, ARP_REPLY, ROUTE_CHANGE, LINK_DOWN, TTL_EXPIRED, DEST_UNREACHABLE
    src: str = ""
    dst: str = ""
    device: str = ""
    detail: str = ""
    data: dict = field(default_factory=dict)
