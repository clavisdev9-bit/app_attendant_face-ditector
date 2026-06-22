"""
Users & Roles Router
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
from models import User, Role
from services.auth_service import hash_password, get_current_user, require_permission

router = APIRouter(prefix="/api/v2", tags=["Users & Roles"])


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    role_code:   str
    role_name:   str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleResponse(BaseModel):
    id:          int
    role_code:   str
    role_name:   str
    description: Optional[str]
    permissions: List[str]

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username:    str
    password:    str
    role_id:     int
    employee_id: Optional[str] = None


class UserResponse(BaseModel):
    id:          int
    username:    str
    employee_id: Optional[str]
    role_id:     int
    is_active:   bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    role_id:    Optional[int] = None
    is_active:  Optional[bool] = None
    password:   Optional[str] = None


# ─── ROLE ENDPOINTS ──────────────────────────────────────────────────────────

@router.get("/master/roles", response_model=List[RoleResponse],
            dependencies=[Depends(require_permission("system:user_manage"))])
def list_roles(db: Session = Depends(get_db)):
    return db.query(Role).all()


@router.post("/master/roles", response_model=RoleResponse,
             dependencies=[Depends(require_permission("system:user_manage"))])
def create_role(body: RoleCreate, db: Session = Depends(get_db)):
    if db.query(Role).filter(Role.role_code == body.role_code).first():
        raise HTTPException(400, "role_code sudah digunakan")
    role = Role(**body.model_dump())
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/master/roles/{role_id}", response_model=RoleResponse,
            dependencies=[Depends(require_permission("system:user_manage"))])
def update_role(role_id: int, body: RoleCreate, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Role tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(role, k, v)
    db.commit()
    db.refresh(role)
    return role


# ─── USER ENDPOINTS ───────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserResponse],
            dependencies=[Depends(require_permission("system:user_manage"))])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@router.post("/users", response_model=UserResponse,
             dependencies=[Depends(require_permission("system:user_manage"))])
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, "Username sudah digunakan")
    role = db.query(Role).filter(Role.id == body.role_id).first()
    if not role:
        raise HTTPException(404, "Role tidak ditemukan")
    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        role_id=body.role_id,
        employee_id=body.employee_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserResponse,
            dependencies=[Depends(require_permission("system:user_manage"))])
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    if body.role_id is not None:
        user.role_id = body.role_id
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password:
        user.hashed_password = hash_password(body.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}",
               dependencies=[Depends(require_permission("system:user_manage"))])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    user.is_active = False
    db.commit()
    return {"message": "User dinonaktifkan"}


@router.post("/users/seed-defaults",
             dependencies=[Depends(require_permission("system:config"))])
def seed_default_roles(db: Session = Depends(get_db)):
    """Seed role default sistem jika belum ada."""
    DEFAULT_ROLES = [
        {"role_code": "super_admin", "role_name": "Super Admin", "permissions": [
            "attendance:read_all", "attendance:read_team", "attendance:read_own",
            "attendance:correct_all", "attendance:correct_team", "attendance:correct_own",
            "leave:manage", "leave:request", "leave:approve_all", "leave:approve_team",
            "overtime:request", "overtime:approve_team",
            "shift:view_own", "shift:view_team", "shift:manage",
            "report:all", "report:team", "report:export",
            "master:view", "master:manage",
            "system:config", "system:audit_log", "system:user_manage",
        ]},
        {"role_code": "admin", "role_name": "Admin HR", "permissions": [
            "attendance:read_all", "attendance:correct_all",
            "leave:approve_all", "leave:approve_team", "leave:manage", "leave:request",
            "overtime:approve_team", "overtime:request",
            "shift:manage", "shift:view_team", "shift:view_own",
            "report:all", "report:team", "report:export",
            "master:view", "master:manage",
            "system:user_manage",
        ]},
        {"role_code": "hr_staff", "role_name": "Staff HR", "permissions": [
            "attendance:read_all",
            "leave:approve_all", "leave:manage", "leave:request",
            "overtime:request",
            "shift:view_own",
            "report:all", "report:export",
            "master:view",
        ]},
        {"role_code": "manager", "role_name": "Manager", "permissions": [
            "attendance:read_team", "attendance:correct_team",
            "leave:approve_team", "leave:request",
            "overtime:approve_team", "overtime:request",
            "shift:view_team", "shift:view_own",
            "report:team", "report:export",
        ]},
        {"role_code": "employee", "role_name": "Karyawan", "permissions": [
            "attendance:read_own", "attendance:correct_own",
            "leave:request",
            "overtime:request",
            "shift:view_own",
        ]},
    ]
    created, updated = [], []
    for r in DEFAULT_ROLES:
        existing = db.query(Role).filter(Role.role_code == r["role_code"]).first()
        if existing:
            existing.permissions = r["permissions"]
            updated.append(r["role_code"])
        else:
            db.add(Role(**r))
            created.append(r["role_code"])
    db.commit()
    return {"created": created, "updated": updated, "message": f"{len(created)} role dibuat, {len(updated)} diperbarui"}
