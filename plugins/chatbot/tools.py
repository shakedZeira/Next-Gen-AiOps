"""Chatbot tools — real implementations calling alert-noc and CMDB database."""

import json
import logging

import httpx
from sqlalchemy import text

from aiops_shared.database import async_session
from plugins.chatbot.config import ChatBotConfig

logger = logging.getLogger(__name__)
cfg = ChatBotConfig()
_http: httpx.AsyncClient | None = None


async def _client() -> httpx.AsyncClient:
    global _http
    if _http is None or _http.is_closed:
        _http = httpx.AsyncClient(timeout=30.0)
    return _http


# ---------------------------------------------------------------------------
# Tool implementations (called by agent_node)
# ---------------------------------------------------------------------------

async def get_alerts(status: str = "active", severity: str | None = None,
                     service: str | None = None, limit: int = 20) -> str:
    """Get current alerts from the NOC alert store."""
    c = await _client()
    params = {"limit": limit}
    if status and status != "all":
        params["status"] = status
    if severity:
        params["severity"] = severity
    if service:
        params["service"] = service
    try:
        r = await c.get(f"{cfg.ALERT_NOC_URL}/api/v1/alerts", params=params)
        r.raise_for_status()
        alerts = r.json()
        if not alerts:
            return "No alerts match your criteria."
        lines = [f"Found {len(alerts)} alert(s):\n"]
        for a in alerts[:15]:
            sev = a.get("severity", "?")
            icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}.get(sev, "⚪")
            lines.append(f"{icon} **{a['name']}** [{sev}] — {a.get('service', 'N/A')} — {a.get('status', 'active')}")
            if a.get("description"):
                lines.append(f"   {a['description'][:100]}")
        if len(alerts) > 15:
            lines.append(f"\n... and {len(alerts) - 15} more.")
        return "\n".join(lines)
    except Exception as e:
        return f"Error fetching alerts: {e}"


async def get_incidents(limit: int = 10) -> str:
    """Get grouped incidents from the NOC alert store."""
    c = await _client()
    try:
        r = await c.get(f"{cfg.ALERT_NOC_URL}/api/v1/alerts/incidents", params={"limit": limit})
        r.raise_for_status()
        incidents = r.json()
        if not incidents:
            return "No active incidents."
        lines = [f"Found {len(incidents)} incident(s):\n"]
        for inc in incidents[:10]:
            sev = inc.get("severity", "?")
            icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}.get(sev, "⚪")
            lines.append(f"{icon} **{inc['name']}** [{sev}] — {inc.get('service', 'N/A')}")
            lines.append(f"   Alerts: {inc.get('alert_count', 0)} | First: {inc.get('first_seen', 'N/A')}")
        return "\n".join(lines)
    except Exception as e:
        return f"Error fetching incidents: {e}"


async def get_topology(site: str | None = None) -> str:
    """Get CI topology from the CMDB. Optionally filter by site."""
    async with async_session() as session:
        if site:
            result = await session.execute(
                text("SELECT name, type, team, site, management_ip, loopback_ip FROM ci WHERE site = :site ORDER BY type, name"),
                {"site": site},
            )
        else:
            result = await session.execute(
                text("SELECT name, type, team, site, management_ip, loopback_ip FROM ci ORDER BY site, type, name LIMIT 50"),
            )
        rows = result.fetchall()

        if not rows:
            return f"No CIs found{' for site ' + site if site else ''}."

        lines = [f"CMDB Topology ({len(rows)} CIs" + (f", site={site}" if site else ", showing 50 of all") + "):\n"]
        current_site = None
        for name, ci_type, team, s, mip, lip in rows:
            if s != current_site:
                current_site = s
                lines.append(f"\n**{s or 'unassigned'}:**")
            ip_info = f" ({mip}" + (f"/{lip}" if lip else "") + ")" if mip else ""
            lines.append(f"  [{ci_type}] {name} — team={team or '?'}{ip_info}")
        return "\n".join(lines)


async def get_ci_info(ci_name: str) -> str:
    """Get detailed info about a specific CI by name or ID."""
    async with async_session() as session:
        result = await session.execute(
            text("""SELECT name, type, provider, environment, team, site, site_type,
                    network_layer, topology_type, management_ip, loopback_ip, subnet, labels
                    FROM ci WHERE name = :q OR id::text = :q LIMIT 1"""),
            {"q": ci_name},
        )
        row = result.first()
        if not row:
            return f"CI '{ci_name}' not found."

        (name, ci_type, provider, env, team, site, site_type,
         net_layer, topo_type, mip, lip, subnet, labels) = row

        lines = [
            f"**{name}** ({ci_type})",
            f"- Site: {site} ({site_type})" if site else "- Site: unassigned",
            f"- Team: {team}" if team else "",
            f"- Provider: {provider}" if provider else "",
            f"- Environment: {env}" if env else "",
            f"- Network Layer: {net_layer}" if net_layer else "",
            f"- Topology: {topo_type}" if topo_type else "",
            f"- Management IP: {mip}" if mip else "",
            f"- Loopback IP: {lip}" if lip else "",
            f"- Subnet: {subnet}" if subnet else "",
        ]

        # Get connected CIs
        result2 = await session.execute(
            text("""SELECT c2.name, c2.type, r.type as rel_type
                    FROM relationship r JOIN ci c2 ON (c2.id = r.target_id OR c2.id = r.source_id)
                    WHERE (r.source_id = (SELECT id FROM ci WHERE name = :name)
                           OR r.target_id = (SELECT id FROM ci WHERE name = :name))
                    AND c2.name != :name LIMIT 10"""),
            {"name": name},
        )
        conns = result2.fetchall()
        if conns:
            lines.append("\n**Connected to:**")
            for cname, ctype, rel in conns:
                lines.append(f"  - {cname} ({ctype}) [{rel}]")

        return "\n".join(l for l in lines if l)


async def search_cis(query: str) -> str:
    """Search CIs by name, type, team, or IP address."""
    async with async_session() as session:
        q = f"%{query}%"
        result = await session.execute(
            text("""SELECT name, type, team, site, management_ip
                    FROM ci WHERE name ILIKE :q OR type ILIKE :q OR team ILIKE :q
                    OR management_ip::text ILIKE :q OR site ILIKE :q
                    ORDER BY name LIMIT 20"""),
            {"q": q},
        )
        rows = result.fetchall()
        if not rows:
            return f"No CIs found matching '{query}'."

        lines = [f"Found {len(rows)} CI(s) matching '{query}':\n"]
        for name, ci_type, team, site, mip in rows:
            ip = f" — {mip}" if mip else ""
            lines.append(f"- **{name}** [{ci_type}] team={team or '?'} site={site or '?'}{ip}")
        return "\n".join(lines)


async def get_services() -> str:
    """List all services with CI counts."""
    async with async_session() as session:
        result = await session.execute(
            text("""SELECT s.name, s.owner_team, s.sla_tier, COUNT(sc.ci_id) as ci_count
                    FROM service s LEFT JOIN service_ci sc ON s.id = sc.service_id
                    GROUP BY s.id, s.name, s.owner_team, s.sla_tier
                    ORDER BY s.name""")
        )
        rows = result.fetchall()
        if not rows:
            return "No services found."

        lines = ["**Services:**\n"]
        for name, team, sla, count in rows:
            lines.append(f"- **{name}** — team={team}, SLA={sla}, CIs={count}")
        return "\n".join(lines)


async def get_site_overview(site: str) -> str:
    """Get a summary of a specific site."""
    async with async_session() as session:
        result = await session.execute(
            text("""SELECT type, COUNT(*) FROM ci WHERE site = :site GROUP BY type ORDER BY COUNT(*) DESC"""),
            {"site": site},
        )
        rows = result.fetchall()
        if not rows:
            return f"Site '{site}' not found or has no CIs."

        total = sum(c for _, c in rows)
        lines = [f"**{site}** — {total} devices\n"]
        for ci_type, count in rows:
            lines.append(f"  - {ci_type}: {count}")
        return "\n".join(lines)


async def propose_fix(action_type: str, target: str, description: str = "") -> str:
    """Propose a remediation action. Requires human approval before execution."""
    return json.dumps({
        "action": action_type,
        "target": target,
        "description": description or f"Proposed {action_type} on {target}",
        "status": "awaiting_approval",
    })


async def execute_fix(action_id: str) -> str:
    """Execute an approved fix. This is approval-gated."""
    return f"Fix {action_id} has been queued for execution. Check the Approval Queue for status."


# ---------------------------------------------------------------------------
# Tool definitions for Ollama (JSON Schema format)
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_alerts",
            "description": "Get current alerts from the NOC. Returns active, acknowledged, or resolved alerts with severity and service info.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "Filter by status: active, acknowledged, resolved, or all", "enum": ["active", "acknowledged", "resolved", "all"]},
                    "severity": {"type": "string", "description": "Filter by severity level", "enum": ["critical", "high", "medium", "low"]},
                    "service": {"type": "string", "description": "Filter by service name"},
                    "limit": {"type": "integer", "description": "Max alerts to return (default 20)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_incidents",
            "description": "Get grouped incidents from the NOC. Incidents are groups of related alerts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max incidents to return (default 10)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_topology",
            "description": "Get CMDB topology showing all configuration items (CIs). Optionally filter by site name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "site": {"type": "string", "description": "Filter by site name (e.g. global-hq, regional-dc-1)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ci_info",
            "description": "Get detailed info about a specific CI (device, server, database, etc) by name. Shows type, site, team, IPs, and connected devices.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ci_name": {"type": "string", "description": "Name of the CI to look up (e.g. hq-core-sw-1, postgres-payments)"},
                },
                "required": ["ci_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_cis",
            "description": "Search for CIs by name, type, team, site, or IP address.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query — matches against name, type, team, site, IP"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_services",
            "description": "List all services with their team, SLA tier, and number of associated CIs.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_site_overview",
            "description": "Get a device count summary for a specific site, broken down by CI type.",
            "parameters": {
                "type": "object",
                "properties": {
                    "site": {"type": "string", "description": "Site name (e.g. global-hq, branch-nyc)"},
                },
                "required": ["site"],
            },
        },
    },
]

# Map tool names to callables
TOOL_MAP = {
    "get_alerts": get_alerts,
    "get_incidents": get_incidents,
    "get_topology": get_topology,
    "get_ci_info": get_ci_info,
    "search_cis": search_cis,
    "get_services": get_services,
    "get_site_overview": get_site_overview,
    "propose_fix": propose_fix,
    "execute_fix": execute_fix,
}

TOOLS_REQUIRING_APPROVAL = {"propose_fix", "execute_fix"}
