from __future__ import annotations
import time
import json
from plugins.network_sim.models import NetworkEvent


class EventLog:
    def __init__(self, max_size: int = 1000):
        self.events: list[NetworkEvent] = []
        self.max_size = max_size

    def append(self, event: NetworkEvent) -> None:
        self.events.append(event)
        if len(self.events) > self.max_size:
            self.events = self.events[-self.max_size :]

    def get_recent(self, count: int = 50) -> list[dict]:
        return [e.__dict__ for e in self.events[-count:]]

    def get_by_type(self, event_type: str) -> list[dict]:
        return [e.__dict__ for e in self.events if e.event_type == event_type]

    def clear(self) -> None:
        self.events.clear()

    def to_json(self) -> str:
        return json.dumps([e.__dict__ for e in self.events], default=str)
