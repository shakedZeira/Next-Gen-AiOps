from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core_platform.auth.schemas import UserResponse
from core_platform.auth.service import DEMO_USERS, decode_token

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    try:
        payload = decode_token(credentials.credentials)
        user = next((u for u in DEMO_USERS.values() if u["id"] == payload["sub"]), None)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return UserResponse(id=user["id"], email=user["email"], role=user["role"])
    except Exception as err:
        raise HTTPException(status_code=401, detail="Invalid token") from err


def require_role(*roles):
    async def check(user: UserResponse = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return check
