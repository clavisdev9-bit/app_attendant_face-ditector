"""
Shifts, Employee Schedules & Holiday Router
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

from database import get_db
from models import Shift, EmployeeSchedule, Holiday
from services.auth_service import require_permission

router = APIRouter(prefix="/api/v2", tags=["Shift & Schedule"])


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class ShiftCreate(BaseModel):
    shift_code:           str
    shift_name:           str
    start_time:           str
    end_time:             str
    break_start:          Optional[str] = None
    break_end:            Optional[str] = None
    total_work_minutes:   Optional[int] = None
    grace_period_minutes: int = 15
    crosses_midnight:     bool = False
    is_active:            bool = True


class ShiftResponse(BaseModel):
    id:                   int
    shift_code:           str
    shift_name:           str
    start_time:           str
    end_time:             str
    break_start:          Optional[str]
    break_end:            Optional[str]
    total_work_minutes:   Optional[int]
    grace_period_minutes: int
    crosses_midnight:     bool
    is_active:            bool
    class Config:
        from_attributes = True


class ScheduleCreate(BaseModel):
    employee_id: str
    shift_id:    int
    valid_from:  date
    valid_to:    Optional[date] = None
    work_days:   List[str] = ["MON", "TUE", "WED", "THU", "FRI"]
    notes:       Optional[str] = None


class ScheduleResponse(BaseModel):
    id:          int
    employee_id: str
    shift_id:    int
    valid_from:  date
    valid_to:    Optional[date]
    work_days:   list
    notes:       Optional[str]
    class Config:
        from_attributes = True


class HolidayCreate(BaseModel):
    holiday_name:            str
    date:                    date
    holiday_type:            str  # national | company | collective_leave
    applicable_dept_ids:     Optional[List[int]] = None
    applicable_location_ids: Optional[List[int]] = None


class HolidayResponse(BaseModel):
    id:                      int
    holiday_name:            str
    date:                    date
    holiday_type:            str
    applicable_dept_ids:     Optional[list]
    applicable_location_ids: Optional[list]
    class Config:
        from_attributes = True


# ─── SHIFT ENDPOINTS ─────────────────────────────────────────────────────────

@router.get("/shifts", response_model=List[ShiftResponse],
            dependencies=[Depends(require_permission("shift:view_own"))])
def list_shifts(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(Shift)
    if active_only:
        q = q.filter(Shift.is_active == True)
    return q.all()


@router.post("/shifts", response_model=ShiftResponse,
             dependencies=[Depends(require_permission("shift:manage"))])
def create_shift(body: ShiftCreate, db: Session = Depends(get_db)):
    if db.query(Shift).filter(Shift.shift_code == body.shift_code).first():
        raise HTTPException(400, "shift_code sudah digunakan")
    shift = Shift(**body.model_dump())
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@router.put("/shifts/{shift_id}", response_model=ShiftResponse,
            dependencies=[Depends(require_permission("shift:manage"))])
def update_shift(shift_id: int, body: ShiftCreate, db: Session = Depends(get_db)):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(404, "Shift tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(shift, k, v)
    db.commit()
    db.refresh(shift)
    return shift


# ─── SCHEDULE ENDPOINTS ───────────────────────────────────────────────────────

@router.get("/schedules", response_model=List[ScheduleResponse],
            dependencies=[Depends(require_permission("shift:view_team"))])
def list_schedules(employee_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(EmployeeSchedule)
    if employee_id:
        q = q.filter(EmployeeSchedule.employee_id == employee_id)
    return q.all()


@router.get("/schedules/active", response_model=Optional[ScheduleResponse],
            dependencies=[Depends(require_permission("shift:view_own"))])
def get_active_schedule(employee_id: str, check_date: Optional[date] = None, db: Session = Depends(get_db)):
    """Jadwal shift aktif untuk karyawan pada tanggal tertentu."""
    from datetime import date as date_cls
    target = check_date or date_cls.today()
    schedule = (
        db.query(EmployeeSchedule)
        .filter(
            EmployeeSchedule.employee_id == employee_id,
            EmployeeSchedule.valid_from <= target,
            (EmployeeSchedule.valid_to == None) | (EmployeeSchedule.valid_to >= target),
        )
        .order_by(EmployeeSchedule.valid_from.desc())
        .first()
    )
    return schedule


@router.post("/schedules", response_model=ScheduleResponse,
             dependencies=[Depends(require_permission("shift:manage"))])
def create_schedule(body: ScheduleCreate, db: Session = Depends(get_db)):
    sched = EmployeeSchedule(**body.model_dump())
    db.add(sched)
    db.commit()
    db.refresh(sched)
    return sched


@router.put("/schedules/{sched_id}", response_model=ScheduleResponse,
            dependencies=[Depends(require_permission("shift:manage"))])
def update_schedule(sched_id: int, body: ScheduleCreate, db: Session = Depends(get_db)):
    sched = db.query(EmployeeSchedule).filter(EmployeeSchedule.id == sched_id).first()
    if not sched:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(sched, k, v)
    db.commit()
    db.refresh(sched)
    return sched


# ─── HOLIDAY ENDPOINTS ────────────────────────────────────────────────────────

@router.get("/holidays", response_model=List[HolidayResponse],
            dependencies=[Depends(require_permission("shift:view_own"))])
def list_holidays(year: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Holiday)
    if year:
        from sqlalchemy import extract
        q = q.filter(extract("year", Holiday.date) == year)
    return q.order_by(Holiday.date).all()


@router.get("/holidays/check",
            dependencies=[Depends(require_permission("shift:view_own"))])
def check_holiday(check_date: date, dept_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Cek apakah tanggal adalah hari libur untuk departemen tertentu."""
    holidays = db.query(Holiday).filter(Holiday.date == check_date).all()
    for h in holidays:
        if h.applicable_dept_ids is None:
            return {"is_holiday": True, "holiday_name": h.holiday_name, "type": h.holiday_type}
        if dept_id and dept_id in (h.applicable_dept_ids or []):
            return {"is_holiday": True, "holiday_name": h.holiday_name, "type": h.holiday_type}
    return {"is_holiday": False}


@router.post("/holidays", response_model=HolidayResponse,
             dependencies=[Depends(require_permission("shift:manage"))])
def create_holiday(body: HolidayCreate, db: Session = Depends(get_db)):
    holiday = Holiday(**body.model_dump())
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/holidays/{holiday_id}",
               dependencies=[Depends(require_permission("shift:manage"))])
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    h = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not h:
        raise HTTPException(404, "Hari libur tidak ditemukan")
    db.delete(h)
    db.commit()
    return {"message": "Hari libur dihapus"}


@router.delete("/shifts/{shift_id}",
               dependencies=[Depends(require_permission("shift:manage"))])
def delete_shift(shift_id: int, db: Session = Depends(get_db)):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(404, "Shift tidak ditemukan")
    shift.is_active = False
    db.commit()
    return {"message": "Shift dinonaktifkan"}


@router.delete("/schedules/{sched_id}",
               dependencies=[Depends(require_permission("shift:manage"))])
def delete_schedule(sched_id: int, db: Session = Depends(get_db)):
    sched = db.query(EmployeeSchedule).filter(EmployeeSchedule.id == sched_id).first()
    if not sched:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    db.delete(sched)
    db.commit()
    return {"message": "Jadwal dihapus"}
