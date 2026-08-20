from contextlib import asynccontextmanager

from fastapi import FastAPI

from plugins.rca_engine.router import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="RCA Engine", lifespan=lifespan)
app.include_router(router, prefix="/api/v1/rca")

@app.get("/health")
async def health():
    return {"status": "healthy"}
