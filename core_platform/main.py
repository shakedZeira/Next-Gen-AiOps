from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from aiops_shared.otel.instrumentation import init_tracer, instrument_fastapi
from core_platform.auth.router import router as auth_router
from core_platform.routers.health import router as health_router
from core_platform.routers.cmdb import router as cmdb_router
import httpx

app = FastAPI(title="Next-Gen AiOps Platform", version="0.1.0")

init_tracer("api-gateway")
instrument_fastapi(app, "api-gateway")

app.include_router(health_router, tags=["health"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(cmdb_router, prefix="/api/v1/cmdb", tags=["cmdb"])


@app.api_route("/api/v1/alerts/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_alerts(path: str, request: Request):
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method=request.method,
            url=f"http://alert-noc:8005/api/v1/alerts/{path}",
            params=dict(request.query_params),
            content=await request.body(),
            headers={"Content-Type": request.headers.get("content-type", "application/json")},
        )
        return JSONResponse(content=resp.json(), status_code=resp.status_code)


@app.api_route("/api/v1/alerts", methods=["GET", "POST"])
async def proxy_alerts_root(request: Request):
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method=request.method,
            url="http://alert-noc:8005/api/v1/alerts",
            params=dict(request.query_params),
            content=await request.body(),
            headers={"Content-Type": request.headers.get("content-type", "application/json")},
        )
        return JSONResponse(content=resp.json(), status_code=resp.status_code)


@app.get("/")
async def root():
    return {"service": "nextgen-aiops", "version": "0.1.0"}
