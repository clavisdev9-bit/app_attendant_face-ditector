"""
Contractor Router — Skills, Projects, Settings, Holidays,
                    Overtime Approval, Payroll, Reports
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

from database import get_db
from models import (
    ContractorHoliday,
    ContractorPayroll,
    ContractorSettings,
    Employee,
    OvertimeRequest,
    OvertimeStatus,
    PayrollStatus,
    Project,
    SkillLevel,
)
from services.auth_service import require_permission, get_current_user
from services.contractor_service import (
    detect_day_type,
    generate_payroll,
    calculate_overtime,
)

router = APIRouter(prefix="/api/v2/contractor", tags=["Contractor"])


# ─── SCHEMAS ──────────────────────────────────────────────────────────────────

class SkillLevelCreate(BaseModel):
    skill_code:              str
    skill_name:              str
    daily_rate:              float
    overtime_rate_per_hour:  float
    weekend_rate_per_hour:   float = 0
    holiday_rate_per_hour:   float = 0
    is_active:               bool = True

class SkillLevelResponse(BaseModel):
    id:                      int
    skill_code:              str
    skill_name:              str
    daily_rate:              float
    overtime_rate_per_hour:  float
    weekend_rate_per_hour:   float
    holiday_rate_per_hour:   float
    is_active:               bool
    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    project_code: str
    project_name: str
    description:  Optional[str] = None
    location:     Optional[str] = None
    start_date:   Optional[date] = None
    end_date:     Optional[date] = None
    is_active:    bool = True

class ProjectResponse(BaseModel):
    id:           int
    project_code: str
    project_name: str
    description:  Optional[str]
    location:     Optional[str]
    start_date:   Optional[date]
    end_date:     Optional[date]
    is_active:    bool
    class Config:
        from_attributes = True


class ContractorSettingsCreate(BaseModel):
    work_start:               str   = "09:00"
    work_end:                 str   = "18:00"
    overtime_start:           str   = "19:00"
    max_overtime_time:        str   = "22:00"
    meal_allowance_amount:    float = 25000
    meal_allowance_threshold: str   = "22:00"
    weekday_ot_multiplier:    float = 1.0
    weekend_ot_multiplier:    float = 1.5
    holiday_ot_multiplier:    float = 2.0
    max_weekend_ot_hours:     float = 8.0
    meal_weekend_min_hours:   float = 4.0

class ContractorSettingsResponse(BaseModel):
    id:                       int
    project_id:               int
    work_start:               str
    work_end:                 str
    overtime_start:           str
    max_overtime_time:        str
    meal_allowance_amount:    float
    meal_allowance_threshold: str
    weekday_ot_multiplier:    float
    weekend_ot_multiplier:    float
    holiday_ot_multiplier:    float
    max_weekend_ot_hours:     float
    meal_weekend_min_hours:   float
    class Config:
        from_attributes = True


class HolidayCreate(BaseModel):
    date:                   date
    name:                   str
    holiday_type:           str = "national"   # national | company
    applicable_project_ids: Optional[List[int]] = None

class HolidayResponse(BaseModel):
    id:                     int
    date:                   date
    name:                   str
    holiday_type:           str
    applicable_project_ids: Optional[list]
    class Config:
        from_attributes = True


class OvertimeApprovalAction(BaseModel):
    notes: Optional[str] = None

class OvertimeRequestResponse(BaseModel):
    id:                      int
    employee_id:             str
    employee_name:           Optional[str] = None
    date:                    date
    day_type:                Optional[str] = "workday"
    planned_start:           Optional[str]
    planned_end:             Optional[str]
    actual_duration_minutes: Optional[int]
    reason:                  Optional[str]
    reject_reason:           Optional[str] = None
    status:                  str
    approved_by:             Optional[str]
    created_at:              datetime
    class Config:
        from_attributes = True


class PayrollGenerateRequest(BaseModel):
    employee_ids: Optional[List[str]] = None
    project_id:   int
    period_month: int
    period_year:  int

class PayrollResponse(BaseModel):
    id:                     int
    employee_id:            str
    employee_name:          Optional[str] = None
    project_id:             int
    period_month:           int
    period_year:            int
    work_days:              int
    weekend_attendance_days: int
    holiday_attendance_days: int
    base_salary:            float
    weekday_ot_hours:       float
    weekday_ot_amount:      float
    weekend_ot_hours:       float
    weekend_ot_amount:      float
    holiday_ot_hours:       float
    holiday_ot_amount:      float
    overtime_hours:         float
    overtime_amount:        float
    meal_allowance_days:    int
    meal_allowance_amount:  float
    deductions:             float
    total_salary:           float
    status:                 str
    notes:                  Optional[str]
    generated_at:           datetime
    finalized_at:           Optional[datetime]
    finalized_by:           Optional[str]
    class Config:
        from_attributes = True


# ─── SKILL LEVELS ─────────────────────────────────────────────────────────────

@router.get("/skills", response_model=List[SkillLevelResponse])
def list_skills(db: Session = Depends(get_db), _=Depends(require_permission("contractor:read"))):
    return db.query(SkillLevel).order_by(SkillLevel.skill_name).all()


@router.post("/skills", response_model=SkillLevelResponse)
def create_skill(
    data: SkillLevelCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    if db.query(SkillLevel).filter(SkillLevel.skill_code == data.skill_code).first():
        raise HTTPException(400, f"Skill code '{data.skill_code}' already exists.")
    skill = SkillLevel(**data.model_dump())
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@router.put("/skills/{skill_id}", response_model=SkillLevelResponse)
def update_skill(
    skill_id: int,
    data: SkillLevelCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    skill = db.get(SkillLevel, skill_id)
    if not skill:
        raise HTTPException(404, "Skill level not found.")
    for k, v in data.model_dump().items():
        setattr(skill, k, v)
    db.commit()
    db.refresh(skill)
    return skill


@router.delete("/skills/{skill_id}")
def delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    skill = db.get(SkillLevel, skill_id)
    if not skill:
        raise HTTPException(404, "Skill level not found.")
    db.delete(skill)
    db.commit()
    return {"message": "Deleted."}


# ─── PROJECTS ─────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db), _=Depends(require_permission("contractor:read"))):
    return db.query(Project).order_by(Project.project_name).all()


@router.post("/projects", response_model=ProjectResponse)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    if db.query(Project).filter(Project.project_code == data.project_code).first():
        raise HTTPException(400, f"Project code '{data.project_code}' already exists.")
    project = Project(**data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
    for k, v in data.model_dump().items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return project


# ─── CONTRACTOR SETTINGS ──────────────────────────────────────────────────────

@router.get("/settings/{project_id}", response_model=ContractorSettingsResponse)
def get_settings(
    project_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:read")),
):
    s = db.query(ContractorSettings).filter(ContractorSettings.project_id == project_id).first()
    if not s:
        raise HTTPException(404, "Settings not found for this project.")
    return s


@router.put("/settings/{project_id}", response_model=ContractorSettingsResponse)
def upsert_settings(
    project_id: int,
    data: ContractorSettingsCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found.")
    s = db.query(ContractorSettings).filter(ContractorSettings.project_id == project_id).first()
    if s:
        for k, v in data.model_dump().items():
            setattr(s, k, v)
    else:
        s = ContractorSettings(project_id=project_id, **data.model_dump())
        db.add(s)
    db.commit()
    db.refresh(s)
    return s


# ─── HOLIDAYS ─────────────────────────────────────────────────────────────────

@router.get("/holidays", response_model=List[HolidayResponse])
def list_holidays(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:read")),
):
    q = db.query(ContractorHoliday)
    if year:
        q = q.filter(ContractorHoliday.date >= date(year, 1, 1),
                     ContractorHoliday.date <= date(year, 12, 31))
    return q.order_by(ContractorHoliday.date).all()


@router.post("/holidays", response_model=HolidayResponse)
def create_holiday(
    data: HolidayCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    h = ContractorHoliday(**data.model_dump())
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.put("/holidays/{holiday_id}", response_model=HolidayResponse)
def update_holiday(
    holiday_id: int,
    data: HolidayCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    h = db.get(ContractorHoliday, holiday_id)
    if not h:
        raise HTTPException(404, "Holiday not found.")
    for k, v in data.model_dump().items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    h = db.get(ContractorHoliday, holiday_id)
    if not h:
        raise HTTPException(404, "Holiday not found.")
    db.delete(h)
    db.commit()
    return {"message": "Deleted."}


@router.post("/holidays/bulk-import")
def bulk_import_holidays(
    holidays: List[HolidayCreate],
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:write")),
):
    """Import multiple holidays at once. Skips duplicates by date."""
    created = 0
    skipped = 0
    for item in holidays:
        existing = db.query(ContractorHoliday).filter(
            ContractorHoliday.date == item.date
        ).first()
        if existing:
            skipped += 1
            continue
        db.add(ContractorHoliday(**item.model_dump()))
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped}


@router.get("/day-type")
def get_day_type(
    check_date: date,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:read")),
):
    """Return the day type for a given date (workday/saturday/sunday/holiday)."""
    day = detect_day_type(db, check_date, project_id)
    return {"date": str(check_date), "day_type": day,
            "weekday_name": check_date.strftime("%A")}


# ─── OVERTIME APPROVAL ────────────────────────────────────────────────────────

DAY_TYPE_LABEL = {
    "workday":  "Hari Kerja",
    "saturday": "Sabtu",
    "sunday":   "Minggu",
    "holiday":  "Hari Libur",
}

def _ot_to_response(r: OvertimeRequest, db: Session) -> OvertimeRequestResponse:
    emp = db.query(Employee).filter(Employee.employee_id == r.employee_id).first()
    return OvertimeRequestResponse(
        **{c.name: getattr(r, c.name) for c in r.__table__.columns},
        employee_name=emp.name if emp else None,
    )


@router.get("/overtime/pending", response_model=List[OvertimeRequestResponse])
def list_pending_overtime(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:overtime_approve")),
):
    q = (
        db.query(OvertimeRequest)
        .join(Employee, OvertimeRequest.employee_id == Employee.employee_id)
        .filter(OvertimeRequest.status == OvertimeStatus.pending,
                Employee.is_contractor == True)
    )
    if project_id:
        q = q.filter(Employee.project_id == project_id)
    return [_ot_to_response(r, db) for r in q.order_by(OvertimeRequest.date.desc()).all()]


@router.get("/overtime/history", response_model=List[OvertimeRequestResponse])
def list_overtime_history(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:overtime_approve")),
):
    q = (
        db.query(OvertimeRequest)
        .join(Employee, OvertimeRequest.employee_id == Employee.employee_id)
        .filter(Employee.is_contractor == True)
    )
    if project_id:
        q = q.filter(Employee.project_id == project_id)
    if status:
        q = q.filter(OvertimeRequest.status == status)
    return [_ot_to_response(r, db) for r in q.order_by(OvertimeRequest.date.desc()).limit(300).all()]


@router.post("/overtime/{ot_id}/approve")
def approve_overtime(
    ot_id: int,
    data: OvertimeApprovalAction,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("contractor:overtime_approve")),
):
    ot = db.get(OvertimeRequest, ot_id)
    if not ot:
        raise HTTPException(404, "Overtime request not found.")
    if ot.status != OvertimeStatus.pending:
        raise HTTPException(400, f"Cannot approve — status is '{ot.status}'.")
    ot.status      = OvertimeStatus.approved
    ot.approved_by = current_user.username
    if data.notes:
        ot.reason = (ot.reason or "") + f"\n[Leader: {data.notes}]"
    db.commit()
    return {"message": "Approved.", "overtime_id": ot_id,
            "day_type": ot.day_type}


@router.post("/overtime/{ot_id}/reject")
def reject_overtime(
    ot_id: int,
    data: OvertimeApprovalAction,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("contractor:overtime_approve")),
):
    ot = db.get(OvertimeRequest, ot_id)
    if not ot:
        raise HTTPException(404, "Overtime request not found.")
    if ot.status != OvertimeStatus.pending:
        raise HTTPException(400, f"Cannot reject — status is '{ot.status}'.")
    ot.status        = OvertimeStatus.rejected
    ot.approved_by   = current_user.username
    ot.reject_reason = data.notes or ""
    db.commit()
    return {"message": "Rejected.", "overtime_id": ot_id}


# ─── PAYROLL ──────────────────────────────────────────────────────────────────

def _payroll_to_response(p: ContractorPayroll, db: Session) -> PayrollResponse:
    emp = db.query(Employee).filter(Employee.employee_id == p.employee_id).first()
    d = {}
    for c in p.__table__.columns:
        v = getattr(p, c.name)
        d[c.name] = float(v) if isinstance(v, Decimal) else v
    d["employee_name"] = emp.name if emp else None
    return PayrollResponse(**d)


@router.post("/payroll/generate", response_model=List[PayrollResponse])
def generate_payroll_batch(
    data: PayrollGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("contractor:payroll")),
):
    q = db.query(Employee).filter(
        Employee.is_contractor == True,
        Employee.project_id    == data.project_id,
        Employee.is_active     == True,
    )
    if data.employee_ids:
        q = q.filter(Employee.employee_id.in_(data.employee_ids))
    employees = q.all()
    if not employees:
        raise HTTPException(404, "No active contractors found for this project.")

    results, errors = [], []
    for emp in employees:
        try:
            p = generate_payroll(db, emp, data.period_month, data.period_year,
                                 current_user.username)
            results.append(p)
        except ValueError as e:
            errors.append({"employee_id": emp.employee_id, "error": str(e)})

    if errors and not results:
        raise HTTPException(400, detail=errors)

    return [_payroll_to_response(p, db) for p in results]


@router.get("/payroll", response_model=List[PayrollResponse])
def list_payroll(
    project_id:   int,
    period_month: int,
    period_year:  int,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:payroll")),
):
    rows = (
        db.query(ContractorPayroll)
        .filter(
            ContractorPayroll.project_id   == project_id,
            ContractorPayroll.period_month == period_month,
            ContractorPayroll.period_year  == period_year,
        )
        .order_by(ContractorPayroll.employee_id)
        .all()
    )
    return [_payroll_to_response(p, db) for p in rows]


@router.post("/payroll/{payroll_id}/finalize")
def finalize_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("contractor:payroll")),
):
    p = db.get(ContractorPayroll, payroll_id)
    if not p:
        raise HTTPException(404, "Payroll record not found.")
    if p.status == PayrollStatus.finalized:
        raise HTTPException(400, "Payroll already finalized.")
    p.status       = PayrollStatus.finalized
    p.finalized_at = datetime.now()
    p.finalized_by = current_user.username
    db.commit()
    return {"message": "Payroll finalized.", "payroll_id": payroll_id}


# ─── REPORTS ──────────────────────────────────────────────────────────────────

def _period_bounds(period_month: int, period_year: int):
    from datetime import timedelta
    start = date(period_year, period_month, 1)
    end   = (date(period_year, period_month + 1, 1) if period_month < 12
             else date(period_year + 1, 1, 1)) - timedelta(days=1)
    return start, end


@router.get("/reports/attendance")
def report_attendance(
    project_id:   int,
    period_month: int,
    period_year:  int,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:read")),
):
    from models import Attendance as Att
    start, end = _period_bounds(period_month, period_year)

    employees = db.query(Employee).filter(
        Employee.is_contractor == True,
        Employee.project_id    == project_id,
    ).all()

    result = []
    for emp in employees:
        recs = db.query(Att).filter(
            Att.employee_id == emp.employee_id,
            Att.date >= start, Att.date <= end,
        ).all()
        present   = sum(1 for r in recs if r.status in ("present", "late"))
        late      = sum(1 for r in recs if r.status == "late")
        absent    = sum(1 for r in recs if r.status == "absent")
        workday_p = sum(1 for r in recs if r.status in ("present", "late")
                        and detect_day_type(db, r.date, project_id) == "workday")
        weekend_p = sum(1 for r in recs if r.status in ("present", "late")
                        and detect_day_type(db, r.date, project_id) in ("saturday", "sunday"))
        holiday_p = sum(1 for r in recs if r.status in ("present", "late")
                        and detect_day_type(db, r.date, project_id) == "holiday")
        work_min  = sum(
            int((r.check_out - r.check_in).total_seconds() / 60)
            for r in recs if r.check_in and r.check_out
        )
        result.append({
            "employee_id":        emp.employee_id,
            "employee_name":      emp.name,
            "skill":              emp.skill_level.skill_name if emp.skill_level else None,
            "total_present":      present,
            "workday_present":    workday_p,
            "weekend_present":    weekend_p,
            "holiday_present":    holiday_p,
            "late_days":          late,
            "absent_days":        absent,
            "total_work_hours":   round(work_min / 60, 2),
        })
    return {"period": f"{period_year}-{period_month:02d}", "data": result}


@router.get("/reports/overtime")
def report_overtime(
    project_id:   int,
    period_month: int,
    period_year:  int,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:read")),
):
    start, end = _period_bounds(period_month, period_year)
    employees  = db.query(Employee).filter(
        Employee.is_contractor == True,
        Employee.project_id    == project_id,
    ).all()
    emp_map = {e.employee_id: e for e in employees}
    emp_ids = list(emp_map.keys())

    ot_rows = db.query(OvertimeRequest).filter(
        OvertimeRequest.employee_id.in_(emp_ids),
        OvertimeRequest.date >= start,
        OvertimeRequest.date <= end,
    ).order_by(OvertimeRequest.date).all()

    data = []
    for ot in ot_rows:
        emp = emp_map.get(ot.employee_id)
        data.append({
            "employee_id":   ot.employee_id,
            "employee_name": emp.name if emp else None,
            "date":          str(ot.date),
            "day_type":      ot.day_type or "workday",
            "ot_start":      ot.planned_start,
            "ot_end":        ot.actual_end.strftime("%H:%M") if ot.actual_end else None,
            "total_hours":   round((ot.actual_duration_minutes or 0) / 60, 2),
            "status":        ot.status,
            "approved_by":   ot.approved_by,
            "reject_reason": ot.reject_reason,
        })
    return {"period": f"{period_year}-{period_month:02d}", "data": data}


@router.get("/reports/payroll")
def report_payroll(
    project_id:   int,
    period_month: int,
    period_year:  int,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:payroll")),
):
    rows = db.query(ContractorPayroll).filter(
        ContractorPayroll.project_id   == project_id,
        ContractorPayroll.period_month == period_month,
        ContractorPayroll.period_year  == period_year,
    ).all()

    data   = []
    totals = {k: 0 for k in ["base_salary", "weekday_ot_amount", "weekend_ot_amount",
                               "holiday_ot_amount", "overtime_amount",
                               "meal_allowance_amount", "total_salary"]}
    for p in rows:
        emp = db.query(Employee).filter(Employee.employee_id == p.employee_id).first()
        row = {
            "employee_id":           p.employee_id,
            "employee_name":         emp.name if emp else None,
            "skill":                 emp.skill_level.skill_name if emp and emp.skill_level else None,
            "work_days":             p.work_days,
            "weekend_days":          p.weekend_attendance_days,
            "holiday_days":          p.holiday_attendance_days,
            "base_salary":           float(p.base_salary),
            "weekday_ot_hours":      float(p.weekday_ot_hours),
            "weekday_ot_amount":     float(p.weekday_ot_amount),
            "weekend_ot_hours":      float(p.weekend_ot_hours),
            "weekend_ot_amount":     float(p.weekend_ot_amount),
            "holiday_ot_hours":      float(p.holiday_ot_hours),
            "holiday_ot_amount":     float(p.holiday_ot_amount),
            "overtime_hours":        float(p.overtime_hours),
            "overtime_amount":       float(p.overtime_amount),
            "meal_allowance_days":   p.meal_allowance_days,
            "meal_allowance_amount": float(p.meal_allowance_amount),
            "deductions":            float(p.deductions),
            "total_salary":          float(p.total_salary),
            "status":                p.status,
        }
        data.append(row)
        for k in totals:
            totals[k] += row.get(k, 0)

    return {
        "period":     f"{period_year}-{period_month:02d}",
        "project_id": project_id,
        "data":       data,
        "totals":     totals,
    }


@router.get("/reports/productivity")
def report_productivity(
    project_id:   int,
    period_month: int,
    period_year:  int,
    db: Session = Depends(get_db),
    _=Depends(require_permission("contractor:read")),
):
    from models import Attendance as Att
    start, end = _period_bounds(period_month, period_year)

    employees = db.query(Employee).filter(
        Employee.is_contractor == True,
        Employee.project_id    == project_id,
    ).all()

    result = []
    for emp in employees:
        recs = db.query(Att).filter(
            Att.employee_id == emp.employee_id,
            Att.date >= start, Att.date <= end,
            Att.status.in_(["present", "late"]),
        ).all()
        work_min = sum(
            int((r.check_out - r.check_in).total_seconds() / 60)
            for r in recs if r.check_in and r.check_out
        )
        ot_recs = db.query(OvertimeRequest).filter(
            OvertimeRequest.employee_id == emp.employee_id,
            OvertimeRequest.date >= start,
            OvertimeRequest.date <= end,
            OvertimeRequest.status == OvertimeStatus.approved,
        ).all()
        ot_min = sum(r.actual_duration_minutes or 0 for r in ot_recs)

        payroll = db.query(ContractorPayroll).filter(
            ContractorPayroll.employee_id  == emp.employee_id,
            ContractorPayroll.period_month == period_month,
            ContractorPayroll.period_year  == period_year,
        ).first()

        result.append({
            "employee_id":    emp.employee_id,
            "employee_name":  emp.name,
            "skill":          emp.skill_level.skill_name if emp.skill_level else None,
            "work_hours":     round(work_min / 60, 2),
            "overtime_hours": round(ot_min / 60, 2),
            "labor_cost":     float(payroll.total_salary) if payroll else 0,
        })
    return {"period": f"{period_year}-{period_month:02d}", "data": result}
