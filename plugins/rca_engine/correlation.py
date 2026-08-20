from dataclasses import dataclass, field

from plugins.rca_engine.anomaly_detector import Anomaly


@dataclass
class RCACandidate:
    ci_id: str
    ci_name: str
    ci_type: str
    anomalies: list[Anomaly] = field(default_factory=list)
    blast_radius: int = 0
    correlation_score: float = 0.0
    hypothesis: str = ""


class CorrelationEngine:
    def __init__(self, topology: list[dict], relationships: list[dict]):
        self.topology = topology
        self.relationships = relationships

    def find_candidates(self, anomalies: list[Anomaly], max_candidates: int = 3) -> list[RCACandidate]:
        candidates = {}
        for anomaly in anomalies:
            for node in self.topology:
                if node["name"] == anomaly.service or anomaly.service in node.get("name", ""):
                    ci_id = node["id"]
                    if ci_id not in candidates:
                        candidates[ci_id] = RCACandidate(
                            ci_id=ci_id, ci_name=node["name"], ci_type=node["type"]
                        )
                    candidates[ci_id].anomalies.append(anomaly)
                    candidates[ci_id].correlation_score += anomaly.score

        for ci_id, candidate in candidates.items():
            downstream = self._get_downstream(ci_id)
            candidate.blast_radius = len(downstream)
            candidate.correlation_score += candidate.blast_radius * 0.5

        sorted_candidates = sorted(candidates.values(), key=lambda c: c.correlation_score, reverse=True)
        return sorted_candidates[:max_candidates]

    def _get_downstream(self, ci_id: str) -> list[str]:
        downstream = set()
        queue = [ci_id]
        while queue:
            current = queue.pop(0)
            for rel in self.relationships:
                if rel.get("source") == current and rel.get("target") not in downstream:
                    downstream.add(rel["target"])
                    queue.append(rel["target"])
        return list(downstream)
