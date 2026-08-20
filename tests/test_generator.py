from httpx import AsyncClient

from plugins.generator.main import app


async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


async def test_status():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/status")
        assert resp.status_code == 200
        assert "service_count" in resp.json()
