import json
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel

from plugins.chatbot.agent import create_agent
from plugins.chatbot.approval import approval_manager
from plugins.chatbot.config import ChatBotConfig

logger = logging.getLogger(__name__)
cfg = ChatBotConfig()
router = APIRouter()
agent = create_agent()

_redis: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(cfg.REDIS_URL, decode_responses=True)
    return _redis


class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"


class ChatResponse(BaseModel):
    response: str
    thread_id: str


class ApprovalDecision(BaseModel):
    approved: bool
    decided_by: str = "operator"


def _serialize_message(msg) -> dict:
    if isinstance(msg, HumanMessage):
        return {"role": "user", "content": msg.content}
    elif isinstance(msg, AIMessage):
        return {"role": "assistant", "content": msg.content}
    return {"role": "unknown", "content": str(msg)}


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    r = await _get_redis()
    thread_key = f"chat:thread:{req.thread_id}"

    # Load existing conversation from Redis
    existing = await r.lrange(thread_key, 0, -1)
    history = []
    for raw in existing:
        try:
            msg = json.loads(raw)
            if msg["role"] == "user":
                history.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant" and msg["content"]:
                history.append(AIMessage(content=msg["content"]))
        except (json.JSONDecodeError, KeyError):
            continue

    # Add new user message
    history.append(HumanMessage(content=req.message))

    config = {"configurable": {"thread_id": req.thread_id}}
    result = await agent.ainvoke({"messages": history}, config)
    last_msg = result["messages"][-1]
    response_text = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    # Save to Redis
    await r.rpush(thread_key, json.dumps({"role": "user", "content": req.message}))
    await r.rpush(thread_key, json.dumps({"role": "assistant", "content": response_text}))
    await r.expire(thread_key, cfg.CONVERSATION_TTL_S)

    return ChatResponse(response=response_text, thread_id=req.thread_id)


@router.get("/approvals/pending")
async def get_pending_approvals():
    requests = await approval_manager.get_pending()
    return [{"id": r.id, "tool_name": r.tool_name, "arguments": r.arguments, "context": r.context, "created_at": r.created_at} for r in requests]


@router.post("/approvals/{request_id}")
async def decide_approval(request_id: str, decision: ApprovalDecision):
    if decision.approved:
        success = await approval_manager.approve(request_id, decision.decided_by)
    else:
        success = await approval_manager.reject(request_id, decision.decided_by)
    return {"success": success, "status": "approved" if decision.approved else "rejected"}


@router.get("/history/{thread_id}")
async def get_history(thread_id: str):
    r = await _get_redis()
    thread_key = f"chat:thread:{thread_id}"
    raw_messages = await r.lrange(thread_key, 0, -1)
    messages = []
    for raw in raw_messages:
        try:
            messages.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return {"thread_id": thread_id, "messages": messages}


@router.delete("/history/{thread_id}")
async def delete_history(thread_id: str):
    r = await _get_redis()
    thread_key = f"chat:thread:{thread_id}"
    deleted = await r.delete(thread_key)
    return {"success": deleted > 0, "thread_id": thread_id}


class SuggestFixRequest(BaseModel):
    incident_id: str
    title: str
    service: str
    severity: str
    alert_count: int
    alerts: list[dict]
    teams: list[str] = []


@router.post("/suggest-fix", response_model=ChatResponse)
async def suggest_fix(req: SuggestFixRequest):
    r = await _get_redis()
    thread_id = f"incident-{req.incident_id}"

    alert_summary = "\n".join(
        f"- [{a.get('severity','?')}] {a.get('name','?')} — {a.get('description','')[:120]}"
        for a in req.alerts[:15]
    )
    message = (
        f"I need help resolving an incident.\n\n"
        f"**Incident:** {req.title}\n"
        f"**Service:** {req.service}\n"
        f"**Severity:** {req.severity}\n"
        f"**Alerts ({req.alert_count}):**\n{alert_summary}\n\n"
        f"Please analyze the topology and alerts for {req.service} and suggest steps to resolve this incident. "
        f"Consider service dependencies, related CIs, and common root causes."
    )

    thread_key = f"chat:thread:{thread_id}"
    existing = await r.lrange(thread_key, 0, -1)
    history = []
    for raw in existing:
        try:
            msg = json.loads(raw)
            if msg["role"] == "user":
                history.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant" and msg["content"]:
                history.append(AIMessage(content=msg["content"]))
        except (json.JSONDecodeError, KeyError):
            continue

    history.append(HumanMessage(content=message))
    config = {"configurable": {"thread_id": thread_id}}
    result = await agent.ainvoke({"messages": history}, config)
    last_msg = result["messages"][-1]
    response_text = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    await r.rpush(thread_key, json.dumps({"role": "user", "content": message}))
    await r.rpush(thread_key, json.dumps({"role": "assistant", "content": response_text}))
    await r.expire(thread_key, cfg.CONVERSATION_TTL_S)

    return ChatResponse(response=response_text, thread_id=thread_id)
