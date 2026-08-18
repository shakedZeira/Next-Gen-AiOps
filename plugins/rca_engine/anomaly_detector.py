from dataclasses import dataclass
from datetime import datetime


@dataclass
class Anomaly:
    service: str
    metric_type: str  # latency, error_rate, token_usage
    severity: str  # low, medium, high, critical
    score: float
    current_value: float
    threshold: float
    timestamp: datetime


class AnomalyDetector:
    def __init__(self, threshold_sd: float = 3.0):
        self.threshold_sd = threshold_sd

    def detect(self, metrics: list[dict], logs: list[dict], traces: list[dict]) -> list[Anomaly]:
        anomalies = []
        anomalies.extend(self._detect_metric_anomalies(metrics))
        anomalies.extend(self._detect_log_anomalies(logs))
        anomalies.extend(self._detect_trace_anomalies(traces))
        return sorted(anomalies, key=lambda a: a.score, reverse=True)

    def _detect_metric_anomalies(self, metrics: list[dict]) -> list[Anomaly]:
        anomalies = []
        by_service = {}
        for m in metrics:
            svc = m.get("service", "unknown")
            if svc not in by_service:
                by_service[svc] = []
            by_service[svc].append(m)

        for svc, svc_metrics in by_service.items():
            latencies = [m["latency_ms"] for m in svc_metrics if "latency_ms" in m]
            error_rates = [m.get("error_rate", 0) for m in svc_metrics]

            if latencies:
                mean = sum(latencies) / len(latencies)
                std = (sum((x - mean) ** 2 for x in latencies) / max(len(latencies), 1)) ** 0.5
                if std > 0:
                    latest = latencies[-1]
                    z_score = (latest - mean) / std
                    if abs(z_score) > self.threshold_sd:
                        anomalies.append(Anomaly(
                            service=svc, metric_type="latency",
                            severity="critical" if z_score > 4 else "high",
                            score=abs(z_score), current_value=latest,
                            threshold=mean + self.threshold_sd * std,
                            timestamp=datetime.utcnow(),
                        ))

            if error_rates:
                latest_error = error_rates[-1]
                if latest_error > 0.05:
                    anomalies.append(Anomaly(
                        service=svc, metric_type="error_rate",
                        severity="critical" if latest_error > 0.2 else "high",
                        score=latest_error * 100, current_value=latest_error,
                        threshold=0.05, timestamp=datetime.utcnow(),
                    ))
        return anomalies

    def _detect_log_anomalies(self, logs: list[dict]) -> list[Anomaly]:
        anomalies = []
        error_logs = [l for l in logs if l.get("level") == "ERROR"]
        if len(error_logs) > 5:
            anomalies.append(Anomaly(
                service="system", metric_type="log_errors",
                severity="high", score=len(error_logs) * 2,
                current_value=len(error_logs), threshold=5,
                timestamp=datetime.utcnow(),
            ))
        return anomalies

    def _detect_trace_anomalies(self, traces: list[dict]) -> list[Anomaly]:
        anomalies = []
        error_traces = [t for t in traces if t.get("status") == "ERROR"]
        if len(error_traces) > 3:
            anomalies.append(Anomaly(
                service="system", metric_type="trace_errors",
                severity="high", score=len(error_traces) * 3,
                current_value=len(error_traces), threshold=3,
                timestamp=datetime.utcnow(),
            ))
        return anomalies
