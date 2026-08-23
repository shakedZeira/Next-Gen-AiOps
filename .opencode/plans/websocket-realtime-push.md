# Plan: WebSocket Real-Time Push ✅ COMPLETED

**Impact: MEDIUM | Effort: LOW-MEDIUM (1-2 days)**
**Status: COMPLETED** — Commit `3e466bc`
**Dependencies: None**

---

## Goal
Replace polling with WebSocket for real-time alert updates in the NOC console.

## Current State
- Frontend polls `/api/v1/alerts` every 5-10 seconds via `setInterval`
- Backend alert-noc plugin stores alerts in Redis hashes
- No WebSocket infrastructure exists

## Architecture Decision
**Option A: WebSocket through API Gateway** (recommended)
- Add WebSocket endpoint to `core_platform/main.py`
- Gateway proxies to alert-noc WebSocket
- Pros: Single connection, auth via gateway
- Cons: Gateway becomes bottleneck

**Option B: Direct WebSocket to alert-noc**
- Add WebSocket endpoint to `plugins/alert_noc/router.py`
- Frontend connects directly to alert-noc port
- Pros: No gateway bottleneck
- Cons: Need to expose port, handle auth separately

**Decision: Option A** — keep all traffic through gateway for consistency.

## Implementation

### Backend

#### 1. Add WebSocket manager to alert-noc
- File: `plugins/alert_noc/router.py`
- Add `ConnectionManager` class:
  ```python
  class ConnectionManager:
      def __init__(self):
          self.active_connections: list[WebSocket] = []
      
      async def connect(self, websocket: WebSocket):
          await websocket.accept()
          self.active_connections.append(websocket)
      
      def disconnect(self, websocket: WebSocket):
          self.active_connections.remove(websocket)
      
      async def broadcast(self, message: dict):
          for connection in self.active_connections:
              await connection.send_json(message)
  ```

#### 2. Add WebSocket endpoint to alert-noc
- File: `plugins/alert_noc/router.py`
- Add route: `@router.websocket("/ws")`
- On connect: add to manager
- On disconnect: remove from manager
- On new alert: broadcast to all connections

#### 3. Modify alert creation to broadcast
- File: `plugins/alert_noc/store.py`
- After creating/storing alert, call `manager.broadcast()`
- Include alert data + type (new/updated/resolved)

#### 4. Add WebSocket proxy to API gateway
- File: `core_platform/main.py`
- Add route: `@app.websocket("/api/v1/alerts/ws")`
- Proxy WebSocket connection to alert-noc
- Handle connection lifecycle

### Frontend

#### 5. Create WebSocket hook
- File: `ui/src/hooks/useAlertWebSocket.ts`
- Custom hook that:
  - Connects to `/api/v1/alerts/ws`
  - Handles incoming messages (new alert, updated alert, resolved alert)
  - Updates local alert state
  - Reconnects on disconnect with exponential backoff

#### 6. Update NOCAlerts page
- File: `ui/src/pages/NOCAlerts.tsx`
- Replace `setInterval` polling with `useAlertWebSocket` hook
- Keep initial REST fetch for full alert list
- WebSocket provides incremental updates

#### 7. Add connection status indicator
- File: `ui/src/pages/NOCAlerts.tsx`
- Show green dot when WebSocket connected
- Show red dot + "Reconnecting..." when disconnected
- Show last update timestamp

## Files to Modify
- `plugins/alert_noc/router.py` — WebSocket manager + endpoint
- `plugins/alert_noc/store.py` — broadcast on alert create/update
- `core_platform/main.py` — WebSocket proxy route
- `ui/src/hooks/useAlertWebSocket.ts` — NEW: WebSocket hook
- `ui/src/pages/NOCAlerts.tsx` — use hook instead of polling

## Verification
1. Open NOC Alerts page
2. Green dot shows "Connected"
3. Trigger simulate button in another tab
4. New alert appears instantly (no 5s delay)
5. Ack/resolve alert → status updates in real-time
6. Disconnect network → red dot shows, reconnects automatically
