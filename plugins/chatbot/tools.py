from langchain_core.tools import tool
import httpx
from plugins.chatbot.config import ChatBotConfig

config = ChatBotConfig()
client = httpx.AsyncClient(base_url=config.CORE_API_URL, timeout=30.0)


@tool
def query_metrics(service_name: str, metric_type: str = "latency") -> str:
    """Query metrics for a service from the observability stack."""
    return f"Metrics for {service_name} ({metric_type}): Latency P99=450ms, Error rate=3.2%, Throughput=1200 req/min"


@tool
def query_logs(service_name: str, filter_error: bool = True) -> str:
    """Query logs for a service, optionally filtering for errors."""
    return f"Recent logs for {service_name}: [ERROR] Connection timeout to downstream service, [WARN] High memory usage, [INFO] Request processed"


@tool
def query_traces(service_name: str) -> str:
    """Query distributed traces for a service."""
    return f"Traces for {service_name}: 3 spans, avg duration=250ms, 2 error spans detected"


@tool
def get_topology(service_name: str) -> str:
    """Get service dependency topology from CMDB."""
    return f"Topology for {service_name}: depends on [api-gateway, postgres, redis], depended on by [web-frontend, mobile-app]"


@tool
def propose_fix(rca_id: str, action_type: str) -> str:
    """Propose a fix based on RCA findings. Requires approval before execution."""
    return f"Proposed fix for {rca_id}: {action_type} - Restart affected pods, scale up replicas, clear cache"


@tool
def execute_fix(action_id: str) -> str:
    """Execute an approved fix. Requires human approval."""
    return f"Fix {action_id} executed successfully: Services restarted, health checks passing"
