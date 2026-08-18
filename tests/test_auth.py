from httpx import AsyncClient
from core_platform.main import app


async def test_login_success():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post("/auth/login", json={
            "email": "admin@aiops.local",
            "password": "admin123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "tokens" in data
        assert data["user"]["role"] == "admin"


async def test_login_invalid():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post("/auth/login", json={
            "email": "wrong@aiops.local",
            "password": "wrong",
        })
        assert resp.status_code == 401


async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"
