from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from aiops_shared.database import get_session

router = APIRouter()


@router.get("/health")
async def health(session=Depends(get_session)):
    checks = {}
    status_code = 200

    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = "connected"
    except Exception as e:
        status_code = 503
        checks["database"] = f"disconnected: {str(e)[:100]}"

    try:
        import os
        import redis.asyncio as aioredis
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        r = aioredis.from_url(redis_url)
        await r.ping()
        await r.aclose()
        checks["redis"] = "connected"
    except Exception as e:
        status_code = 503
        checks["redis"] = f"disconnected: {str(e)[:100]}"

    result = {
        "status": "healthy" if status_code == 200 else "unhealthy",
        "service": "nextgen-aiops",
        "version": "0.1.0",
        **checks
    }

    return JSONResponse(status_code=status_code, content=result)