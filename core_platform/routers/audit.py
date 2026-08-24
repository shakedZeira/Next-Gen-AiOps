import logging

from fastapi import APIRouter, Query

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/audit")
async def list_audit_logs(
    user: str | None = None,
    action: str | None = None,
    resource_type: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    from core_platform.audit import get_audit_logger
    audit = await get_audit_logger()
    events = await audit.list(user, action, resource_type, limit, offset)
    total = await audit.count()
    return {"events": events, "total": total, "limit": limit, "offset": offset}


@router.get("/audit/stats")
async def audit_stats():
    from core_platform.audit import get_audit_logger
    audit = await get_audit_logger()
    return await audit.stats()
