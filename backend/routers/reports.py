"""
Enhanced Reports Router — Department summary, Leave summary, Overtime summary, Payroll export
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional, List
from datetime import date, timedelta
import io

from database import get_db
from models import Employee, Attendance, Department, LeaveRequest, LeaveBalance, LeaveType, OvertimeRequest
from services.auth_service import require_permission

router = APIRouter(prefix="/api/v2/reports", tags=["Reports"])


@router.get("/department-summary",
            dependencies=[Depends(require_permission("report:all"))])
def department_summary(
    start_date: Optional[str] = None,
    end_date:   Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Ringkasan kehadiran per departemen."""
    today = date.today()
    start = date.fromisoformat(start_date) if start_date else today
    end   = date.fromisoformat(end_date)   if end_date   else today

    departments = db.query(Department).filter(Department.is_active == True).all()
    result = []
    for dept in departments:
        dept_employees = db.query(Employee).filter(
            Employee.department_id == dept.id,
            Employee.is_active == True,
        ).count()

        att_records = (
            db.query(Attendance)
            .join(Employee, Attendance.employee_id == Employee.employee_id)
            .filter(
                Employee.department_id == dept.id,
                Attendance.date >= start,
                Attendance.date <= end,
            )
            .all()
        )

        present = len([r for r in att_records if r.status in ("present", "late")])
        late    = len([r for r in att_records if r.status == "late"])
        leave   = len([r for r in att_records if r.status == "leave"])
        days    = (end - start).days + 1
        expected = dept_employees * days

        result.append({
            "department_id":   dept.id,
            "department_name": dept.dept_name,
            "total_employees": dept_employees,
            "present":         present,
            "late":            late,
            "leave":           leave,
            "absent":          max(0, expected - present - leave),
            "attendance_rate": round(present / expected * 100, 1) if expected > 0 else 0,
        })

    return result


@router.get("/leave-summary",
            dependencies=[Depends(require_permission("report:all"))])
def leave_summary(
    year:        Optional[int] = None,
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Ringkasan penggunaan cuti per karyawan."""
    target_year = year or date.today().year
    q = db.query(
        LeaveBalance.employee_id,
        LeaveType.leave_name,
        LeaveBalance.total_balance,
        LeaveBalance.carry_over_balance,
        LeaveBalance.used_balance,
    ).join(LeaveType, LeaveBalance.leave_type_id == LeaveType.id).filter(
        LeaveBalance.year == target_year,
    )
    if employee_id:
        q = q.filter(LeaveBalance.employee_id == employee_id)

    rows = q.all()
    result = {}
    for row in rows:
        emp_id = row.employee_id
        if emp_id not in result:
            result[emp_id] = {"employee_id": emp_id, "year": target_year, "leaves": []}
        available = row.total_balance + row.carry_over_balance - row.used_balance
        result[emp_id]["leaves"].append({
            "leave_type":          row.leave_name,
            "total_balance":       row.total_balance,
            "carry_over_balance":  row.carry_over_balance,
            "used_balance":        row.used_balance,
            "remaining_balance":   available,
        })

    return list(result.values())


@router.get("/overtime-summary",
            dependencies=[Depends(require_permission("report:all"))])
def overtime_summary(
    start_date:  Optional[str] = None,
    end_date:    Optional[str] = None,
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Ringkasan total lembur per karyawan."""
    today = date.today()
    first_day = today.replace(day=1)
    start = date.fromisoformat(start_date) if start_date else first_day
    end   = date.fromisoformat(end_date)   if end_date   else today

    q = db.query(
        OvertimeRequest.employee_id,
        func.sum(OvertimeRequest.actual_duration_minutes).label("total_actual"),
        func.sum(OvertimeRequest.planned_duration_minutes).label("total_planned"),
        func.count(OvertimeRequest.id).label("total_requests"),
    ).filter(
        OvertimeRequest.date >= start,
        OvertimeRequest.date <= end,
        OvertimeRequest.status == "completed",
    )
    if employee_id:
        q = q.filter(OvertimeRequest.employee_id == employee_id)

    rows = q.group_by(OvertimeRequest.employee_id).all()

    result = []
    for row in rows:
        emp = db.query(Employee).filter(Employee.employee_id == row.employee_id).first()
        result.append({
            "employee_id":             row.employee_id,
            "employee_name":           emp.name if emp else "-",
            "department":              emp.department if emp else "-",
            "total_requests":          row.total_requests,
            "total_planned_minutes":   row.total_planned or 0,
            "total_actual_minutes":    row.total_actual or 0,
            "total_actual_hours":      round((row.total_actual or 0) / 60, 2),
        })

    return result


@router.get("/payroll-export",
            dependencies=[Depends(require_permission("report:export"))])
def payroll_export(
    start_date: str,
    end_date:   str,
    db: Session = Depends(get_db),
):
    """Export data gabungan kehadiran + lembur + cuti untuk payroll."""
    start = date.fromisoformat(start_date)
    end   = date.fromisoformat(end_date)
    year  = start.year

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    result = []

    for emp in employees:
        # Kehadiran
        att_records = db.query(Attendance).filter(
            Attendance.employee_id == emp.employee_id,
            Attendance.date >= start,
            Attendance.date <= end,
        ).all()
        present_days = len([r for r in att_records if r.status in ("present", "late")])
        late_days    = len([r for r in att_records if r.status == "late"])
        leave_days   = len([r for r in att_records if r.status == "leave"])
        wfh_days     = len([r for r in att_records if r.method == "wfh"])

        # Lembur
        ot_records = db.query(OvertimeRequest).filter(
            OvertimeRequest.employee_id == emp.employee_id,
            OvertimeRequest.date >= start,
            OvertimeRequest.date <= end,
            OvertimeRequest.status == "completed",
        ).all()
        total_overtime_minutes = sum(r.actual_duration_minutes or 0 for r in ot_records)

        # Saldo cuti
        balances = db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == emp.employee_id,
            LeaveBalance.year == year,
        ).all()
        leave_used = sum(b.used_balance for b in balances)

        result.append({
            "employee_id":            emp.employee_id,
            "nama":                   emp.name,
            "departemen":             emp.department,
            "jabatan":                emp.position or "-",
            "employment_type":        emp.employment_type or "-",
            "hari_hadir":             present_days,
            "hari_terlambat":         late_days,
            "hari_wfh":               wfh_days,
            "hari_cuti":              leave_days,
            "total_lembur_menit":     total_overtime_minutes,
            "total_lembur_jam":       round(total_overtime_minutes / 60, 2),
            "saldo_cuti_terpakai":    leave_used,
        })

    return result
