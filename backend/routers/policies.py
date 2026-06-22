"""
Attendance Policy Router
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
from models import AttendancePolicy
from services.auth_service import require_permission

router = APIRouter(prefix="/api/v2/master/attendance-policies", tags=["Attendance Policy"])


class PolicyCreate(BaseModel):
    policy_name:                   str
    applicable_dept_ids:           Optional[List[int]] = None
    grace_period_minutes:          int = 15
    early_leave_tolerance_minutes: int = 0
    min_work_hours_per_day:        float = 4.0
    auto_overtime:                 bool = False
    max_auto_overtime_hours:       float = 2.0
    mark_absent_if_no_checkin:     bool = False
    notify_manager_if_absent:      bool = False
    is_active:                     bool = True


class PolicyResponse(BaseModel):
    id:                            int
    policy_name:                   str
    applicable_dept_ids:           Optional[list]
    grace_period_minutes:          int
    early_leave_tolerance_minutes: int
    min_work_hours_per_day:        float
    auto_overtime:                 bool
    max_auto_overtime_hours:       float
    mark_absent_if_no_checkin:     bool
    notify_manager_if_absent:      bool
    is_active:                     bool
    class Config:
        from_attributes = True


@router.get("", response_model=List[PolicyResponse],
            dependencies=[Depends(require_permission("master:view"))])
def list_policies(db: Session = Depends(get_db)):
    return db.query(AttendancePolicy).all()


@router.post("", response_model=PolicyResponse,
             dependencies=[Depends(require_permission("master:manage"))])
def create_policy(body: PolicyCreate, db: Session = Depends(get_db)):
    policy = AttendancePolicy(**body.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.put("/{policy_id}", response_model=PolicyResponse,
            dependencies=[Depends(require_permission("master:manage"))])
def update_policy(policy_id: int, body: PolicyCreate, db: Session = Depends(get_db)):
    policy = db.query(AttendancePolicy).filter(AttendancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(404, "Policy tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(policy, k, v)
    db.commit()
    db.refresh(policy)
    return policy


@router.delete("/{policy_id}",
               dependencies=[Depends(require_permission("master:manage"))])
def delete_policy(policy_id: int, db: Session = Depends(get_db)):
    policy = db.query(AttendancePolicy).filter(AttendancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(404, "Policy tidak ditemukan")
    policy.is_active = False
    db.commit()
    return {"message": "Policy dinonaktifkan"}
