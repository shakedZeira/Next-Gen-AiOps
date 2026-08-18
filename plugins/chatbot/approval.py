import json
import uuid
import time
from dataclasses import dataclass, field
from enum import Enum
import redis.asyncio as aioredis
from plugins.chatbot.config import ChatBotConfig

config = ChatBotConfig()


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


class ApprovalManager:
    def __init__(self):
        self.redis = aioredis.from_url(config.REDIS_URL)
        self.pending: dict[str, ApprovalRequest] = {}

    async def create_request(self, tool_name: str, arguments: dict, context: str) -> ApprovalRequest:
        req = ApprovalRequest(
            id=str(uuid.uuid4()),
            tool_name=tool_name,
            arguments=arguments,
            context=context,
        )
        self.pending[req.id] = req
        await self.redis.hset("approvals", req.id, json.dumps({
            "id": req.id, "tool_name": tool_name, "arguments": arguments,
            "context": context, "status": req.status, "created_at": req.created_at,
        }))
        return req

    async def approve(self, request_id: str, decided_by: str = "operator") -> bool:
        req = self.pending.get(request_id)
        if not req:
            return False
        req.status = ApprovalStatus.APPROVED
        req.decided_at = time.time()
        req.decided_by = decided_by
        await self.redis.hset("approvals", request_id, json.dumps({
            "id": req.id, "tool_name": req.tool_name, "arguments": req.arguments,
            "context": req.context, "status": req.status, "decided_by": decided_by,
        }))
        return True

    async def reject(self, request_id: str, decided_by: str = "operator") -> bool:
        req = self.pending.get(request_id)
        if not req:
            return False
        req.status = ApprovalStatus.REJECTED
        req.decided_at = time.time()
        req.decided_by = decided_by
        await self.redis.hset("approvals", request_id, json.dumps({
            "id": req.id, "tool_name": req.tool_name, "status": req.status, "decided_by": decided_by,
        }))
        return True

    async def get_pending(self) -> list[ApprovalRequest]:
        return [r for r in self.pending.values() if r.status == ApprovalStatus.PENDING]

    async def get_request(self, request_id: str) -> ApprovalRequest | None:
        return self.pending.get(request_id)


approval_manager = ApprovalManager()
