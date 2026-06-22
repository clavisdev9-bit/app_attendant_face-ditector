"""
Auth Router — Login, refresh token, current user
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import User, Role
from services.auth_service import (
    verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user, hash_password
)

router = APIRouter(prefix="/api/v2/auth", tags=["Auth"])


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserMeResponse(BaseModel):
    id:          int
    username:    str
    employee_id: Optional[str]
    role_code:   str
    role_name:   str
    permissions: list
    is_active:   bool

    class Config:
        from_attributes = True


class BootstrapRequest(BaseModel):
    username: str
    password: str


SUPER_ADMIN_PERMISSIONS = [
    "attendance:read_all", "attendance:correct_all",
    "leave:manage", "leave:approve_all", "leave:approve_team", "leave:request",
    "overtime:approve_team", "overtime:request",
    "shift:manage", "shift:view_team", "shift:view_own",
    "report:all", "report:team", "report:export",
    "master:manage", "master:view",
    "system:config", "system:audit_log", "system:user_manage",
]


@router.post("/bootstrap")
def bootstrap(body: BootstrapRequest, db: Session = Depends(get_db)):
    """
    Buat akun super_admin pertama. Hanya bisa dijalankan jika belum ada user sama sekali.
    Setelah ada user, endpoint ini akan ditolak.
    """
    if db.query(User).first():
        raise HTTPException(status_code=409, detail="Sistem sudah memiliki user. Gunakan halaman User & Role untuk menambah akun baru.")

    role = db.query(Role).filter(Role.role_code == "super_admin").first()
    if not role:
        role = Role(
            role_code="super_admin",
            role_name="Super Admin",
            permissions=SUPER_ADMIN_PERMISSIONS,
        )
        db.add(role)
        db.flush()

    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    return {"message": f"Akun super_admin '{body.username}' berhasil dibuat. Silakan login."}


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login dengan username + password, returns JWT pair."""
    user = db.query(User).filter(User.username == form.username, User.is_active == True).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Username atau password salah")

    user.last_login = datetime.utcnow()
    db.commit()

    data = {"sub": user.username}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)):
    """Tukar refresh token dengan access token baru."""
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Bukan refresh token")
    username = payload.get("sub")
    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User tidak ditemukan")
    data = {"sub": username}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
    )


@router.get("/me", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Data user yang sedang login."""
    return UserMeResponse(
        id=current_user.id,
        username=current_user.username,
        employee_id=current_user.employee_id,
        role_code=current_user.role.role_code,
        role_name=current_user.role.role_name,
        permissions=current_user.role.permissions or [],
        is_active=current_user.is_active,
    )
