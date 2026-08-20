from fastapi import APIRouter
from pydantic import BaseModel
from plugins.chatbot.agent import create_agent
from plugins.chatbot.approval import approval_manager, ApprovalStatus
from langchain_core.messages import HumanMessage

router = APIRouter()
agent = create_agent()


class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"


class ChatResponse(BaseModel):
    response: str
    thread_id: str


class ApprovalDecision(BaseModel):
    approved: bool
    decided_by: str = "operator"


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    config = {"configurable": {"thread_id": req.thread_id}}
    result = await agent.ainvoke({"messages": [HumanMessage(content=req.message)]}, config)
    last_msg = result["messages"][-1]
    return ChatResponse(response=last_msg.content, thread_id=req.thread_id)


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
    return {"thread_id": thread_id, "messages": []}
