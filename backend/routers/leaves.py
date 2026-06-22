"""
Leave Management Router — LeaveType, LeaveBalance, LeaveRequest, PermissionRequest
"""

import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

from database import get_db
from models import LeaveType, LeaveBalance, LeaveRequest, PermissionType, PermissionRequest, LeaveStatus
from services.auth_service import require_permission, get_current_user
from services.leave_service import LeaveService

router = APIRouter(prefix="/api/v2", tags=["Leave Management"])
leave_svc = LeaveService()
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/uploads")


# ─── LEAVE TYPE ───────────────────────────────────────────────────────────────

class LeaveTypeCreate(BaseModel):
    leave_code:           str
    leave_name:           str
    initial_balance_days: int = 12
    max_balance_days:     int = 24
    min_advance_days:     int = 1
    requires_document:    bool = False
    allow_half_day:       bool = True
    carry_over:           bool = False
    is_active:            bool = True


class LeaveTypeResponse(BaseModel):
    id:                   int
    leave_code:           str
    leave_name:           str
    initial_balance_days: int
    max_balance_days:     int
    min_advance_days:     int
    requires_document:    bool
    allow_half_day:       bool
    carry_over:           bool
    is_active:            bool
    class Config:
        from_attributes = True


@router.get("/master/leave-types", response_model=List[LeaveTypeResponse],
            dependencies=[Depends(require_permission("leave:manage"))])
def list_leave_types(db: Session = Depends(get_db)):
    return db.query(LeaveType).all()


@router.post("/master/leave-types", response_model=LeaveTypeResponse,
             dependencies=[Depends(require_permission("leave:manage"))])
def create_leave_type(body: LeaveTypeCreate, db: Session = Depends(get_db)):
    if db.query(LeaveType).filter(LeaveType.leave_code == body.leave_code).first():
        raise HTTPException(400, "leave_code sudah digunakan")
    lt = LeaveType(**body.model_dump())
    db.add(lt)
    db.commit()
    db.refresh(lt)
    return lt


@router.put("/master/leave-types/{lt_id}", response_model=LeaveTypeResponse,
            dependencies=[Depends(require_permission("leave:manage"))])
def update_leave_type(lt_id: int, body: LeaveTypeCreate, db: Session = Depends(get_db)):
    lt = db.query(LeaveType).filter(LeaveType.id == lt_id).first()
    if not lt:
        raise HTTPException(404, "Leave type tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(lt, k, v)
    db.commit()
    db.refresh(lt)
    return lt


@router.delete("/master/leave-types/{lt_id}",
               dependencies=[Depends(require_permission("leave:manage"))])
def delete_leave_type(lt_id: int, db: Session = Depends(get_db)):
    lt = db.query(LeaveType).filter(LeaveType.id == lt_id).first()
    if not lt:
        raise HTTPException(404, "Jenis cuti tidak ditemukan")
    lt.is_active = False
    db.commit()
    return {"message": "Jenis cuti dinonaktifkan"}


# ─── LEAVE BALANCE ────────────────────────────────────────────────────────────

class BalanceResponse(BaseModel):
    id:                 int
    employee_id:        str
    leave_type_id:      int
    year:               int
    total_balance:      float
    carry_over_balance: float
    used_balance:       float
    class Config:
        from_attributes = True


@router.get("/leave-balances", response_model=List[BalanceResponse],
            dependencies=[Depends(require_permission("leave:manage"))])
def list_balances(employee_id: Optional[str] = None, year: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(LeaveBalance)
    if employee_id:
        q = q.filter(LeaveBalance.employee_id == employee_id)
    if year:
        q = q.filter(LeaveBalance.year == year)
    return q.all()


@router.post("/leave-balances/generate-annual",
             dependencies=[Depends(require_permission("leave:manage"))])
def generate_annual_balances(year: int, db: Session = Depends(get_db)):
    """Generate saldo cuti tahunan untuk semua karyawan aktif."""
    count = leave_svc.generate_annual_balances(db, year)
    return {"created": count, "year": year, "message": f"{count} saldo dibuat untuk tahun {year}"}


# ─── LEAVE REQUEST ────────────────────────────────────────────────────────────

class LeaveRequestCreate(BaseModel):
    employee_id:   str
    leave_type_id: int
    start_date:    date
    end_date:      date
    is_half_day:   bool = False
    reason:        Optional[str] = None


class LeaveRequestResponse(BaseModel):
    id:            int
    employee_id:   str
    leave_type_id: int
    start_date:    date
    end_date:      date
    total_days:    float
    is_half_day:   bool
    reason:        Optional[str]
    document_path: Optional[str]
    status:        str
    approved_by:   Optional[str]
    approved_at:   Optional[datetime]
    notes:         Optional[str]
    created_at:    datetime
    class Config:
        from_attributes = True


class ApprovalNote(BaseModel):
    notes: Optional[str] = None


@router.get("/leave-requests", response_model=List[LeaveRequestResponse],
            dependencies=[Depends(require_permission("leave:manage"))])
def list_leave_requests(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(LeaveRequest)
    if employee_id:
        q = q.filter(LeaveRequest.employee_id == employee_id)
    if status:
        q = q.filter(LeaveRequest.status == status)
    return q.order_by(LeaveRequest.created_at.desc()).all()


@router.post("/leave-requests", response_model=LeaveRequestResponse,
             dependencies=[Depends(require_permission("leave:request"))])
def create_leave_request(body: LeaveRequestCreate, db: Session = Depends(get_db)):
    lt = db.query(LeaveType).filter(LeaveType.id == body.leave_type_id, LeaveType.is_active == True).first()
    if not lt:
        raise HTTPException(404, "Jenis cuti tidak ditemukan")

    total_days = leave_svc.calculate_working_days(body.start_date, body.end_date)
    if body.is_half_day:
        total_days = 0.5

    req = LeaveRequest(
        employee_id=body.employee_id,
        leave_type_id=body.leave_type_id,
        start_date=body.start_date,
        end_date=body.end_date,
        total_days=total_days,
        is_half_day=body.is_half_day,
        reason=body.reason,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/leave-requests/{req_id}/upload-document",
             dependencies=[Depends(require_permission("leave:request"))])
async def upload_leave_document(req_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")
    now_str = datetime.now().strftime("%Y-%m")
    dest_dir = f"{UPLOAD_DIR}/leave/{now_str}"
    os.makedirs(dest_dir, exist_ok=True)
    dest = f"{dest_dir}/{req_id}_{file.filename}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    req.document_path = dest
    db.commit()
    return {"document_path": dest}


@router.post("/leave-requests/{req_id}/approve", response_model=LeaveRequestResponse,
             dependencies=[Depends(require_permission("leave:approve_all"))])
def approve_leave_request(req_id: int, body: ApprovalNote, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        req = leave_svc.approve_leave(db, req_id, current_user.username)
        if body.notes:
            req.notes = body.notes
            db.commit()
        return req
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/leave-requests/{req_id}/reject",
             dependencies=[Depends(require_permission("leave:approve_all"))])
def reject_leave_request(req_id: int, body: ApprovalNote, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")
    if req.status != LeaveStatus.pending:
        raise HTTPException(400, f"Permohonan sudah {req.status.value}")
    req.status     = LeaveStatus.rejected
    req.approved_by = current_user.username
    req.approved_at = datetime.utcnow()
    req.notes      = body.notes
    db.commit()
    return {"message": "Permohonan ditolak", "id": req_id}


@router.post("/leave-requests/{req_id}/cancel",
             dependencies=[Depends(require_permission("leave:request"))])
def cancel_leave_request(req_id: int, db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")
    if req.status not in [LeaveStatus.pending]:
        raise HTTPException(400, "Hanya permohonan pending yang bisa dibatalkan")
    req.status = LeaveStatus.cancelled
    db.commit()
    return {"message": "Permohonan dibatalkan", "id": req_id}


# ─── PERMISSION TYPE ─────────────────────────────────────────────────────────

class PermissionTypeCreate(BaseModel):
    permission_code:   str
    permission_name:   str
    max_days_per_year: int = 3
    requires_approval: bool = True
    requires_document: bool = False
    is_active:         bool = True


class PermissionTypeResponse(BaseModel):
    id:                int
    permission_code:   str
    permission_name:   str
    max_days_per_year: int
    requires_approval: bool
    requires_document: bool
    is_active:         bool
    class Config:
        from_attributes = True


@router.get("/master/permission-types", response_model=List[PermissionTypeResponse],
            dependencies=[Depends(require_permission("leave:manage"))])
def list_permission_types(db: Session = Depends(get_db)):
    return db.query(PermissionType).all()


@router.post("/master/permission-types", response_model=PermissionTypeResponse,
             dependencies=[Depends(require_permission("leave:manage"))])
def create_permission_type(body: PermissionTypeCreate, db: Session = Depends(get_db)):
    if db.query(PermissionType).filter(PermissionType.permission_code == body.permission_code).first():
        raise HTTPException(400, "permission_code sudah digunakan")
    pt = PermissionType(**body.model_dump())
    db.add(pt)
    db.commit()
    db.refresh(pt)
    return pt


@router.put("/master/permission-types/{pt_id}", response_model=PermissionTypeResponse,
            dependencies=[Depends(require_permission("leave:manage"))])
def update_permission_type(pt_id: int, body: PermissionTypeCreate, db: Session = Depends(get_db)):
    pt = db.query(PermissionType).filter(PermissionType.id == pt_id).first()
    if not pt:
        raise HTTPException(404, "Jenis izin tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(pt, k, v)
    db.commit()
    db.refresh(pt)
    return pt


@router.delete("/master/permission-types/{pt_id}",
               dependencies=[Depends(require_permission("leave:manage"))])
def delete_permission_type(pt_id: int, db: Session = Depends(get_db)):
    pt = db.query(PermissionType).filter(PermissionType.id == pt_id).first()
    if not pt:
        raise HTTPException(404, "Jenis izin tidak ditemukan")
    pt.is_active = False
    db.commit()
    return {"message": "Jenis izin dinonaktifkan"}


# ─── PERMISSION REQUEST ───────────────────────────────────────────────────────

class PermissionRequestCreate(BaseModel):
    employee_id:        str
    permission_type_id: int
    start_date:         date
    end_date:           date
    reason:             Optional[str] = None


class PermissionRequestResponse(BaseModel):
    id:                 int
    employee_id:        str
    permission_type_id: int
    start_date:         date
    end_date:           date
    total_days:         float
    reason:             Optional[str]
    document_path:      Optional[str]
    status:             str
    approved_by:        Optional[str]
    approved_at:        Optional[datetime]
    notes:              Optional[str]
    created_at:         datetime
    class Config:
        from_attributes = True


@router.get("/permission-requests", response_model=List[PermissionRequestResponse],
            dependencies=[Depends(require_permission("leave:manage"))])
def list_permission_requests(employee_id: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(PermissionRequest)
    if employee_id:
        q = q.filter(PermissionRequest.employee_id == employee_id)
    if status:
        q = q.filter(PermissionRequest.status == status)
    return q.order_by(PermissionRequest.created_at.desc()).all()


@router.post("/permission-requests", response_model=PermissionRequestResponse,
             dependencies=[Depends(require_permission("leave:request"))])
def create_permission_request(body: PermissionRequestCreate, db: Session = Depends(get_db)):
    total_days = leave_svc.calculate_working_days(body.start_date, body.end_date)
    req = PermissionRequest(
        employee_id=body.employee_id,
        permission_type_id=body.permission_type_id,
        start_date=body.start_date,
        end_date=body.end_date,
        total_days=total_days,
        reason=body.reason,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/permission-requests/{req_id}/approve",
             dependencies=[Depends(require_permission("leave:approve_all"))])
def approve_permission_request(req_id: int, body: ApprovalNote, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.query(PermissionRequest).filter(PermissionRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")
    if req.status != LeaveStatus.pending:
        raise HTTPException(400, f"Permohonan sudah {req.status.value}")
    req.status     = LeaveStatus.approved
    req.approved_by = current_user.username
    req.approved_at = datetime.utcnow()
    req.notes      = body.notes
    db.commit()
    return {"message": "Permohonan disetujui", "id": req_id}


@router.post("/permission-requests/{req_id}/reject",
             dependencies=[Depends(require_permission("leave:approve_all"))])
def reject_permission_request(req_id: int, body: ApprovalNote, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.query(PermissionRequest).filter(PermissionRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permohonan tidak ditemukan")
    req.status     = LeaveStatus.rejected
    req.approved_by = current_user.username
    req.approved_at = datetime.utcnow()
    req.notes      = body.notes
    db.commit()
    return {"message": "Permohonan ditolak", "id": req_id}
