"""Change tracking router — CRUD + correlation endpoints."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from aiops_shared.database import get_session
from aiops_shared.models.change import Change

router = APIRouter()


class ChangeCreate(BaseModel):
    service: str
    type: str
    description: str = ""
    author: str = ""
    status: str = "successful"
    metadata: dict = {}


@router.get("/")
async def list_changes(
    service: str | None = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
):
    if service:
        result = await session.execute(
            text('SELECT id, service, type, description, author, status, metadata, timestamp, created_at '
                 'FROM "change" WHERE service = :service ORDER BY timestamp DESC LIMIT :limit'),
            {"service": service, "limit": limit},
        )
    else:
        result = await session.execute(
            text('SELECT id, service, type, description, author, status, metadata, timestamp, created_at '
                 'FROM "change" ORDER BY timestamp DESC LIMIT :limit'),
            {"limit": limit},
        )
    rows = result.fetchall()
    return [
        {
            "id": str(r[0]),
            "service": r[1],
            "type": r[2],
            "description": r[3],
            "author": r[4],
            "status": r[5],
            "metadata": r[6] if isinstance(r[6], dict) else {},
            "timestamp": r[7].isoformat() if r[7] else None,
            "created_at": r[8].isoformat() if r[8] else None,
        }
        for r in rows
    ]


@router.post("/")
async def create_change(data: ChangeCreate, session: AsyncSession = Depends(get_session)):
    import uuid as _uuid
    now = datetime.now(timezone.utc)
    change_id = str(_uuid.uuid4())
    await session.execute(
        text('INSERT INTO "change" (id, service, type, description, author, status, metadata, timestamp, created_at) '
             'VALUES (:id, :service, :type, :description, :author, :status, :metadata, :timestamp, :created_at)'),
        {
            "id": change_id,
            "service": data.service,
            "type": data.type,
            "description": data.description,
            "author": data.author,
            "status": data.status,
            "metadata": data.metadata,
            "timestamp": now,
            "created_at": now,
        },
    )
    await session.commit()
    return {"id": change_id, "status": "created"}


@router.get("/recent/{service}")
async def get_recent_changes(service: str, minutes: int = 30, session: AsyncSession = Depends(get_session)):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    result = await session.execute(
        text('SELECT id, service, type, description, author, status, metadata, timestamp '
             'FROM "change" WHERE service = :service AND timestamp >= :cutoff '
             'ORDER BY timestamp DESC'),
        {"service": service, "cutoff": cutoff},
    )
    rows = result.fetchall()
    changes = [
        {
            "id": str(r[0]),
            "service": r[1],
            "type": r[2],
            "description": r[3],
            "author": r[4],
            "status": r[5],
            "metadata": r[6] if isinstance(r[6], dict) else {},
            "timestamp": r[7].isoformat() if r[7] else None,
        }
        for r in rows
    ]
    return {
        "service": service,
        "lookback_minutes": minutes,
        "change_count": len(changes),
        "changes": changes,
    }


@router.get("/correlate/{service}")
async def correlate_changes(service: str, session: AsyncSession = Depends(get_session)):
    now = datetime.now(timezone.utc)
    lookback = timedelta(minutes=30)
    cutoff = now - lookback

    result = await session.execute(
        text('SELECT id, type, description, author, status, timestamp '
             'FROM "change" WHERE service = :service AND timestamp >= :cutoff '
             'ORDER BY timestamp DESC'),
        {"service": service, "cutoff": cutoff},
    )
    rows = result.fetchall()

    changes = []
    for r in rows:
        change_time = r[5]
        minutes_ago = (now - change_time).total_seconds() / 60
        risk_score = max(0, min(100, int(100 - (minutes_ago * 3.33))))
        changes.append({
            "id": str(r[0]),
            "type": r[1],
            "description": r[2],
            "author": r[3],
            "status": r[4],
            "timestamp": change_time.isoformat() if change_time else None,
            "minutes_ago": round(minutes_ago, 1),
            "risk_score": risk_score,
        })

    overall_risk = max((c["risk_score"] for c in changes), default=0)
    return {
        "service": service,
        "has_recent_changes": len(changes) > 0,
        "overall_risk_score": overall_risk,
        "likely_cause": overall_risk > 70,
        "changes": changes,
    }
