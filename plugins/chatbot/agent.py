from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from plugins.chatbot.approval import approval_manager
from plugins.chatbot.tools import (
    get_topology,
    query_logs,
    query_metrics,
    query_traces,
)

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
                "Let me pull up the current alert status for you.\n\n"
                "**Active Alerts Summary:**\n"
                "- **Critical**: 2 alerts (High Latency P99 on Payment Gateway, Connection Timeout on Auth Service)\n"
                "- **High**: 3 alerts (Error Rate Spike on E-Commerce, Memory Pressure on Analytics, Disk Low on Inventory)\n"
                "- **Medium**: 4 alerts across 3 services\n"
                "- **Low**: 2 alerts (SSL cert expiry, DNS TTL warning)\n\n"
                "The most urgent issue is the **High Latency P99** on Payment Gateway — P99 latency exceeded 2s. "
                "This is impacting checkout flow. Want me to run an RCA analysis on this?"
            ))]}

        elif any(w in content for w in ["health", "status", "system", "overview"]):
            return {"messages": messages + [AIMessage(content=(
                "Here's the current system health overview:\n\n"
                "**Infrastructure:**\n"
                "- **5 sites** online (Global HQ, Regional DC, Metro Ring, NYC Branch, London Branch)\n"
                "- **105 devices** monitored across all sites\n"
                "- **8 services** running in production\n\n"
                "**Health Summary:**\n"
                "- Overall: **87% healthy**\n"
                "- 6 services fully healthy\n"
                "- 1 service degraded (Payment Gateway — high latency)\n"
                "- 1 service warning (Inventory Service — disk space)\n\n"
                "The system is mostly stable. The main concern right now is Payment Gateway performance. "
                "Want me to dig into the metrics or check the topology?"
            ))]}

        elif any(w in content for w in ["diagnostic", "diagnos", "check", "investigate"]):
            return {"messages": messages + [AIMessage(content=(
                "Running diagnostics on **Payment Gateway**...\n\n"
                "**Diagnostic Results:**\n"
                "1. **CPU Usage**: 78% (elevated, baseline is 45%)\n"
                "2. **Memory**: 6.2/8 GB used (77.5%)\n"
                "3. **Error Rate**: 4.8% (threshold: 5%) — borderline\n"
                "4. **P99 Latency**: 2.3s (threshold: 2s) — **breached**\n"
                "5. **Request Rate**: 1,247 req/s (normal range)\n"
                "6. **Upstream Dependencies**: All healthy\n"
                "7. **Database Connection Pool**: 45/50 connections (90% — **high**)\n\n"
                "**Diagnosis:** The database connection pool is nearly saturated, causing request queuing and latency spikes. "
                "Recommendation: Scale connection pool from 50 to 100, or investigate slow queries.\n\n"
                "Want me to propose a fix for the connection pool?"
            ))]}

        elif any(w in content for w in ["cmdb", "service", "dependency", "topology map", "infrastructure"]):
            return {"messages": messages + [AIMessage(content=(
                "Here's the CMDB overview:\n\n"
                "**Sites (5):**\n"
                "- **global-hq** (HQ, Tier III) — 55 devices, Three-Tier Hierarchical\n"
                "- **regional-dc-1** (DC, Tier II) — 17 devices, Hub-and-Spoke\n"
                "- **metro-ring-1** (Large Branch) — 15 devices, ERPS Ring\n"
                "- **branch-nyc** (Large Branch) — 13 devices, Collapsed Core\n"
                "- **branch-london** (Small Branch) — 5 devices, Hub-and-Spoke\n\n"
                "**Services (8):**\n"
                "- E-Commerce Platform (frontend team)\n"
                "- Payment Gateway (payments team) — ⚠ degraded\n"
                "- Inventory Service (data team)\n"
                "- Notification Service (platform team)\n"
                "- Order Processing (backend team)\n"
                "- Analytics Pipeline (data team)\n"
                "- Auth Service (security team)\n"
                "- Network Infrastructure (network team)\n\n"
                "**Total: 105 CIs, 123 relationships, 6 inter-site connections.**\n\n"
                "Want me to show you the topology for a specific site or service?"
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
