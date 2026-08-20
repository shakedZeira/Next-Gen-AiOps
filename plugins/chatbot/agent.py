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

        if any(w in content for w in ["alert", "incident", "warning", "critical"]):
            return {"messages": messages + [AIMessage(content=(
                f"Let me pull up the current alert status for you.\n\n"
                f"**Active Alerts Summary:**\n"
                f"- **Critical**: 2 alerts (High Latency P99 on Payment Gateway, Connection Timeout on Auth Service)\n"
                f"- **High**: 3 alerts (Error Rate Spike on E-Commerce, Memory Pressure on Analytics, Disk Low on Inventory)\n"
                f"- **Medium**: 4 alerts across 3 services\n"
                f"- **Low**: 2 alerts (SSL cert expiry, DNS TTL warning)\n\n"
                f"The most urgent issue is the **High Latency P99** on Payment Gateway — P99 latency exceeded 2s. "
                f"This is impacting checkout flow. Want me to run an RCA analysis on this?"
            ))]}

        elif any(w in content for w in ["health", "status", "system", "overview"]):
            return {"messages": messages + [AIMessage(content=(
                f"Here's the current system health overview:\n\n"
                f"**Infrastructure:**\n"
                f"- **5 sites** online (Global HQ, Regional DC, Metro Ring, NYC Branch, London Branch)\n"
                f"- **105 devices** monitored across all sites\n"
                f"- **8 services** running in production\n\n"
                f"**Health Summary:**\n"
                f"- Overall: **87% healthy**\n"
                f"- 6 services fully healthy\n"
                f"- 1 service degraded (Payment Gateway — high latency)\n"
                f"- 1 service warning (Inventory Service — disk space)\n\n"
                f"The system is mostly stable. The main concern right now is Payment Gateway performance. "
                f"Want me to dig into the metrics or check the topology?"
            ))]}

        elif any(w in content for w in ["diagnostic", "diagnos", "check", "investigate"]):
            return {"messages": messages + [AIMessage(content=(
                f"Running diagnostics on **Payment Gateway**...\n\n"
                f"**Diagnostic Results:**\n"
                f"1. **CPU Usage**: 78% (elevated, baseline is 45%)\n"
                f"2. **Memory**: 6.2/8 GB used (77.5%)\n"
                f"3. **Error Rate**: 4.8% (threshold: 5%) — borderline\n"
                f"4. **P99 Latency**: 2.3s (threshold: 2s) — **breached**\n"
                f"5. **Request Rate**: 1,247 req/s (normal range)\n"
                f"6. **Upstream Dependencies**: All healthy\n"
                f"7. **Database Connection Pool**: 45/50 connections (90% — **high**)\n\n"
                f"**Diagnosis:** The database connection pool is nearly saturated, causing request queuing and latency spikes. "
                f"Recommendation: Scale connection pool from 50 to 100, or investigate slow queries.\n\n"
                f"Want me to propose a fix for the connection pool?"
            ))]}

        elif any(w in content for w in ["cmdb", "service", "dependency", "topology map", "infrastructure"]):
            return {"messages": messages + [AIMessage(content=(
                f"Here's the CMDB overview:\n\n"
                f"**Sites (5):**\n"
                f"- **global-hq** (HQ, Tier III) — 55 devices, Three-Tier Hierarchical\n"
                f"- **regional-dc-1** (DC, Tier II) — 17 devices, Hub-and-Spoke\n"
                f"- **metro-ring-1** (Large Branch) — 15 devices, ERPS Ring\n"
                f"- **branch-nyc** (Large Branch) — 13 devices, Collapsed Core\n"
                f"- **branch-london** (Small Branch) — 5 devices, Hub-and-Spoke\n\n"
                f"**Services (8):**\n"
                f"- E-Commerce Platform (frontend team)\n"
                f"- Payment Gateway (payments team) — ⚠ degraded\n"
                f"- Inventory Service (data team)\n"
                f"- Notification Service (platform team)\n"
                f"- Order Processing (backend team)\n"
                f"- Analytics Pipeline (data team)\n"
                f"- Auth Service (security team)\n"
                f"- Network Infrastructure (network team)\n\n"
                f"**Total: 105 CIs, 123 relationships, 6 inter-site connections.**\n\n"
                f"Want me to show you the topology for a specific site or service?"
            ))]}

        elif any(w in content for w in ["metric", "latency", "error rate", "cpu", "memory", "throughput"]):
            result = query_metrics.invoke({"service_name": "ecommerce-api", "metric_type": "latency"})
            return {"messages": messages + [AIMessage(content=f"Sure thing! Let me pull up the latest metrics for you.\n\n{result}\n\nLet me know if you'd like to dig deeper into any of these numbers or compare against a different time range.")]}
        elif "log" in content:
            result = query_logs.invoke({"service_name": "ecommerce-api", "filter_error": True})
            return {"messages": messages + [AIMessage(content=f"Got it! Here are the recent error logs for ecommerce-api:\n\n{result}\n\nWant me to filter further by severity, time window, or look into a specific error pattern?")]}
        elif "trace" in content:
            result = query_traces.invoke({"service_name": "ecommerce-api"})
            return {"messages": messages + [AIMessage(content=f"Here are the latest distributed traces for ecommerce-api:\n\n{result}\n\nWant me to focus on any particular request path or look at latency breakdowns?")]}
        elif "topology" in content or "depend" in content:
            result = get_topology.invoke({"service_name": "ecommerce-api"})
            return {"messages": messages + [AIMessage(content=f"Here's the current service topology for ecommerce-api:\n\n{result}\n\nWould you like me to highlight any specific dependency chain or check the health of a downstream service?")]}
        elif "fix" in content or "remediat" in content:
            return {
                "messages": messages,
                "pending_approval": "propose_fix",
                "approval_context": {"tool": "propose_fix", "args": {"rca_id": "alert-001", "action_type": "restart"}},
            }
        else:
            return {"messages": messages + [AIMessage(content="Hey there! I can help you with metrics, logs, traces, topology, and remediation. Just tell me what you're looking into and I'll dig right in!")]}

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
            AIMessage(content=f"Heads up — I'd like to run `{tool_name}` for you, but it needs approval first. I've submitted a request (ID: {req.id}). You can approve or reject it in the Approval Queue panel on the right.")
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
