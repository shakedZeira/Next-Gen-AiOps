"""LangGraph agent with Ollama LLM + tool calling."""

import json
import logging
from typing import Annotated, Any, TypedDict

import httpx
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph

from plugins.chatbot.approval import approval_manager
from plugins.chatbot.config import ChatBotConfig
from plugins.chatbot.tools import TOOL_DEFINITIONS, TOOL_MAP, TOOLS_REQUIRING_APPROVAL

logger = logging.getLogger(__name__)
cfg = ChatBotConfig()

SRE_SYSTEM_PROMPT = """You are an AI SRE assistant for the Next-Gen-AiOps platform. You help operators manage a multi-site network infrastructure.

Your environment:
- 5 sites: global-hq (HQ, 55 devices), regional-dc-1 (DC, 17 devices), metro-ring-1 (15 devices), branch-nyc (13 devices), branch-london (5 devices)
- 8 services: E-Commerce Platform, Payment Gateway, Inventory Service, Notification Service, Order Processing, Analytics Pipeline, Auth Service, Network Infrastructure
- 105 CIs total with IP addressing: 10.site.x.0/24 per device type

Your capabilities (use the provided tools):
- Get current alerts and incidents from the NOC
- Browse the CMDB topology and CI inventory
- Search for CIs by name, type, team, or IP address
- Get site overviews and device details

When responding:
- Be concise and direct — operators need actionable information
- Use bullet points and bold text for readability
- When you find an issue, suggest concrete next steps
- If a user asks about a specific device, use get_ci_info to look it up
- For general questions about infrastructure, use get_topology or get_services
- Always cite which data source your information comes from"""

MAX_TOOL_ROUNDS = 5


class ChatState(TypedDict):
    messages: Annotated[list, "Messages"]
    pending_approval: str | None
    approval_context: dict | None


async def _call_ollama(messages: list[dict], tools: list[dict] | None = None) -> dict:
    """Call Ollama /api/chat with tool support."""
    async with httpx.AsyncClient(base_url=cfg.OLLAMA_BASE_URL, timeout=120.0) as client:
        payload: dict[str, Any] = {
            "model": cfg.MODEL_NAME,
            "messages": messages,
            "stream": False,
        }
        if tools:
            payload["tools"] = tools

        r = await client.post("/api/chat", json=payload)
        r.raise_for_status()
        return r.json().get("message", {})


def _messages_for_llm(messages: list) -> list[dict]:
    """Convert langchain messages to Ollama format."""
    out = []
    for msg in messages:
        if isinstance(msg, SystemMessage):
            out.append({"role": "system", "content": msg.content})
        elif isinstance(msg, HumanMessage):
            out.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            if msg.tool_calls:
                out.append({
                    "role": "assistant",
                    "content": msg.content or "",
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "function": {
                                "name": tc["name"],
                                "arguments": tc["args"],
                            },
                        }
                        for tc in msg.tool_calls
                    ],
                })
            elif msg.content:
                out.append({"role": "assistant", "content": msg.content})
        elif isinstance(msg, ToolMessage):
            out.append({
                "role": "tool",
                "content": msg.content,
            })
    return out


async def agent_node(state: ChatState) -> dict:
    """Main agent node: call Ollama with tools and loop until final answer."""
    messages = list(state["messages"])
    llm_messages = _messages_for_llm(messages)

    for _ in range(MAX_TOOL_ROUNDS):
        try:
            resp = await _call_ollama(llm_messages, tools=TOOL_DEFINITIONS)
        except Exception as e:
            logger.exception("Ollama call failed")
            return {"messages": messages + [AIMessage(content=f"I encountered an error connecting to the LLM: {e}. Please try again.")]}

        content = resp.get("content", "")
        tool_calls = resp.get("tool_calls", [])

        if not tool_calls:
            return {"messages": messages + [AIMessage(content=content)]}

        # Execute tool calls
        assistant_msg = AIMessage(
            content=content,
            tool_calls=[
                {"id": tc["function"]["name"] + f"-{i}", "name": tc["function"]["name"], "args": tc["function"]["arguments"]}
                for i, tc in enumerate(tool_calls)
            ],
        )
        messages.append(assistant_msg)
        llm_messages.append({
            "role": "assistant",
            "content": content,
            "tool_calls": [
                {
                    "id": tc["function"]["name"] + f"-{i}",
                    "function": {
                        "name": tc["function"]["name"],
                        "arguments": tc["function"]["arguments"],
                    },
                }
                for i, tc in enumerate(tool_calls)
            ],
        })

        # Check if any tool requires approval
        for tc in tool_calls:
            fn_name = tc["function"]["name"]
            if fn_name in TOOLS_REQUIRING_APPROVAL:
                return {
                    "messages": messages,
                    "pending_approval": fn_name,
                    "approval_context": {"tool": fn_name, "args": tc["function"]["arguments"]},
                }

        for tc in tool_calls:
            fn_name = tc["function"]["name"]
            fn_args = tc["function"]["arguments"]
            tool_fn = TOOL_MAP.get(fn_name)
            if tool_fn:
                try:
                    if callable(tool_fn) and not isinstance(tool_fn, dict):
                        import inspect
                        if inspect.iscoroutinefunction(tool_fn):
                            result = await tool_fn(**fn_args)
                        else:
                            result = tool_fn(**fn_args)
                    else:
                        result = str(tool_fn)
                except Exception as e:
                    result = f"Error executing {fn_name}: {e}"
            else:
                result = f"Unknown tool: {fn_name}"

            tool_msg = ToolMessage(content=str(result), tool_call_id=tc["function"]["name"] + f"-{tool_calls.index(tc)}")
            messages.append(tool_msg)
            llm_messages.append({"role": "tool", "content": str(result)})

    return {"messages": messages + [AIMessage(content="I've reached the maximum number of tool call iterations. Let me summarize what I found so far. Please ask a more specific question if you need more details.")]}


async def approval_check(state: ChatState):
    """Check if approval is needed."""
    if state.get("pending_approval"):
        return "approval_needed"
    return "end"


async def approval_node(state: ChatState):
    """Handle approval flow."""
    tool_name = state["pending_approval"]
    args = state.get("approval_context", {}).get("args", {})

    req = await approval_manager.create_request(tool_name, args, f"ChatBot wants to execute {tool_name}")

    return {
        "messages": state["messages"] + [
            AIMessage(content=f"I'd like to run `{tool_name}`, but it needs your approval first. I've submitted a request (ID: {req.id}). You can approve or reject it in the Approval Queue panel.")
        ],
        "pending_approval": None,
        "approval_context": None,
    }


def create_agent():
    workflow = StateGraph(ChatState)
    workflow.add_node("agent", agent_node)
    workflow.add_node("approval", approval_node)
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", approval_check, {"approval_needed": "approval", "end": END})
    workflow.add_edge("approval", END)

    from langgraph.checkpoint.memory import MemorySaver
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)
