from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    role: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str


class LoginResponse(BaseModel):
    tokens: TokenPair
    user: UserResponse
