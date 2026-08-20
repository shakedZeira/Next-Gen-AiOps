import json
import uuid
import time
from dataclasses import dataclass, field
from enum import Enum
import redis.asyncio as aioredis
from plugins.chatbot.config import ChatBotConfig

config = ChatBotConfig()

PENDING_HASH_KEY = "chatbot:approvals:pending"
HISTORY_HASH_KEY = "chatbot:approvals:history"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class ApprovalRequest:
    id: str
    tool_name: str
    arguments: dict
    context: str
    status: ApprovalStatus = ApprovalStatus.PENDING
    created_at: float = field(default_factory=time.time)
    decided_at: float | None = None
    decided_by: str | None = None


def _serialize_request(req: ApprovalRequest) -> str:
    return json.dumps({
        "id": req.id,
        "tool_name": req.tool_name,
        "arguments": req.arguments,
        "context": req.context,
        "status": req.status.value,
        "created_at": req.created_at,
        "decided_at": req.decided_at,
        "decided_by": req.decided_by,
    })


def _deserialize_request(data: str) -> ApprovalRequest:
    d = json.loads(data)
    return ApprovalRequest(
        id=d["id"],
        tool_name=d["tool_name"],
        arguments=d["arguments"],
        context=d["context"],
        status=ApprovalStatus(d["status"]),
        created_at=d["created_at"],
        decided_at=d.get("decided_at"),
        decided_by=d.get("decided_by"),
    )


class ApprovalManager:
    def __init__(self):
        self.redis = aioredis.from_url(config.REDIS_URL)

    async def create_request(self, tool_name: str, arguments: dict, context: str) -> ApprovalRequest:
        req = ApprovalRequest(
            id=str(uuid.uuid4()),
            tool_name=tool_name,
            arguments=arguments,
            context=context,
        )
        await self.redis.hset(PENDING_HASH_KEY, req.id, _serialize_request(req))
        return req

    async def approve(self, request_id: str, decided_by: str = "operator") -> bool:
        data = await self.redis.hget(PENDING_HASH_KEY, request_id)
        if not data:
            return False
        req = _deserialize_request(data)
        req.status = ApprovalStatus.APPROVED
        req.decided_at = time.time()
        req.decided_by = decided_by
        # Update pending and log to history
        await self.redis.hdel(PENDING_HASH_KEY, request_id)
        await self.redis.hset(HISTORY_HASH_KEY, request_id, _serialize_request(req))
        return True

    async def reject(self, request_id: str, decided_by: str = "operator") -> bool:
        data = await self.redis.hget(PENDING_HASH_KEY, request_id)
        if not data:
            return False
        req = _deserialize_request(data)
        req.status = ApprovalStatus.REJECTED
        req.decided_at = time.time()
        req.decided_by = decided_by
        # Update pending and log to history
        await self.redis.hdel(PENDING_HASH_KEY, request_id)
        await self.redis.hset(HISTORY_HASH_KEY, request_id, _serialize_request(req))
        return True

    async def get_pending(self) -> list[ApprovalRequest]:
        all_entries = await self.redis.hgetall(PENDING_HASH_KEY)
        pending = []
        for raw in all_entries.values():
            req = _deserialize_request(raw)
            if req.status == ApprovalStatus.PENDING:
                pending.append(req)
        return pending

    async def get_request(self, request_id: str) -> ApprovalRequest | None:
        # Check pending first, then history
        data = await self.redis.hget(PENDING_HASH_KEY, request_id)
        if data:
            return _deserialize_request(data)
        data = await self.redis.hget(HISTORY_HASH_KEY, request_id)
        if data:
            return _deserialize_request(data)
        return None


approval_manager = ApprovalManager()