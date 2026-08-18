import uuid
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from aiops_shared.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Demo users
DEMO_USERS = {
    "admin@aiops.local": {
        "id": str(uuid.uuid4()),
        "email": "admin@aiops.local",
        "password_hash": pwd_context.hash("admin123"),
        "role": "admin",
    },
    "operator@aiops.local": {
        "id": str(uuid.uuid4()),
        "email": "operator@aiops.local",
        "password_hash": pwd_context.hash("operator123"),
        "role": "operator",
    },
    "viewer@aiops.local": {
        "id": str(uuid.uuid4()),
        "email": "viewer@aiops.local",
        "password_hash": pwd_context.hash("viewer123"),
        "role": "viewer",
    },
}


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "role": role, "exp": expire},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "type": "refresh", "exp": expire},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
