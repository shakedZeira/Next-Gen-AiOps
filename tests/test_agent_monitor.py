from httpx import AsyncClient

from plugins.agent_monitor.main import app


async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


async def test_stats():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/v1/agent-monitor/stats")
        assert resp.status_code == 200
        assert "total_requests" in resp.json()
