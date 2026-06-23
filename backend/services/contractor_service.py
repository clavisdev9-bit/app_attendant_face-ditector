"""
Business logic for contractor overtime calculation and payroll generation.

Day-type priority (highest first):
  HOLIDAY  → date exists in contractor_holidays for this project
  SUNDAY   → weekday() == 6
  SATURDAY → weekday() == 5
  WORKDAY  → everything else

Overtime rules by day type:
  WORKDAY  : grace 18:00–19:00 not counted; OT = overtime_start → min(checkout, max_overtime_time)
  SATURDAY : all worked hours = OT; capped at max_weekend_ot_hours; multiplier = weekend_ot_multiplier
  SUNDAY   : same as SATURDAY; multiplier = holiday_ot_multiplier
  HOLIDAY  : same as SATURDAY; multiplier = holiday_ot_multiplier
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from models import (
    Attendance,
    ContractorHoliday,
    ContractorPayroll,
    ContractorSettings,
    Employee,
    OvertimeRequest,
    OvertimeStatus,
    PayrollStatus,
    SkillLevel,
)

DAY_WORKDAY  = "workday"
DAY_SATURDAY = "saturday"
DAY_SUNDAY   = "sunday"
DAY_HOLIDAY  = "holiday"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_hhmm(value: str) -> time:
    h, m = value.split(":")
    return time(int(h), int(m))


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _minutes_to_hours(minutes: int) -> Decimal:
    return Decimal(str(round(minutes / 60, 2)))


# ─── Day Type Detection ────────────────────────────────────────────────────────

def detect_day_type(db: Session, target_date: date, project_id: Optional[int]) -> str:
    """
    Returns 'holiday' | 'sunday' | 'saturday' | 'workday'.
    Holiday check applies when applicable_project_ids is NULL (global)
    or contains this project_id.
    """
    holidays = db.query(ContractorHoliday).filter(
        ContractorHoliday.date == target_date
    ).all()

    for h in holidays:
        if h.applicable_project_ids is None:
            return DAY_HOLIDAY
        if project_id and project_id in (h.applicable_project_ids or []):
            return DAY_HOLIDAY

    wd = target_date.weekday()  # 0=Mon … 5=Sat, 6=Sun
    if wd == 6:
        return DAY_SUNDAY
    if wd == 5:
        return DAY_SATURDAY
    return DAY_WORKDAY


# ─── Overtime Calculation ─────────────────────────────────────────────────────

def calculate_overtime(
    checkout_time: datetime,
    checkin_time: datetime,
    day_type: str,
    settings: ContractorSettings,
) -> Tuple[Decimal, bool]:
    """
    Returns (overtime_hours, meal_allowance_eligible).

    WORKDAY:
      - Grace period work_end → overtime_start is NOT counted.
      - OT = overtime_start → min(checkout, max_overtime_time).
      - Meal if checkout >= meal_allowance_threshold.

    SATURDAY / SUNDAY / HOLIDAY:
      - All worked hours are OT, capped at max_weekend_ot_hours.
      - Meal if total_hours >= meal_weekend_min_hours.
    """
    if day_type == DAY_WORKDAY:
        ot_start = _parse_hhmm(settings.overtime_start)
        ot_max   = _parse_hhmm(settings.max_overtime_time)
        meal_thr = _parse_hhmm(settings.meal_allowance_threshold)

        checkout_t = checkout_time.time()
        ot_start_m = _time_to_minutes(ot_start)
        ot_max_m   = _time_to_minutes(ot_max)
        checkout_m = _time_to_minutes(checkout_t)
        meal_thr_m = _time_to_minutes(meal_thr)

        if checkout_m <= ot_start_m:
            return Decimal("0.00"), False

        effective_end = min(checkout_m, ot_max_m)
        ot_minutes    = max(0, effective_end - ot_start_m)
        ot_hours      = _minutes_to_hours(ot_minutes)
        meal_eligible = checkout_m >= meal_thr_m
        return ot_hours, meal_eligible

    else:
        # SATURDAY / SUNDAY / HOLIDAY: all worked hours = OT
        duration_minutes = int((checkout_time - checkin_time).total_seconds() / 60)
        if duration_minutes <= 0:
            return Decimal("0.00"), False
        max_minutes      = int(float(settings.max_weekend_ot_hours) * 60)
        ot_minutes       = min(duration_minutes, max_minutes)
        ot_hours         = _minutes_to_hours(ot_minutes)

        worked_hours     = duration_minutes / 60
        meal_eligible    = worked_hours >= float(settings.meal_weekend_min_hours)
        return ot_hours, meal_eligible


def get_ot_rate_and_multiplier(
    day_type: str,
    skill: SkillLevel,
    settings: ContractorSettings,
) -> Tuple[Decimal, Decimal]:
    """Returns (rate_per_hour, multiplier) for the given day_type."""
    if day_type == DAY_WORKDAY:
        return Decimal(str(skill.overtime_rate_per_hour)), Decimal(str(settings.weekday_ot_multiplier))
    elif day_type == DAY_SATURDAY:
        return Decimal(str(skill.weekend_rate_per_hour)), Decimal(str(settings.weekend_ot_multiplier))
    else:  # SUNDAY or HOLIDAY
        return Decimal(str(skill.holiday_rate_per_hour)), Decimal(str(settings.holiday_ot_multiplier))


# ─── Auto-create OT Request after check-out ───────────────────────────────────

def auto_create_overtime_request(
    db: Session,
    attendance: Attendance,
    settings: ContractorSettings,
) -> Optional[OvertimeRequest]:
    """
    Called after check-out. Detects day type, calculates OT hours,
    creates a pending OvertimeRequest if OT > 0.
    Skips if a request already exists for the same employee+date.
    """
    try:
        if not attendance.check_out or not attendance.check_in:
            return None

        # Find project_id from employee
        from models import Employee as Emp
        emp = db.query(Emp).filter(Emp.employee_id == attendance.employee_id).first()
        project_id = emp.project_id if emp else None

        day_type = detect_day_type(db, attendance.date, project_id)

        ot_hours, _ = calculate_overtime(
            attendance.check_out,
            attendance.check_in,
            day_type,
            settings,
        )

        if ot_hours <= 0:
            return None

        already = db.query(OvertimeRequest).filter(
            OvertimeRequest.employee_id == attendance.employee_id,
            OvertimeRequest.date        == attendance.date,
        ).first()
        if already:
            # Update day_type if missing
            if not already.day_type:
                already.day_type = day_type
                db.commit()
            return already

        ot_minutes = int(ot_hours * 60)

        if day_type == DAY_WORKDAY:
            ot_start_dt = attendance.check_out.replace(
                hour   = int(settings.overtime_start.split(":")[0]),
                minute = int(settings.overtime_start.split(":")[1]),
                second = 0,
            )
        else:
            ot_start_dt = attendance.check_in

        req = OvertimeRequest(
            employee_id              = attendance.employee_id,
            date                     = attendance.date,
            day_type                 = day_type,
            planned_start            = ot_start_dt.strftime("%H:%M"),
            planned_end              = attendance.check_out.strftime("%H:%M"),
            planned_duration_minutes = ot_minutes,
            actual_start             = ot_start_dt,
            actual_end               = attendance.check_out,
            actual_duration_minutes  = ot_minutes,
            reason                   = f"Auto-generated [{day_type}]",
            status                   = OvertimeStatus.pending,
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return req
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"auto_create_overtime_request failed: {e}", exc_info=True)
        return None


# ─── Payroll Generation ────────────────────────────────────────────────────────

def generate_payroll(
    db: Session,
    employee: Employee,
    period_month: int,
    period_year: int,
    generated_by: str,
) -> ContractorPayroll:
    """
    Generate (or regenerate) a draft payroll for one contractor.
    Groups overtime into workday / weekend / holiday buckets.
    Only approved overtime requests are counted.
    """
    if not employee.is_contractor:
        raise ValueError(f"Employee {employee.employee_id} is not a contractor.")
    if not employee.project_id:
        raise ValueError(f"Employee {employee.employee_id} has no project assigned.")
    if not employee.skill_level_id:
        raise ValueError(f"Employee {employee.employee_id} has no skill level assigned.")

    skill: SkillLevel = db.get(SkillLevel, employee.skill_level_id)
    settings: Optional[ContractorSettings] = (
        db.query(ContractorSettings)
        .filter(ContractorSettings.project_id == employee.project_id)
        .first()
    )
    if not settings:
        raise ValueError(f"No contractor_settings for project_id={employee.project_id}.")

    # Period bounds
    period_start = date(period_year, period_month, 1)
    if period_month == 12:
        period_end = date(period_year + 1, 1, 1) - timedelta(days=1)
    else:
        period_end = date(period_year, period_month + 1, 1) - timedelta(days=1)

    # ── Attendance: count workdays and weekend/holiday presence ──────────────
    attendances = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.employee_id,
            Attendance.date >= period_start,
            Attendance.date <= period_end,
            Attendance.status.in_(["present", "late"]),
        )
        .all()
    )

    work_days               = 0
    weekend_attendance_days = 0
    holiday_attendance_days = 0
    meal_days               = 0

    for att in attendances:
        dt = detect_day_type(db, att.date, employee.project_id)
        if dt == DAY_WORKDAY:
            work_days += 1
        elif dt in (DAY_SATURDAY, DAY_SUNDAY):
            weekend_attendance_days += 1
        elif dt == DAY_HOLIDAY:
            holiday_attendance_days += 1

        # Meal allowance count
        if att.check_in and att.check_out:
            _, meal_ok = calculate_overtime(att.check_out, att.check_in, dt, settings)
            if meal_ok:
                meal_days += 1

    base_salary = Decimal(str(skill.daily_rate)) * work_days

    # ── Approved overtime: group by day_type ─────────────────────────────────
    approved_ot = (
        db.query(OvertimeRequest)
        .filter(
            OvertimeRequest.employee_id == employee.employee_id,
            OvertimeRequest.date >= period_start,
            OvertimeRequest.date <= period_end,
            OvertimeRequest.status == OvertimeStatus.approved,
        )
        .all()
    )

    weekday_ot_hours = Decimal("0.00")
    weekend_ot_hours = Decimal("0.00")
    holiday_ot_hours = Decimal("0.00")

    for ot in approved_ot:
        hours = _minutes_to_hours(ot.actual_duration_minutes or 0)
        dt    = ot.day_type or DAY_WORKDAY
        if dt == DAY_WORKDAY:
            weekday_ot_hours += hours
        elif dt in (DAY_SATURDAY, DAY_SUNDAY):
            weekend_ot_hours += hours
        elif dt == DAY_HOLIDAY:
            holiday_ot_hours += hours

    # ── OT amounts ───────────────────────────────────────────────────────────
    wd_rate, wd_mult  = get_ot_rate_and_multiplier(DAY_WORKDAY,  skill, settings)
    we_rate, we_mult  = get_ot_rate_and_multiplier(DAY_SATURDAY, skill, settings)
    hol_rate, hol_mult = get_ot_rate_and_multiplier(DAY_HOLIDAY,  skill, settings)

    weekday_ot_amount = weekday_ot_hours * wd_rate  * wd_mult
    weekend_ot_amount = weekend_ot_hours * we_rate  * we_mult
    holiday_ot_amount = holiday_ot_hours * hol_rate * hol_mult

    total_ot_hours  = weekday_ot_hours + weekend_ot_hours + holiday_ot_hours
    total_ot_amount = weekday_ot_amount + weekend_ot_amount + holiday_ot_amount

    meal_amount = Decimal(str(settings.meal_allowance_amount)) * meal_days

    total = base_salary + total_ot_amount + meal_amount

    # ── Upsert: delete existing draft before insert ───────────────────────────
    existing = (
        db.query(ContractorPayroll)
        .filter(
            ContractorPayroll.employee_id  == employee.employee_id,
            ContractorPayroll.period_month == period_month,
            ContractorPayroll.period_year  == period_year,
            ContractorPayroll.status       == PayrollStatus.draft,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    payroll = ContractorPayroll(
        employee_id             = employee.employee_id,
        project_id              = employee.project_id,
        period_month            = period_month,
        period_year             = period_year,
        work_days               = work_days,
        weekend_attendance_days = weekend_attendance_days,
        holiday_attendance_days = holiday_attendance_days,
        base_salary             = base_salary,
        weekday_ot_hours        = weekday_ot_hours,
        weekday_ot_amount       = weekday_ot_amount,
        weekend_ot_hours        = weekend_ot_hours,
        weekend_ot_amount       = weekend_ot_amount,
        holiday_ot_hours        = holiday_ot_hours,
        holiday_ot_amount       = holiday_ot_amount,
        overtime_hours          = total_ot_hours,
        overtime_amount         = total_ot_amount,
        meal_allowance_days     = meal_days,
        meal_allowance_amount   = meal_amount,
        deductions              = Decimal("0.00"),
        total_salary            = total,
        status                  = PayrollStatus.draft,
    )
    db.add(payroll)
    db.commit()
    db.refresh(payroll)
    return payroll
