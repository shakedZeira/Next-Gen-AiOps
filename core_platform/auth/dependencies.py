from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core_platform.auth.service import decode_token, DEMO_USERS
from core_platform.auth.schemas import UserResponse

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    try:
        payload = decode_token(credentials.credentials)
        user = next((u for u in DEMO_USERS.values() if u["id"] == payload["sub"]), None)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return UserResponse(id=user["id"], email=user["email"], role=user["role"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_role(*roles):
    async def check(user: UserResponse = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return check
