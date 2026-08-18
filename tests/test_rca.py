from httpx import AsyncClient
from plugins.rca_engine.main import app


async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


async def test_analyze():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post("/api/v1/rca/analyze", json={
            "service_name": "ecommerce-api",
            "alert_name": "HighLatency",
            "severity": "high",
            "metrics": [{"service": "ecommerce-api", "latency_ms": 500, "error_rate": 0.1}],
            "topology": [{"id": "1", "name": "ecommerce-api", "type": "api"}],
            "relationships": [],
        })
        assert resp.status_code == 200
        assert "candidates" in resp.json()
