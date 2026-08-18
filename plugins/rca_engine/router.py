from fastapi import APIRouter
from plugins.rca_engine.anomaly_detector import AnomalyDetector
from plugins.rca_engine.correlation import CorrelationEngine
from plugins.rca_engine.llm_explainer import LLMExplainer
from plugins.rca_engine.config import RCAConfig
from pydantic import BaseModel

router = APIRouter()
config = RCAConfig()


class RCARequest(BaseModel):
    service_name: str
    alert_name: str
    severity: str
    metrics: list[dict] = []
    logs: list[dict] = []
    traces: list[dict] = []
    topology: list[dict] = []
    relationships: list[dict] = []


class RCAResponse(BaseModel):
    candidates: list[dict]
    explanation: str
    alert_context: dict


@router.post("/analyze", response_model=RCAResponse)
async def analyze(req: RCARequest):
    detector = AnomalyDetector(config.ANOMALY_THRESHOLD_SD)
    anomalies = detector.detect(req.metrics, req.logs, req.traces)

    correlator = CorrelationEngine(req.topology, req.relationships)
    candidates = correlator.find_candidates(anomalies, config.MAX_CANDIDATES)

    explainer = LLMExplainer(config)
    alert_context = {
        "service": req.service_name,
        "alert_name": req.alert_name,
        "severity": req.severity,
    }
    explanation = await explainer.explain(candidates, alert_context)

    return RCAResponse(
        candidates=[{
            "ci_id": c.ci_id, "ci_name": c.ci_name, "ci_type": c.ci_type,
            "correlation_score": c.correlation_score, "blast_radius": c.blast_radius,
            "anomalies": [{"type": a.metric_type, "severity": a.severity, "score": a.score} for a in c.anomalies],
        } for c in candidates],
        explanation=explanation,
        alert_context=alert_context,
    )
