from fastapi import FastAPI
from contextlib import asynccontextmanager
from plugins.alert_noc.router import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="Alert NOC", lifespan=lifespan)
app.include_router(router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status": "healthy"}
