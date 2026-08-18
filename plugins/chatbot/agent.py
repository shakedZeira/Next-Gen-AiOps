from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, Annotated, Any
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from plugins.chatbot.tools import query_metrics, query_logs, query_traces, get_topology, propose_fix, execute_fix
from plugins.chatbot.approval import approval_manager, ApprovalStatus

TOOLS_REQUIRING_APPROVAL = {"propose_fix", "execute_fix"}


class ChatState(TypedDict):
    messages: Annotated[list, "Messages"]
    pending_approval: str | None
    approval_context: dict | None


async def agent_node(state: ChatState):
    """Main agent reasoning node."""
    messages = state["messages"]
    last_message = messages[-1] if messages else None

    # Simple rule-based agent for demo (LLM integration via Ollama in production)
    if last_message and isinstance(last_message, HumanMessage):
        content = last_message.content.lower()

        if "metric" in content or "latency" in content or "error rate" in content:
            result = query_metrics.invoke({"service_name": "ecommerce-api", "metric_type": "latency"})
            return {"messages": messages + [AIMessage(content=result)]}
        elif "log" in content:
            result = query_logs.invoke({"service_name": "ecommerce-api", "filter_error": True})
            return {"messages": messages + [AIMessage(content=result)]}
        elif "trace" in content:
            result = query_traces.invoke({"service_name": "ecommerce-api"})
            return {"messages": messages + [AIMessage(content=result)]}
        elif "topology" in content or "depend" in content:
            result = get_topology.invoke({"service_name": "ecommerce-api"})
            return {"messages": messages + [AIMessage(content=result)]}
        elif "fix" in content or "remediat" in content:
            return {
                "messages": messages,
                "pending_approval": "propose_fix",
                "approval_context": {"tool": "propose_fix", "args": {"rca_id": "alert-001", "action_type": "restart"}},
            }
        else:
            return {"messages": messages + [AIMessage(content="I can help you with metrics, logs, traces, topology, and remediation. What would you like to know?")]}

    return {"messages": messages}


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
            AIMessage(content=f"⚠️ Approval required for `{tool_name}`. Request ID: {req.id}. Please approve in the UI.")
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

    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)
