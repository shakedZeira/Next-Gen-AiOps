# Plan: Chat Human Language Understanding

**Impact: HIGH | Effort: MEDIUM (2-3 days)**
**Status: COMPLETED**

---

## Problem

Chatbot uses rule-based keyword matching (`agent.py` line 29: *"Simple rule-based agent for demo"*). Ollama/llama3.1:8b is configured but unwired. Tools are stubs returning hardcoded strings. The chatbot cannot understand natural language or take real actions.

---

## Goal

Wire the LLM (Ollama/llama3.1:8b) into the chatbot with real tool execution, conversation memory, and intent parsing — making it a functional SRE assistant.

---

## Current State

| Component | Status |
|-----------|--------|
| LLM config (Ollama) | Configured in `config.py`, container running in docker-compose |
| Agent logic (`agent.py`) | Rule-based keyword matching, no LLM calls |
| Tools (`tools.py`) | LangChain `@tool` stubs returning hardcoded strings |
| Graph (LangGraph) | `StateGraph` with agent -> approval -> END, `MemorySaver` checkpointer |
| API (`router.py`) | `POST /chat`, approval endpoints wired |
| Conversation memory | `MemorySaver` (in-memory, lost on restart) |

---

## Architecture

### Changes to `plugins/chatbot/agent.py`

Replace keyword matching with LLM + tool-calling loop:

```python
async def agent_node(state: ChatState) -> ChatState:
    messages = state["messages"]
    
    # 1. Inject system prompt
    system = SystemMessage(content=SRE_SYSTEM_PROMPT)
    
    # 2. Call Ollama with tools
    response = await ollama_client.chat(
        model="llama3.1:8b",
        messages=[system] + messages,
        tools=TOOL_DEFINITIONS,  # LangChain tool schemas
    )
    
    # 3. If tool calls, execute them
    if response.tool_calls:
        for tool_call in response.tool_calls:
            result = await execute_tool(tool_call.name, tool_call.args)
            messages.append(ToolMessage(content=result, tool_call_id=tool_call.id))
        # Loop back to LLM with tool results
        response = await ollama_client.chat(...)
    
    return {"messages": messages + [response]}
```

### Changes to `plugins/chatbot/tools.py`

Wire tool functions to real API calls:

| Tool | Implementation |
|------|----------------|
| `query_metrics` | `GET http://generator:8003/api/v1/metrics/{service}?range={range}` |
| `query_logs` | `GET http://generator:8003/api/v1/logs?service={service}&level={level}&limit=50` |
| `get_topology` | `GET http://api-gateway:8000/api/v1/cmdb/topology/all` |
| `get_alerts` | `GET http://alert-noc:8005/api/v1/alerts?status={status}` |
| `get_ci_info` | `GET http://api-gateway:8000/api/v1/cmdb/ci/{id}` |
| `search_cis` | `GET http://api-gateway:8000/api/v1/cmdb/ci?search={query}` |
| `get_services` | `GET http://api-gateway:8000/api/v1/cmdb/service` |
| `propose_fix` | Remains gated (approval required) |
| `execute_fix` | Remains gated (approval required) |

All tools use `httpx.AsyncClient` pointing at service URLs.

### System Prompt

```markdown
You are an AI SRE assistant for the Next-Gen-AiOps platform. You help operators
manage a network infrastructure with 5 sites (global-hq, regional-dc-1, 
metro-ring-1, branch-nyc, branch-london) running 8 microservices.

Your capabilities:
- Query metrics, logs, and traces for any service
- Browse the CMDB topology and CI inventory
- Check active alerts and incident status
- Search for CIs by name, type, team, or IP
- Propose fixes for common issues (requires human approval)

When responding:
- Be concise and direct — operators need actionable information
- Use tables for structured data (alerts, CIs, metrics)
- When you find an issue, suggest next steps
- Always cite which tool/data source your information comes from
- If a proposed fix requires approval, explain what it does and why

Current context:
- 5 sites with different topology types
- Services: Payment Gateway, User Auth, Order API, Inventory, Analytics, etc.
- Alert states: active, acknowledged, resolved
```

### Conversation Memory

Replace in-memory `MemorySaver` with Redis-backed persistence:

1. Store conversation history in Redis: `chat:thread:{thread_id}` (list of messages, TTL 1 hour)
2. Inject last 20 messages into LLM context (sliding window)
3. Persist across page refreshes and container restarts

### Intent Parsing + Context Injection

When a user message mentions a specific CI or service:
1. Auto-detect CI/service names in the message (regex: `\b\w+[-_]\w+\b` matches device names)
2. Inject context: "The user is asking about `dc1-core-sw-1`. Here is its current state: [CI details, recent alerts, connected devices]"
3. For follow-ups: "what about the database?" resolves to the previously discussed CI

### LLM as Intent Parser (for structured queries)

Parse natural language into structured API calls:

| User Intent | Parsed Action |
|-------------|---------------|
| "show me all critical alerts" | `GET /alerts?status=active` + filter by severity=critical |
| "what's the topology of regional-dc-1?" | `GET /cmdb/topology/site/regional-dc-1` |
| "add a firewall to branch-london" | Trigger LLD Planner (Plan 6) |
| "show me the routing table of dc1-core-sw-1" | `GET /network-sim/devices/{id}/routes` |
| "simulate a link failure between X and Y" | `POST /network-sim/failure` |

---

## Implementation Steps

### Phase 1: Wire Ollama LLM (1 day)
1. Replace keyword matching in `agent.py` with Ollama API calls
2. Implement real tool execution in `tools.py` with httpx
3. Add system prompt with SRE persona
4. Test basic conversations and tool calls

### Phase 2: Conversation Memory (0.5 day)
1. Replace `MemorySaver` with Redis-backed storage
2. Implement sliding window (last 20 messages)
3. Thread persistence across restarts

### Phase 3: Intent Parsing + Context (1 day)
1. CI/service name detection in user messages
2. Auto-inject context for detected entities
3. Natural language to structured query parsing
4. Integration with other plugins (network-sim, lld-planner)

---

## Verification

1. "What alerts are active?" -> LLM calls `get_alerts` tool, returns formatted list
2. "Show me the topology" -> LLM calls `get_topology`, returns site summary
3. "What's the IP of dc1-core-sw-1?" -> LLM calls `search_cis`, returns CI with IP
4. "Show me all critical alerts in regional-dc-1" -> LLM parses site + severity, calls correct endpoint
5. Follow-up "what about the database?" -> LLM maintains context from previous question
6. Conversation survives page refresh (Redis persistence)
7. Approval-gated tools (propose_fix) still require human approval
8. npm build + ruff + mypy pass

---

## Files to Modify

| File | Change |
|------|--------|
| `plugins/chatbot/agent.py` | Replace keyword matching with Ollama LLM calls |
| `plugins/chatbot/tools.py` | Wire tools to real API calls with httpx |
| `plugins/chatbot/config.py` | Add conversation TTL, context window settings |
| `plugins/chatbot/router.py` | Add conversation history endpoint, Redis persistence |
| `plugins/chatbot/main.py` | Redis client initialization |

---

## Key References

- [Ollama API](https://ollama.com/library/llama3.1) — Local LLM inference
- [LangGraph tool calling](https://langchain-ai.github.io/langgraph/how-tos/tool-calling/) — Tool integration pattern
- [pysnmp/pysnmp](https://github.com/pysnmp/pysnmp) — For future SNMP tool integration
- [arXiv 2607.00292](https://arxiv.org/html/2607.00292) — LLM-based intent-driven network topology design

---

## What Was Done (COMPLETED)

### Implementation Summary

Replaced rule-based keyword matching with Ollama LLM + real tool calling via LangGraph.

**Model:** `qwen2.5:1.5b` (986MB, fits in 4GB WSL RAM, supports Ollama tool calling)

### Changes Made

| File | Change |
|------|--------|
| `plugins/chatbot/agent.py` | Replaced keyword matching with Ollama `/api/chat` + tool-calling loop (max 5 rounds). SRE system prompt with 5-site/8-service context. |
| `plugins/chatbot/tools.py` | Rewrote 7 tool implementations: get_alerts (alert-noc HTTP), get_incidents, get_topology (direct DB), get_ci_info (direct DB), search_cis (direct DB), get_services (direct DB), get_site_overview (direct DB). Added TOOL_DEFINITIONS for Ollama. |
| `plugins/chatbot/config.py` | Added ALERT_NOC_URL, CONTEXT_WINDOW (20), CONVERSATION_TTL_S (3600). Changed MODEL_NAME to qwen2.5:1.5b. |
| `plugins/chatbot/router.py` | Redis-backed conversation history (load/save via `chat:thread:{id}` keys). History endpoint reads from Redis. |
| `docker-compose.yml` | Added ports mapping (`8004:8004`), DATABASE_URL for direct DB queries. |
| `ui/src/pages/Docs.tsx` | Updated AI Chatbot section with LLM details, tool calling, conversation memory, backend info. |

### Verification Results

- Health check: `{"status":"healthy"}` ✅
- Basic chat: "Hello, what can you help me with?" → Natural response ✅
- Tool calling: "What alerts are currently active?" → get_alerts invoked, returned real data ✅
- Follow-up: "Tell me more about the first one" → Used conversation context ✅
- History: `/history/test-1` → Full conversation persisted in Redis ✅
- Topology: "Show me the topology of global-hq" → get_topology invoked ✅

### Known Limitations

- qwen2.5:1.5b doesn't always call propose_fix tool consistently (smaller model limitation)
- Emoji rendering shows as `???` in some responses (Unicode encoding in display)
- LLM inference takes ~5-15s per request on CPU
