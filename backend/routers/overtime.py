"""
Overtime Router — OvertimeRule & OvertimeRequest
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

from database import get_db
from models import OvertimeRule, OvertimeRequest, OvertimeStatus
from services.auth_service import require_permission, get_current_user
from services.overtime_service import OvertimeService

router = APIRouter(prefix="/api/v2", tags=["Overtime"])
overtime_svc = OvertimeService()


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class OvertimeRuleCreate(BaseModel):
    rule_name:               str
    applicable_dept_ids:     Optional[List[int]] = None
    applicable_position_ids: Optional[List[int]] = None
    min_duration_minutes:    int = 30
    max_daily_hours:         float = 3.0
    max_weekly_hours:        float = 14.0
    weekday_multiplier:      float = 1.5
    holiday_multiplier:      float = 2.0
    requires_pre_approval:   bool = True
    is_active:               bool = True


class OvertimeRuleResponse(BaseModel):
    id:                      int
    rule_name:               str
    applicable_dept_ids:     Optional[list]
    applicable_position_ids: Optional[list]
    min_duration_minutes:    int
    max_daily_hours:         float
    max_weekly_hours:        float
    weekday_multiplier:      float
    holiday_multiplier:      float
    requires_pre_approval:   bool
    is_active:               bool
    class Config:
        from_attributes = True


class OvertimeRequestCreate(BaseModel):
    employee_id:              str
    date:                     date
    planned_start:            Optional[str] = None
    planned_end:              Optional[str] = None
    planned_duration_minutes: Optional[int] = None
    reason:                   Optional[str] = None


class OvertimeRequestResponse(BaseModel):
    id:                       int
    employee_id:              str
    date:                     date
    planned_start:            Optional[str]
    planned_end:              Optional[str]
    planned_duration_minutes: Optional[int]
    actual_start:             Optional[datetime]
    actual_end:               Optional[datetime]
    actual_duration_minutes:  Optional[int]
    reason:                   Optional[str]
    status:                   str
    approved_by:              Optional[str]
    created_at:               datetime
    class Config:
        from_attributes = True


class ApprovalNote(BaseModel):
    notes: Optional[str] = None


# ─── OVERTIME RULE ENDPOINTS ──────────────────────────────────────────────────

@router.get("/master/overtime-rules", response_model=List[OvertimeRuleResponse],
            dependencies=[Depends(require_permission("master:view"))])
def list_overtime_rules(db: Session = Depends(get_db)):
    return db.query(OvertimeRule).all()


@router.post("/master/overtime-rules", response_model=OvertimeRuleResponse,
             dependencies=[Depends(require_permission("master:manage"))])
def create_overtime_rule(body: OvertimeRuleCreate, db: Session = Depends(get_db)):
    rule = OvertimeRule(**body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/master/overtime-rules/{rule_id}", response_model=OvertimeRuleResponse,
            dependencies=[Depends(require_permission("master:manage"))])
def update_overtime_rule(rule_id: int, body: OvertimeRuleCreate, db: Session = Depends(get_db)):
    rule = db.query(OvertimeRule).filter(OvertimeRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/master/overtime-rules/{rule_id}",
               dependencies=[Depends(require_permission("master:manage"))])
def delete_overtime_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(OvertimeRule).filter(OvertimeRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Aturan lembur tidak ditemukan")
    rule.is_active = False
    db.commit()
    return {"message": "Aturan lembur dinonaktifkan"}


# ─── OVERTIME REQUEST ENDPOINTS ───────────────────────────────────────────────

@router.get("/overtime-requests", response_model=List[OvertimeRequestResponse],
            dependencies=[Depends(require_permission("overtime:request"))])
def list_overtime_requests(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(OvertimeRequest)
    if employee_id:
        q = q.filter(OvertimeRequest.employee_id == employee_id)
    if status:
        q = q.filter(OvertimeRequest.status == status)
    return q.order_by(OvertimeRequest.date.desc()).all()


@router.post("/overtime-requests", response_model=OvertimeRequestResponse,
             dependencies=[Depends(require_permission("overtime:request"))])
def create_overtime_request(body: OvertimeRequestCreate, db: Session = Depends(get_db)):
    if body.planned_duration_minutes:
        validation = overtime_svc.validate_overtime_hours(db, body.employee_id, body.planned_duration_minutes, body.date)
        if validation != "ok":
            raise HTTPException(400, validation)

    req = OvertimeRequest(**body.model_dump())
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/overtime-requests/{req_id}/approve", response_model=OvertimeRequestResponse,
             dependencies=[Depends(require_permission("overtime:approve_team"))])
def approve_overtime(req_id: int, body: ApprovalNote, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.query(OvertimeRequest).filter(OvertimeRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")
    if req.status != OvertimeStatus.pending:
        raise HTTPException(400, f"Status sudah {req.status.value}")
    req.status     = OvertimeStatus.approved
    req.approved_by = current_user.username
    db.commit()
    db.refresh(req)
    return req


@router.post("/overtime-requests/{req_id}/reject",
             dependencies=[Depends(require_permission("overtime:approve_team"))])
def reject_overtime(req_id: int, body: ApprovalNote, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.query(OvertimeRequest).filter(OvertimeRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")
    req.status     = OvertimeStatus.rejected
    req.approved_by = current_user.username
    db.commit()
    return {"message": "Ditolak", "id": req_id}


@router.delete("/overtime-requests/{req_id}",
               dependencies=[Depends(require_permission("overtime:approve_team"))])
def delete_overtime_request(req_id: int, db: Session = Depends(get_db)):
    req = db.query(OvertimeRequest).filter(OvertimeRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan lembur tidak ditemukan")
    db.delete(req)
    db.commit()
    return {"message": "Permohonan lembur dihapus"}


@router.post("/overtime-requests/{req_id}/complete", response_model=OvertimeRequestResponse,
             dependencies=[Depends(require_permission("overtime:approve_team"))])
def complete_overtime(req_id: int, db: Session = Depends(get_db)):
    """Tandai lembur selesai dan hitung durasi aktual dari attendance."""
    req = db.query(OvertimeRequest).filter(OvertimeRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")

    from services.attendance_service import AttendanceService
    att_svc = AttendanceService()
    actual_minutes = att_svc.calculate_overtime(db, req.employee_id, req.date)
    if actual_minutes is not None:
        req.actual_duration_minutes = actual_minutes

    req.status = OvertimeStatus.completed
    db.commit()
    db.refresh(req)
    return req
