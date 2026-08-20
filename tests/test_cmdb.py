from httpx import AsyncClient

from core_platform.main import app
from tests.conftest import requires_db


async def login_admin(client: AsyncClient) -> str:
    resp = await client.post("/auth/login", json={"email": "admin@aiops.local", "password": "admin123"})
    return resp.json()["tokens"]["access_token"]


@requires_db
async def test_crud_ci():
    async with AsyncClient(app=app, base_url="http://test") as client:
        token = await login_admin(client)
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.post("/api/v1/cmdb/ci", json={
            "name": "db-postgres-1", "type": "database", "provider": "aws",
            "environment": "prod", "labels": {"team": "platform"},
        }, headers=headers)
        assert resp.status_code == 200
        ci_id = resp.json()["id"]
        resp = await client.get(f"/api/v1/cmdb/ci/{ci_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "db-postgres-1"
