"""
Database Models - SQLAlchemy ORM
"""

from sqlalchemy import Column, String, Boolean, LargeBinary, DateTime, Date, Float, Integer, ForeignKey, Text, JSON, Enum as SAEnum, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum
import os

# Use String instead of SAEnum for SQLite compatibility in tests
_USE_ENUM = os.getenv("DATABASE_URL", "").startswith("postgresql")
def _StrEnum(enum_class):
    """Returns SAEnum in production, String in test (SQLite)."""
    if _USE_ENUM:
        return SAEnum(enum_class)
    return String(30)


# ─── ENUMS ────────────────────────────────────────────────────────────────────

class EmploymentType(str, enum.Enum):
    permanent = "permanent"
    contract  = "contract"
    intern    = "intern"

class AttendanceTypeEnum(str, enum.Enum):
    onsite = "onsite"
    wfh    = "wfh"
    hybrid = "hybrid"

class HolidayType(str, enum.Enum):
    national         = "national"
    company          = "company"
    collective_leave = "collective_leave"

class LeaveStatus(str, enum.Enum):
    pending   = "pending"
    approved  = "approved"
    rejected  = "rejected"
    cancelled = "cancelled"

class OvertimeStatus(str, enum.Enum):
    pending   = "pending"
    approved  = "approved"
    rejected  = "rejected"
    completed = "completed"


class Employee(Base):
    __tablename__ = "employees"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    employee_id    = Column(String(20), unique=True, nullable=False, index=True)
    name           = Column(String(100), nullable=False)
    department     = Column(String(50), nullable=False)
    position       = Column(String(50))
    email          = Column(String(100))
    phone          = Column(String(20))
    card_uid       = Column(String(50), unique=True, nullable=False, index=True)
    face_encoding  = Column(LargeBinary, nullable=True)
    face_enrolled  = Column(Boolean, default=False)
    is_active      = Column(Boolean, default=True)
    join_date      = Column(Date, default=func.current_date())
    created_at     = Column(DateTime, default=func.now())
    updated_at     = Column(DateTime, default=func.now(), onupdate=func.now())

    # Work schedule (legacy — shift module supersedes these)
    work_start     = Column(String(5), default="08:00")
    work_end       = Column(String(5), default="17:00")
    late_tolerance = Column(Integer, default=15)

    # Module A extensions (nullable for backwards compatibility)
    department_id      = Column(Integer, ForeignKey("departments.id"), nullable=True)
    position_id        = Column(Integer, ForeignKey("job_positions.id"), nullable=True)
    location_id        = Column(Integer, ForeignKey("work_locations.id"), nullable=True)
    direct_manager_id  = Column(Integer, ForeignKey("employees.id"), nullable=True)
    employment_type    = Column(_StrEnum(EmploymentType), nullable=True)
    attendance_type    = Column(_StrEnum(AttendanceTypeEnum), nullable=True, default=AttendanceTypeEnum.onsite)
    profile_photo      = Column(String(255), nullable=True)

    attendances       = relationship("Attendance", back_populates="employee")
    card_scans        = relationship("CardScan", back_populates="employee")
    schedules         = relationship("EmployeeSchedule", back_populates="employee")
    leave_requests    = relationship("LeaveRequest", back_populates="employee", foreign_keys="LeaveRequest.employee_id")
    overtime_requests = relationship("OvertimeRequest", back_populates="employee")
    wfh_requests      = relationship("WFHRequest", back_populates="employee")
    user_account      = relationship("User", back_populates="employee", uselist=False)
    dept_ref          = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    position_ref      = relationship("JobPosition", back_populates="employees", foreign_keys=[position_id])


class Attendance(Base):
    __tablename__ = "attendance"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(String(20), ForeignKey("employees.employee_id"), nullable=False, index=True)
    date        = Column(Date, nullable=False, index=True)
    check_in    = Column(DateTime, nullable=True)
    check_out   = Column(DateTime, nullable=True)
    status      = Column(String(20), default="present")  # present, late, absent, half_day, leave
    method      = Column(String(20), default="card+face") # card+face, manual, wfh
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=func.now())

    # Module F extensions
    attendance_type = Column(_StrEnum(AttendanceTypeEnum), nullable=True, default=AttendanceTypeEnum.onsite)
    wfh_request_id  = Column(Integer, ForeignKey("wfh_requests.id"), nullable=True)
    gps_latitude    = Column(Float, nullable=True)
    gps_longitude   = Column(Float, nullable=True)

    employee    = relationship("Employee", back_populates="attendances")
    wfh_request = relationship("WFHRequest", foreign_keys=[wfh_request_id])


class CardScan(Base):
    __tablename__ = "card_scans"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(String(20), ForeignKey("employees.employee_id"), nullable=True)
    card_uid    = Column(String(50), nullable=False)
    scanned_at  = Column(DateTime, default=func.now())
    success     = Column(Boolean, default=True)

    employee = relationship("Employee", back_populates="card_scans")


# ─── MODULE A: MASTER DATA ────────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "company"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(200), nullable=False)
    company_code = Column(String(20), unique=True, nullable=False)
    address      = Column(Text, nullable=True)
    city         = Column(String(100), nullable=True)
    province     = Column(String(100), nullable=True)
    phone        = Column(String(30), nullable=True)
    npwp         = Column(String(30), nullable=True)
    logo_path    = Column(String(255), nullable=True)
    timezone     = Column(String(50), default="Asia/Jakarta")
    updated_at   = Column(DateTime, default=func.now(), onupdate=func.now())


class Department(Base):
    __tablename__ = "departments"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    dept_code       = Column(String(20), unique=True, nullable=False)
    dept_name       = Column(String(100), nullable=False)
    parent_dept_id  = Column(Integer, ForeignKey("departments.id"), nullable=True)
    head_employee_id = Column(String(20), ForeignKey("employees.employee_id"), nullable=True)
    location_id     = Column(Integer, ForeignKey("work_locations.id"), nullable=True)
    is_active       = Column(Boolean, default=True)

    children     = relationship("Department", back_populates="parent")
    parent       = relationship("Department", back_populates="children", remote_side=[id])
    positions    = relationship("JobPosition", back_populates="department")
    employees    = relationship("Employee", back_populates="dept_ref", foreign_keys="Employee.department_id")


class WorkLocation(Base):
    __tablename__ = "work_locations"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    location_code     = Column(String(20), unique=True, nullable=False)
    location_name     = Column(String(100), nullable=False)
    address           = Column(Text, nullable=True)
    latitude          = Column(Float, nullable=True)
    longitude         = Column(Float, nullable=True)
    gps_radius_meters = Column(Integer, default=100)
    is_active         = Column(Boolean, default=True)


class JobPosition(Base):
    __tablename__ = "job_positions"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    position_code = Column(String(20), unique=True, nullable=False)
    position_name = Column(String(100), nullable=False)
    level         = Column(String(20), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    is_active     = Column(Boolean, default=True)

    department = relationship("Department", back_populates="positions")
    employees  = relationship("Employee", back_populates="position_ref", foreign_keys="Employee.position_id")


# ─── MODULE B: SHIFT & SCHEDULE ───────────────────────────────────────────────

class Shift(Base):
    __tablename__ = "shifts"

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    shift_code           = Column(String(20), unique=True, nullable=False)
    shift_name           = Column(String(100), nullable=False)
    start_time           = Column(String(5), nullable=False)   # "HH:MM"
    end_time             = Column(String(5), nullable=False)
    break_start          = Column(String(5), nullable=True)
    break_end            = Column(String(5), nullable=True)
    total_work_minutes   = Column(Integer, nullable=True)
    grace_period_minutes = Column(Integer, default=15)
    crosses_midnight     = Column(Boolean, default=False)
    is_active            = Column(Boolean, default=True)

    schedules = relationship("EmployeeSchedule", back_populates="shift")


class EmployeeSchedule(Base):
    __tablename__ = "employee_schedules"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(String(20), ForeignKey("employees.employee_id"), nullable=False)
    shift_id    = Column(Integer, ForeignKey("shifts.id"), nullable=False)
    valid_from  = Column(Date, nullable=False)
    valid_to    = Column(Date, nullable=True)
    work_days   = Column(JSON, default=["MON", "TUE", "WED", "THU", "FRI"])
    notes       = Column(Text, nullable=True)

    employee = relationship("Employee", back_populates="schedules")
    shift    = relationship("Shift", back_populates="schedules")


class Holiday(Base):
    __tablename__ = "holidays"

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    holiday_name           = Column(String(100), nullable=False)
    date                   = Column(Date, nullable=False, index=True)
    holiday_type           = Column(_StrEnum(HolidayType), nullable=False)
    applicable_dept_ids    = Column(JSON, nullable=True)
    applicable_location_ids = Column(JSON, nullable=True)


# ─── MODULE E: ATTENDANCE POLICY ─────────────────────────────────────────────

class AttendancePolicy(Base):
    __tablename__ = "attendance_policies"

    id                           = Column(Integer, primary_key=True, autoincrement=True)
    policy_name                  = Column(String(100), nullable=False)
    applicable_dept_ids          = Column(JSON, nullable=True)
    grace_period_minutes         = Column(Integer, default=15)
    early_leave_tolerance_minutes = Column(Integer, default=0)
    min_work_hours_per_day       = Column(Float, default=4.0)
    auto_overtime                = Column(Boolean, default=False)
    max_auto_overtime_hours      = Column(Float, default=2.0)
    mark_absent_if_no_checkin    = Column(Boolean, default=False)
    notify_manager_if_absent     = Column(Boolean, default=False)
    is_active                    = Column(Boolean, default=True)


# ─── MODULE C: LEAVE MANAGEMENT ──────────────────────────────────────────────

class LeaveType(Base):
    __tablename__ = "leave_types"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    leave_code          = Column(String(20), unique=True, nullable=False)
    leave_name          = Column(String(100), nullable=False)
    initial_balance_days = Column(Integer, default=12)
    max_balance_days    = Column(Integer, default=24)
    min_advance_days    = Column(Integer, default=1)
    requires_document   = Column(Boolean, default=False)
    allow_half_day      = Column(Boolean, default=True)
    carry_over          = Column(Boolean, default=False)
    is_active           = Column(Boolean, default=True)

    balances = relationship("LeaveBalance", back_populates="leave_type")
    requests = relationship("LeaveRequest", back_populates="leave_type")


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    employee_id         = Column(String(20), ForeignKey("employees.employee_id"), nullable=False)
    leave_type_id       = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    year                = Column(Integer, nullable=False)
    total_balance       = Column(Float, default=0)
    carry_over_balance  = Column(Float, default=0)
    used_balance        = Column(Float, default=0)

    employee   = relationship("Employee")
    leave_type = relationship("LeaveType", back_populates="balances")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    employee_id   = Column(String(20), ForeignKey("employees.employee_id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    start_date    = Column(Date, nullable=False)
    end_date      = Column(Date, nullable=False)
    total_days    = Column(Float, nullable=False)
    is_half_day   = Column(Boolean, default=False)
    reason        = Column(Text, nullable=True)
    document_path = Column(String(255), nullable=True)
    status        = Column(_StrEnum(LeaveStatus), default=LeaveStatus.pending)
    approved_by   = Column(String(20), nullable=True)
    approved_at   = Column(DateTime, nullable=True)
    notes         = Column(Text, nullable=True)
    created_at    = Column(DateTime, default=func.now())

    employee   = relationship("Employee", back_populates="leave_requests", foreign_keys=[employee_id])
    leave_type = relationship("LeaveType", back_populates="requests")


class PermissionType(Base):
    __tablename__ = "permission_types"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    permission_code   = Column(String(20), unique=True, nullable=False)
    permission_name   = Column(String(100), nullable=False)
    max_days_per_year = Column(Integer, default=3)
    requires_approval = Column(Boolean, default=True)
    requires_document = Column(Boolean, default=False)
    is_active         = Column(Boolean, default=True)

    requests = relationship("PermissionRequest", back_populates="permission_type")


class PermissionRequest(Base):
    __tablename__ = "permission_requests"

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    employee_id        = Column(String(20), ForeignKey("employees.employee_id"), nullable=False)
    permission_type_id = Column(Integer, ForeignKey("permission_types.id"), nullable=False)
    start_date         = Column(Date, nullable=False)
    end_date           = Column(Date, nullable=False)
    total_days         = Column(Float, nullable=False)
    reason             = Column(Text, nullable=True)
    document_path      = Column(String(255), nullable=True)
    status             = Column(_StrEnum(LeaveStatus), default=LeaveStatus.pending)
    approved_by        = Column(String(20), nullable=True)
    approved_at        = Column(DateTime, nullable=True)
    notes              = Column(Text, nullable=True)
    created_at         = Column(DateTime, default=func.now())

    employee         = relationship("Employee")
    permission_type  = relationship("PermissionType", back_populates="requests")


# ─── MODULE D: OVERTIME ───────────────────────────────────────────────────────

class OvertimeRule(Base):
    __tablename__ = "overtime_rules"

    id                       = Column(Integer, primary_key=True, autoincrement=True)
    rule_name                = Column(String(100), nullable=False)
    applicable_dept_ids      = Column(JSON, nullable=True)
    applicable_position_ids  = Column(JSON, nullable=True)
    min_duration_minutes     = Column(Integer, default=30)
    max_daily_hours          = Column(Float, default=3.0)
    max_weekly_hours         = Column(Float, default=14.0)
    weekday_multiplier       = Column(Numeric(4, 2), default=1.5)
    holiday_multiplier       = Column(Numeric(4, 2), default=2.0)
    requires_pre_approval    = Column(Boolean, default=True)
    is_active                = Column(Boolean, default=True)


class OvertimeRequest(Base):
    __tablename__ = "overtime_requests"

    id                       = Column(Integer, primary_key=True, autoincrement=True)
    employee_id              = Column(String(20), ForeignKey("employees.employee_id"), nullable=False)
    date                     = Column(Date, nullable=False)
    planned_start            = Column(String(5), nullable=True)
    planned_end              = Column(String(5), nullable=True)
    planned_duration_minutes = Column(Integer, nullable=True)
    actual_start             = Column(DateTime, nullable=True)
    actual_end               = Column(DateTime, nullable=True)
    actual_duration_minutes  = Column(Integer, nullable=True)
    reason                   = Column(Text, nullable=True)
    status                   = Column(_StrEnum(OvertimeStatus), default=OvertimeStatus.pending)
    approved_by              = Column(String(20), nullable=True)
    created_at               = Column(DateTime, default=func.now())

    employee = relationship("Employee", back_populates="overtime_requests")


# ─── MODULE F: WFH ────────────────────────────────────────────────────────────

class WFHRule(Base):
    __tablename__ = "wfh_rules"

    id                          = Column(Integer, primary_key=True, autoincrement=True)
    rule_name                   = Column(String(100), nullable=False)
    applicable_dept_ids         = Column(JSON, nullable=True)
    applicable_position_ids     = Column(JSON, nullable=True)
    max_wfh_days_per_week       = Column(Integer, default=0)
    require_selfie              = Column(Boolean, default=True)
    require_gps_validation      = Column(Boolean, default=True)
    gps_radius_override_meters  = Column(Integer, nullable=True)
    requires_manager_approval   = Column(Boolean, default=True)
    is_active                   = Column(Boolean, default=True)


class WFHRequest(Base):
    __tablename__ = "wfh_requests"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(String(20), ForeignKey("employees.employee_id"), nullable=False)
    date        = Column(Date, nullable=False)
    reason      = Column(Text, nullable=True)
    status      = Column(_StrEnum(LeaveStatus), default=LeaveStatus.pending)
    approved_by = Column(String(20), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=func.now())

    employee     = relationship("Employee", back_populates="wfh_requests")
    attendances  = relationship("Attendance", back_populates="wfh_request", foreign_keys="Attendance.wfh_request_id")


# ─── MODULE G: RBAC & USER ───────────────────────────────────────────────────

class Role(Base):
    __tablename__ = "roles"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    role_code   = Column(String(30), unique=True, nullable=False)
    role_name   = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(JSON, default=list)

    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    employee_id     = Column(String(20), ForeignKey("employees.employee_id"), nullable=True)
    username        = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role_id         = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active       = Column(Boolean, default=True)
    last_login      = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=func.now())

    employee = relationship("Employee", back_populates="user_account")
    role     = relationship("Role", back_populates="users")
