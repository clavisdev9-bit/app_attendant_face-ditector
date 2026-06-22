"""
Auth Service — JWT token management and password hashing
"""

from datetime import datetime, timedelta
from typing import Optional
import os

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production-use-random-256-bit-key")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES  = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 480))   # 8 jam
REFRESH_TOKEN_EXPIRE_DAYS    = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", 7))

pwd_context    = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme  = OAuth2PasswordBearer(tokenUrl="/api/v2/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah expired",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token bukan access token")
    username: str = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User tidak ditemukan atau tidak aktif")
    return user


def require_permission(permission: str):
    """Dependency factory untuk RBAC permission check."""
    def checker(current_user: User = Depends(get_current_user)):
        if not current_user.role or permission not in (current_user.role.permissions or []):
            raise HTTPException(status_code=403, detail=f"Akses ditolak: butuh permission '{permission}'")
        return current_user
    return checker


def get_team_filter(current_user: User, db: Session):
    """Untuk manager: filter ke direct reports saja. Admin: None (semua)."""
    if current_user.role and current_user.role.role_code == "manager":
        from models import Employee
        if current_user.employee_id:
            team = db.query(Employee.employee_id).filter(
                Employee.direct_manager_id == current_user.employee_id
            ).all()
            return [e.employee_id for e in team]
        return []
    return None
