"""
Pydantic Schemas - Request & Response Validation
"""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, date


# ─── EMPLOYEE ─────────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    employee_id:    str
    name:           str
    department:     str
    position:       Optional[str] = None
    email:          Optional[str] = None
    phone:          Optional[str] = None
    card_uid:       str
    work_start:     str = "08:00"
    work_end:       str = "17:00"
    late_tolerance: int = 15

    class Config:
        from_attributes = True


class EmployeeResponse(BaseModel):
    employee_id:   str
    name:          str
    department:    str
    position:      Optional[str]
    email:         Optional[str]
    phone:         Optional[str]
    card_uid:      str
    face_enrolled: bool
    is_active:     bool
    work_start:    str
    work_end:      str
    join_date:     Optional[date]

    class Config:
        from_attributes = True


# ─── ATTENDANCE ───────────────────────────────────────────────────────────────

class AttendanceResponse(BaseModel):
    id:          int
    employee_id: str
    date:        date
    check_in:    Optional[datetime]
    check_out:   Optional[datetime]
    status:      str
    method:      str

    class Config:
        from_attributes = True


class AttendanceStats(BaseModel):
    total_employees: int
    present_today:   int
    absent_today:    int
    late_today:      int
    on_time_today:   int


# ─── REQUESTS ────────────────────────────────────────────────────────────────

class CardScanRequest(BaseModel):
    card_uid: str


class FaceVerifyRequest(BaseModel):
    employee_id:  str
    image_base64: str   # base64 encoded image dari kamera
