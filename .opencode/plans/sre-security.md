# Plan: SRE Security Hardening (Fixes 19-28)

**Impact: HIGH | Effort: MEDIUM (3-4 days)**
**Status: PARTIAL (Fixes 21, 26 done)**
**Dependencies: None**

---

## Goal
Production-grade security: JWT validation, rate limiting, CORS, audit, CSP/HSTS.

## Current State
- Fix 21 (Redis auth) — ✅ DONE
- Fix 26 (basic headers) — ✅ DONE
- Fix 19 (JWT validator) — NOT DONE
- Fix 20 (compose secrets) — NOT DONE
- Fix 22 (rate limiting) — NOT DONE
- Fix 23 (remove pre-filled credentials) — NOT DONE
- Fix 24 (CORS middleware) — NOT DONE
- Fix 25 (audit trail) — NOT DONE (covered in `audit-log.md`)
- Fix 27 (proxy validation) — NOT DONE
- Fix 28 (token revocation) — NOT DONE

## Implementation

### Fix 19: JWT Secret Validation
- File: `aiops_shared/config.py`
- Remove hardcoded `"change-me-in-production"` default
- Require `JWT_SECRET` environment variable
- Fail fast if not set

```python
import os

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
```

### Fix 20: Compose Secrets Enforcement
- File: `docker-compose.yml`
- Add required variable checks:
  ```yaml
  environment:
    - POSTGRES_PASSWORD:${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    - JWT_SECRET:${JWT_SECRET:?JWT_SECRET is required}
    - REDIS_PASSWORD:${REDIS_PASSWORD:?REDIS_PASSWORD is required}
  ```

### Fix 22: Rate Limiting
- File: `core_platform/main.py`
- Add `slowapi` rate limiter:
  ```python
  from slowapi import Limiter, _rate_limit_exceeded_handler
  from slowapi.util import get_remote_address
  from slowapi.errors import RateLimitExceeded
  
  limiter = Limiter(key_func=get_remote_address)
  app.state.limiter = limiter
  app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
  
  @limiter.limit("10/minute")
  @app.post("/api/v1/auth/login")
  async def login(...):
      ...
  
  @limiter.limit("100/minute")
  @app.get("/api/v1/alerts")
  async def list_alerts(...):
      ...
  ```

### Fix 23: Remove Pre-filled Credentials
- File: `ui/src/App.tsx`
- Remove lines 79-80:
  ```tsx
  // BEFORE
  const [email, setEmail] = useState('admin@aiops.local');
  const [password, setPassword] = useState('admin123');
  
  // AFTER
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  ```

### Fix 24: CORS Middleware
- File: `core_platform/main.py`
- Add CORS middleware:
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:3000", "http://localhost:5173"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

### Fix 27: Proxy Input Validation
- File: `core_platform/main.py`
- Add request body size limit:
  ```python
  MAX_BODY_SIZE = 10 * 1024 * 1024  # 10MB
  
  @app.middleware("http")
  async def validate_body_size(request: Request, call_next):
      if request.method in ["POST", "PUT", "PATCH"]:
          body = await request.body()
          if len(body) > MAX_BODY_SIZE:
              return JSONResponse(
                  status_code=413,
                  content={"detail": "Request body too large"}
              )
      return await call_next(request)
  ```

### Fix 28: Token Revocation/Logout
- File: `core_platform/auth/router.py`
- Add `POST /auth/logout` endpoint:
  ```python
  @router.post("/logout")
  async def logout(token: str = Depends(get_current_user)):
      # Add token to blacklist in Redis
      await redis.set(f"blacklist:{token}", "1", ex=3600)
      return {"message": "Logged out"}
  ```

- File: `core_platform/auth/dependencies.py`
- Check token blacklist in `get_current_user`:
  ```python
  async def get_current_user(token: str = Depends(oauth2_scheme)):
      # Check if token is blacklisted
      if await redis.get(f"blacklist:{token}"):
          raise HTTPException(status_code=401, detail="Token revoked")
      
      # Validate token
      payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
      ...
  ```

### Fix 29: CSP/HSTS Headers
- File: `ui/nginx.conf`
- Add security headers:
  ```nginx
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  ```

## Files to Modify
- `aiops_shared/config.py` — Fix 19: JWT validation
- `docker-compose.yml` — Fix 20: secrets enforcement
- `core_platform/main.py` — Fix 22: rate limiting, Fix 24: CORS, Fix 27: body validation
- `ui/src/App.tsx` — Fix 23: remove pre-filled credentials
- `core_platform/auth/router.py` — Fix 28: logout endpoint
- `core_platform/auth/dependencies.py` — Fix 28: token blacklist check
- `ui/nginx.conf` — Fix 29: CSP/HSTS headers

## Verification
1. Start without JWT_SECRET → fail fast with error
2. Start without POSTGRES_PASSWORD → fail fast with error
3. Login 11 times in 1 minute → rate limit exceeded
4. Login page → empty email/password fields
5. CORS → cross-origin requests allowed
6. Large request body → 413 error
7. Logout → token blacklisted
8. Use blacklisted token → 401 error
9. Check response headers → CSP, HSTS present
