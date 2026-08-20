# Plan: SRE Security Hardening

## Goal
Fix 10 security concerns that an auditor would flag.

---

## Fix 19: JWT Secret Validation

### Problem
`aiops_shared/config.py` has `JWT_SECRET_KEY: str = "change-me-in-production"`. If `.env` is missing, every deployment uses the same known secret.

### File
`aiops_shared/config.py`

### Fix
```python
class Settings(BaseSettings):
    JWT_SECRET_KEY: str = "change-me-in-production"
    
    @validator('JWT_SECRET_KEY')
    def validate_jwt_secret(cls, v):
        if v == "change-me-in-production" and os.environ.get("ENVIRONMENT") == "production":
            raise ValueError("JWT_SECRET_KEY must be changed in production!")
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return v
```

### Verification
- Startup with default secret in production mode raises error
- Startup with a proper secret (32+ chars) succeeds

---

## Fix 20: Docker Compose Secrets

### Problem
Database credentials are hardcoded in `docker-compose.yml` and committed to version control.

### File
`docker-compose.yml`

### Fix
Reference environment variables:
```yaml
postgres:
  environment:
    POSTGRES_DB: ${POSTGRES_DB:-aiops}
    POSTGRES_USER: ${POSTGRES_USER:-aiops}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}

redis:
  command: redis-server --requirepass ${REDIS_PASSWORD:?Set REDIS_PASSWORD}
```

Add to `.env.example`:
```
POSTGRES_DB=aiops
POSTGRES_USER=aiops
POSTGRES_PASSWORD=changeme-in-production
REDIS_PASSWORD=changeme-in-production
JWT_SECRET_KEY=minimum-32-characters-for-jwt-secret-key
```

### Verification
- `docker compose up` without `.env` fails with clear error
- `.env` file with proper values starts all services

---

## Fix 21: Redis Authentication

### Problem
Redis exposed on port 6379 with no password. Any process can read/write all data.

### File
`docker-compose.yml`

### Fix
Already covered in Fix 3 (Redis password). Additionally:
- Bind Redis to localhost only: `"127.0.0.1:6379:6379"`
- Update all Redis client connections to include password
- Add `rename-command FLUSHALL ""` and `rename-command FLUSHDB ""` to disable dangerous commands

```yaml
redis:
  command: >
    redis-server 
    --requirepass ${REDIS_PASSWORD:-changeme}
    --rename-command FLUSHALL ""
    --rename-command FLUSHDB ""
    --rename-command DEBUG ""
  ports:
    - "127.0.0.1:6379:6379"
```

### Verification
- `redis-cli -h localhost` → `NOAUTH`
- `redis-cli -h localhost -a $REDIS_PASSWORD` → connects
- `redis-cli -h localhost -a $REDIS_PASSWORD FLUSHALL` → `ERR unknown command`

---

## Fix 22: Login Rate Limiting

### Problem
No rate limiting on `/auth/login`. Brute-force attacks possible.

### File
`core_platform/auth/router.py`

### Fix
Add slowapi rate limiter:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginRequest, session=Depends(get_session)):
    # ... existing login logic
```

Add `slowapi` to `pyproject.toml` dependencies.

### Verification
- 5 login attempts in 1 minute: all work
- 6th attempt in same minute: returns 429 Too Many Requests
- Counter resets after 1 minute

---

## Fix 23: Remove Pre-filled Credentials

### Problem
Login form pre-fills `admin@aiops.local` / `admin123`, visible in the client-side JS bundle.

### File
`ui/src/App.tsx`

### Fix
```tsx
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');

// Update placeholders
<input type="email" placeholder="admin@aiops.local" value={email} onChange={e => setEmail(e.target.value)} />
<input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} />
```

### Verification
- Login form loads with empty fields
- Placeholder text shows hint without exposing credentials
- Login still works with correct credentials

---

## Fix 24: CORS Configuration

### Problem
No `CORSMiddleware` on FastAPI. During development, API is accessible from any origin.

### File
`core_platform/main.py`

### Fix
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost", "http://localhost:80"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Verification
- Dev server on port 5173 can call API on port 8000
- Random origin gets blocked
- Production (nginx proxy) works as before

---

## Fix 25: Audit Trail for Sensitive Operations

### Problem
Alert acknowledge/resolve and chatbot fix approval/rejection have no audit logging.

### Files
`plugins/alert_noc/store.py`, `plugins/chatbot/approval.py`

### Fix
Add audit logging to Redis:

```python
# In alert_noc/store.py
async def acknowledge_alert(self, alert_id: str, user: str) -> bool:
    # ... existing logic
    
    # Audit log
    audit_entry = {
        "action": "alert_acknowledge",
        "alert_id": alert_id,
        "user": user,
        "timestamp": time.time(),
    }
    await self.redis.lpush("audit:log", json.dumps(audit_entry))
    await self.redis.ltrim("audit:log", 0, 9999)  # Keep last 10K entries
    return True

# In chatbot/approval.py
async def approve(self, request_id: str, decided_by: str) -> bool:
    # ... existing logic
    
    audit_entry = {
        "action": "approval_granted",
        "request_id": request_id,
        "user": decided_by,
        "timestamp": time.time(),
    }
    await self.redis.lpush("audit:log", json.dumps(audit_entry))
    return True
```

**New endpoint** to query audit log:
```python
@router.get("/audit")
async def get_audit_log(limit: int = 50, _user=Depends(get_current_user)):
    entries = await redis.lrange("audit:log", 0, limit - 1)
    return [json.loads(e) for e in entries]
```

### Verification
- Acknowledge an alert → audit entry appears in `/audit`
- Approve a chatbot fix → audit entry appears
- Audit log shows who did what and when

---

## Fix 26: Security Headers in nginx

### Problem
Already covered in Quick Win 2. Additionally, add CSP and HSTS.

### File
`ui/nginx.conf`

### Fix
```nginx
server {
    listen 80;
    
    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' https://*.basemaps.cartocdn.com https://cdnjs.cloudflare.com data:; connect-src 'self';" always;
    
    # ... rest of config
}
```

### Verification
- `curl -I http://localhost` shows all security headers
- Leaflet CSS from unpkg.com loads (CSP allows it)
- Map tiles from cartocdn.com load (CSP allows them)

---

## Fix 27: Input Validation on Proxy

### Problem
Proxy handlers forward `request.body()` directly without validation.

### File
`core_platform/main.py`

### Fix
Add basic content-type and size validation:

```python
MAX_BODY_SIZE = 1024 * 1024  # 1MB

@router.api_route("/alerts/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_alerts(request: Request, path: str):
    body = await request.body()
    
    # Size limit
    if len(body) > MAX_BODY_SIZE:
        return JSONResponse(status_code=413, content={"detail": "Request body too large"})
    
    # Content-type validation for write operations
    if request.method in ("POST", "PUT"):
        content_type = request.headers.get("content-type", "")
        if not content_type.startswith("application/json"):
            return JSONResponse(status_code=415, content={"detail": "Unsupported media type"})
    
    client = await get_http_client()
    # ... forward to downstream
```

### Verification
- oversized request body → 413 response
- non-JSON content-type on POST → 415 response
- normal requests pass through

---

## Fix 28: Token Revocation

### Problem
No `/auth/logout` endpoint. Compromised tokens remain valid until expiry.

### File
`core_platform/auth/router.py`

### Fix
Add logout endpoint with Redis token blacklist:

```python
@router.post("/logout")
async def logout(request: Request, user=Depends(get_current_user)):
    # Get the token from the Authorization header
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        # Add to blacklist with TTL matching token expiry
        await redis.set(f"token:blacklist:{token[:16]}", "1", ex=900)  # 15 min
    return {"message": "Logged out successfully"}

# Update get_current_user to check blacklist
async def get_current_user(token: str = Depends(oauth2_scheme)):
    # Check if token is blacklisted
    token_prefix = token[:16]
    is_blacklisted = await redis.get(f"token:blacklist:{token_prefix}")
    if is_blacklisted:
        raise HTTPException(status_code=401, detail="Token has been revoked")
    # ... existing validation
```

### Verification
- Login → get token → logout → use old token → 401
- Login → get token → use token → works

---

## Execution Order

All 10 fixes are independent. Execute in parallel:
19. JWT secret validation
20. Docker compose secrets
21. Redis authentication
22. Login rate limiting
23. Remove pre-filled credentials
24. CORS configuration
25. Audit trail
26. Security headers (nginx)
27. Input validation on proxy
28. Token revocation

### Final Step: Rebuild
```bash
docker compose build api-gateway auth-noc chatbot ui
docker compose up -d
```
