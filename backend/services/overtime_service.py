"""
Overtime Service — business logic for overtime calculation & validation
"""

from datetime import date
from typing import Optional
from sqlalchemy.orm import Session

from models import Employee, OvertimeRule, OvertimeRequest, OvertimeStatus


class OvertimeService:

    def get_applicable_rule(self, db: Session, employee_id: str) -> Optional[OvertimeRule]:
        """Dapatkan aturan lembur yang berlaku untuk karyawan."""
        emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
        if not emp:
            return None

        rules = db.query(OvertimeRule).filter(OvertimeRule.is_active == True).all()
        for rule in rules:
            dept_ok = rule.applicable_dept_ids is None or (
                emp.department_id and emp.department_id in rule.applicable_dept_ids
            )
            pos_ok = rule.applicable_position_ids is None or (
                emp.position_id and emp.position_id in rule.applicable_position_ids
            )
            if dept_ok and pos_ok:
                return rule
        return None

    def validate_overtime_hours(self, db: Session, employee_id: str, planned_minutes: int, target_date: date) -> str:
        """
        Validasi apakah jam lembur melebihi batas rule.
        Returns: 'ok' | error message
        """
        rule = self.get_applicable_rule(db, employee_id)
        if not rule:
            return "ok"

        # Cek max daily hours
        if planned_minutes > rule.max_daily_hours * 60:
            return f"Melebihi batas lembur harian ({rule.max_daily_hours} jam)"

        # Cek max weekly hours
        from datetime import timedelta
        week_start = target_date - timedelta(days=target_date.weekday())
        week_end   = week_start + timedelta(days=6)
        weekly_requests = db.query(OvertimeRequest).filter(
            OvertimeRequest.employee_id == employee_id,
            OvertimeRequest.date >= week_start,
            OvertimeRequest.date <= week_end,
            OvertimeRequest.status.in_([OvertimeStatus.approved, OvertimeStatus.pending]),
        ).all()
        weekly_minutes = sum(r.planned_duration_minutes or 0 for r in weekly_requests)
        if weekly_minutes + planned_minutes > rule.max_weekly_hours * 60:
            remaining = rule.max_weekly_hours * 60 - weekly_minutes
            return f"Melebihi batas lembur mingguan. Sisa kuota: {int(remaining)} menit"

        return "ok"
