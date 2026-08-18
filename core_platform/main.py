from fastapi import FastAPI
from aiops_shared.otel.instrumentation import init_tracer, instrument_fastapi
from core_platform.auth.router import router as auth_router
from core_platform.routers.health import router as health_router
from core_platform.routers.cmdb import router as cmdb_router

app = FastAPI(title="Next-Gen AiOps Platform", version="0.1.0")

init_tracer("api-gateway")
instrument_fastapi(app, "api-gateway")

app.include_router(health_router, tags=["health"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(cmdb_router, prefix="/api/v1/cmdb", tags=["cmdb"])


@app.get("/")
async def root():
    return {"service": "nextgen-aiops", "version": "0.1.0"}
