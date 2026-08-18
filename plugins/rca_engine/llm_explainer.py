import httpx
from plugins.rca_engine.correlation import RCACandidate
from plugins.rca_engine.config import RCAConfig


class LLMExplainer:
    def __init__(self, config: RCAConfig):
        self.config = config
        self.client = httpx.AsyncClient(base_url=config.OLLAMA_BASE_URL, timeout=60.0)

    async def explain(self, candidates: list[RCACandidate], alert_context: dict) -> str:
        candidates_text = "\n".join([
            f"- {c.ci_name} ({c.ci_type}): score={c.correlation_score:.1f}, blast_radius={c.blast_radius}, anomalies={[a.metric_type for a in c.anomalies]}"
            for c in candidates
        ])

        prompt = f"""You are an SRE analyzing a production incident.

Alert Context:
- Service: {alert_context.get('service', 'unknown')}
- Alert: {alert_context.get('alert_name', 'unknown')}
- Severity: {alert_context.get('severity', 'unknown')}
- Time: {alert_context.get('timestamp', 'unknown')}

Root Cause Candidates (ranked by correlation score):
{candidates_text}

Based on the service topology and anomaly patterns, provide:
1. Most likely root cause (1-2 sentences)
2. Why it's the root cause (evidence from anomalies)
3. Recommended investigation steps (3-5 specific actions)
4. Suggested remediation (if applicable)

Keep your response concise and actionable."""

        try:
            response = await self.client.post("/api/generate", json={
                "model": self.config.MODEL_NAME,
                "prompt": prompt,
                "stream": False,
            })
            response.raise_for_status()
            return response.json().get("response", "LLM explanation unavailable")
        except Exception as e:
            return f"LLM explanation unavailable: {str(e)}"
