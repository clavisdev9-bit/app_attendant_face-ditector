"""
WFH Router — WFHRule, WFHRequest, WFH Check-in
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

from database import get_db
from models import WFHRule, WFHRequest, LeaveStatus
from services.auth_service import require_permission, get_current_user
from services.wfh_service import WFHService

router = APIRouter(prefix="/api/v2", tags=["WFH"])
wfh_svc = WFHService()


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class WFHRuleCreate(BaseModel):
    rule_name:                  str
    applicable_dept_ids:        Optional[List[int]] = None
    applicable_position_ids:    Optional[List[int]] = None
    max_wfh_days_per_week:      int = 0
    require_selfie:             bool = True
    require_gps_validation:     bool = True
    gps_radius_override_meters: Optional[int] = None
    requires_manager_approval:  bool = True
    is_active:                  bool = True


class WFHRuleResponse(BaseModel):
    id:                         int
    rule_name:                  str
    applicable_dept_ids:        Optional[list]
    applicable_position_ids:    Optional[list]
    max_wfh_days_per_week:      int
    require_selfie:             bool
    require_gps_validation:     bool
    gps_radius_override_meters: Optional[int]
    requires_manager_approval:  bool
    is_active:                  bool
    class Config:
        from_attributes = True


class WFHRequestCreate(BaseModel):
    employee_id: str
    date:        date
    reason:      Optional[str] = None


class WFHRequestResponse(BaseModel):
    id:          int
    employee_id: str
    date:        date
    reason:      Optional[str]
    status:      str
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at:  datetime
    class Config:
        from_attributes = True


class WFHCheckinRequest(BaseModel):
    employee_id:  str
    image_base64: Optional[str] = None
    latitude:     Optional[float] = None
    longitude:    Optional[float] = None


class ApprovalNote(BaseModel):
    notes: Optional[str] = None


# ─── WFH RULE ─────────────────────────────────────────────────────────────────

@router.get("/master/wfh-rules", response_model=List[WFHRuleResponse],
            dependencies=[Depends(require_permission("master:view"))])
def list_wfh_rules(db: Session = Depends(get_db)):
    return db.query(WFHRule).all()


@router.post("/master/wfh-rules", response_model=WFHRuleResponse,
             dependencies=[Depends(require_permission("master:manage"))])
def create_wfh_rule(body: WFHRuleCreate, db: Session = Depends(get_db)):
    rule = WFHRule(**body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/master/wfh-rules/{rule_id}", response_model=WFHRuleResponse,
            dependencies=[Depends(require_permission("master:manage"))])
def update_wfh_rule(rule_id: int, body: WFHRuleCreate, db: Session = Depends(get_db)):
    rule = db.query(WFHRule).filter(WFHRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/master/wfh-rules/{rule_id}",
               dependencies=[Depends(require_permission("master:manage"))])
def delete_wfh_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(WFHRule).filter(WFHRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Aturan WFH tidak ditemukan")
    rule.is_active = False
    db.commit()
    return {"message": "Aturan WFH dinonaktifkan"}


# ─── WFH REQUEST ─────────────────────────────────────────────────────────────

@router.get("/wfh-requests", response_model=List[WFHRequestResponse],
            dependencies=[Depends(require_permission("leave:request"))])
def list_wfh_requests(employee_id: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(WFHRequest)
    if employee_id:
        q = q.filter(WFHRequest.employee_id == employee_id)
    if status:
        q = q.filter(WFHRequest.status == status)
    return q.order_by(WFHRequest.date.desc()).all()


@router.post("/wfh-requests", response_model=WFHRequestResponse,
             dependencies=[Depends(require_permission("leave:request"))])
def create_wfh_request(body: WFHRequestCreate, db: Session = Depends(get_db)):
    req = WFHRequest(
        employee_id=body.employee_id,
        date=body.date,
        reason=body.reason,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.delete("/wfh-requests/{req_id}",
               dependencies=[Depends(require_permission("leave:approve_team"))])
def delete_wfh_request(req_id: int, db: Session = Depends(get_db)):
    req = db.query(WFHRequest).filter(WFHRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan WFH tidak ditemukan")
    db.delete(req)
    db.commit()
    return {"message": "Permohonan WFH dihapus"}


@router.post("/wfh-requests/{req_id}/approve", response_model=WFHRequestResponse,
             dependencies=[Depends(require_permission("leave:approve_team"))])
def approve_wfh_request(req_id: int, body: ApprovalNote, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.query(WFHRequest).filter(WFHRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")
    req.status     = LeaveStatus.approved
    req.approved_by = current_user.username
    req.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return req


@router.post("/wfh-requests/{req_id}/reject",
             dependencies=[Depends(require_permission("leave:approve_team"))])
def reject_wfh_request(req_id: int, body: ApprovalNote, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.query(WFHRequest).filter(WFHRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")
    req.status     = LeaveStatus.rejected
    req.approved_by = current_user.username
    req.approved_at = datetime.utcnow()
    db.commit()
    return {"message": "Permohonan ditolak", "id": req_id}


# ─── WFH CHECK-IN ─────────────────────────────────────────────────────────────

@router.post("/attendance/wfh-checkin")
def wfh_checkin(body: WFHCheckinRequest, db: Session = Depends(get_db)):
    """
    WFH check-in / check-out endpoint.
    Tidak memerlukan RFID — menggunakan GPS + selfie untuk verifikasi.
    """
    try:
        result = wfh_svc.checkin_wfh(
            db,
            employee_id=body.employee_id,
            image_base64=body.image_base64,
            latitude=body.latitude,
            longitude=body.longitude,
        )
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
