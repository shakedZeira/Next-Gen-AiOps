from fastapi import APIRouter, Depends, HTTPException

from core_platform.auth.dependencies import get_current_user
from core_platform.auth.schemas import LoginRequest, LoginResponse, TokenPair, UserResponse
from core_platform.auth.service import (
    DEMO_USERS,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = DEMO_USERS.get(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access = create_access_token(user["id"], user["role"])
    refresh = create_refresh_token(user["id"])
    return LoginResponse(
        tokens=TokenPair(access_token=access, refresh_token=refresh),
        user=UserResponse(id=user["id"], email=user["email"], role=user["role"]),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(refresh_token: str):
    try:
        payload = decode_token(refresh_token)
    except Exception as err:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from err
    user = next((u for u in DEMO_USERS.values() if u["id"] == payload["sub"]), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["id"], user["role"])
    new_refresh = create_refresh_token(user["id"])
    return TokenPair(access_token=access, refresh_token=new_refresh)


@router.get("/me", response_model=UserResponse)
async def me(user=Depends(get_current_user)):
    return user
