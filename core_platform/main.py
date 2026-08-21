from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from aiops_shared.otel.instrumentation import init_tracer, instrument_fastapi
from core_platform.auth.router import router as auth_router
from core_platform.routers.cmdb import router as cmdb_router
from core_platform.routers.health import router as health_router

_http_client: httpx.AsyncClient | None = None
_chatbot_client: httpx.AsyncClient | None = None


async def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(5.0, connect=2.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _http_client


async def get_chatbot_client() -> httpx.AsyncClient:
    global _chatbot_client
    if _chatbot_client is None or _chatbot_client.is_closed:
        _chatbot_client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=5.0),
            limits=httpx.Limits(max_connections=5, max_keepalive_connections=2),
        )
    return _chatbot_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Cleanup
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
    if _chatbot_client and not _chatbot_client.is_closed:
        await _chatbot_client.aclose()


app = FastAPI(title="Next-Gen AiOps Platform", version="0.1.0", lifespan=lifespan)

init_tracer("api-gateway")
instrument_fastapi(app, "api-gateway")

app.include_router(health_router, tags=["health"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(cmdb_router, prefix="/api/v1/cmdb", tags=["cmdb"])


@app.api_route("/api/v1/alerts/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_alerts(path: str, request: Request):
    client = await get_http_client()
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
    client = await get_http_client()
    resp = await client.request(
        method=request.method,
        url="http://alert-noc:8005/api/v1/alerts",
        params=dict(request.query_params),
        content=await request.body(),
        headers={"Content-Type": request.headers.get("content-type", "application/json")},
    )
    return JSONResponse(content=resp.json(), status_code=resp.status_code)


@app.api_route("/api/v1/simulate/{path:path}", methods=["GET", "POST"])
async def proxy_simulate(path: str, request: Request):
    client = await get_http_client()
    resp = await client.request(
        method=request.method,
        url=f"http://alert-noc:8005/api/v1/simulate/{path}",
        params=dict(request.query_params),
        content=await request.body(),
        headers={"Content-Type": request.headers.get("content-type", "application/json")},
    )
    return JSONResponse(content=resp.json(), status_code=resp.status_code)


@app.api_route("/api/v1/chatbot/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_chatbot(path: str, request: Request):
    client = await get_chatbot_client()
    try:
        resp = await client.request(
            method=request.method,
            url=f"http://chatbot:8004/api/v1/chatbot/{path}",
            params=dict(request.query_params),
            content=await request.body(),
            headers={"Content-Type": request.headers.get("content-type", "application/json")},
        )
        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text[:2000]}
        return JSONResponse(content=body, status_code=resp.status_code)
    except httpx.TimeoutException:
        return JSONResponse(content={"error": "Chatbot request timed out"}, status_code=504)
    except httpx.ConnectError:
        return JSONResponse(content={"error": "Chatbot service unavailable"}, status_code=502)


@app.get("/")
async def root():
    return {"service": "nextgen-aiops", "version": "0.1.0"}
