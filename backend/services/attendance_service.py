"""
Attendance Service - Business Logic
"""

from datetime import datetime, date, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import json

from models import Employee, Attendance, EmployeeSchedule, Shift, AttendancePolicy, Holiday


class AttendanceService:

    def get_active_shift(self, db: Session, employee_id: str, target_date: date = None) -> Optional[Shift]:
        """Dapatkan shift aktif untuk karyawan pada tanggal tertentu."""
        target = target_date or date.today()
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
        if schedule:
            return db.query(Shift).filter(Shift.id == schedule.shift_id, Shift.is_active == True).first()
        return None

    def get_applicable_policy(self, db: Session, employee_id: str) -> Optional[AttendancePolicy]:
        """Dapatkan kebijakan absensi yang berlaku untuk karyawan."""
        employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
        if not employee:
            return None
        dept_id = employee.department_id

        # Cari policy spesifik untuk departemen ini
        if dept_id:
            policies = db.query(AttendancePolicy).filter(AttendancePolicy.is_active == True).all()
            for p in policies:
                if p.applicable_dept_ids and dept_id in p.applicable_dept_ids:
                    return p

        # Fallback ke policy global (applicable_dept_ids = null)
        return db.query(AttendancePolicy).filter(
            AttendancePolicy.applicable_dept_ids == None,
            AttendancePolicy.is_active == True
        ).first()

    def is_holiday(self, db: Session, target_date: date, dept_id: Optional[int] = None) -> bool:
        """Cek apakah tanggal adalah hari libur."""
        holidays = db.query(Holiday).filter(Holiday.date == target_date).all()
        for h in holidays:
            if h.applicable_dept_ids is None:
                return True
            if dept_id and dept_id in (h.applicable_dept_ids or []):
                return True
        return False

    def record_attendance(self, db: Session, employee_id: str, method: str = "card+face") -> dict:
        """
        Catat absensi: check-in jika belum ada, check-out jika sudah check-in hari ini.
        Menggunakan shift aktif + policy jika tersedia, fallback ke legacy work_start/end.
        """
        employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
        today = date.today()
        now = datetime.now()

        existing = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date == today
        ).first()

        # Ambil shift aktif dan policy
        shift  = self.get_active_shift(db, employee_id, today)
        policy = self.get_applicable_policy(db, employee_id)

        grace_period = (
            shift.grace_period_minutes if shift else
            (policy.grace_period_minutes if policy else
             employee.late_tolerance)
        )
        min_work_hours = policy.min_work_hours_per_day if policy else 4.0

        if existing is None:
            # ── CHECK IN ─────────────────────────────────────────────────────
            if shift:
                work_start = self._parse_time(shift.start_time)
            else:
                work_start = self._parse_time(employee.work_start)

            start_with_grace = work_start.replace(
                minute=min(work_start.minute + grace_period, 59)
            )
            status = "present" if now <= start_with_grace else "late"

            record = Attendance(
                employee_id=employee_id,
                date=today,
                check_in=now,
                status=status,
                method=method,
                attendance_type=employee.attendance_type or "onsite",
            )
            db.add(record)
            db.commit()
            db.refresh(record)

            return {
                "action": "check_in",
                "time": now.strftime("%H:%M:%S"),
                "status": status
            }

        elif existing.check_out is None:
            # ── CHECK OUT ────────────────────────────────────────────────────
            existing.check_out = now
            duration = now - existing.check_in

            if duration.total_seconds() < min_work_hours * 3600:
                existing.status = "half_day"

            db.commit()
            return {
                "action": "check_out",
                "time": now.strftime("%H:%M:%S"),
                "duration": str(duration).split('.')[0]
            }

        else:
            return {
                "action": "already_out",
                "time": existing.check_out.strftime("%H:%M:%S"),
                "message": "Sudah absen pulang hari ini"
            }

    def calculate_overtime(self, db: Session, employee_id: str, target_date: date) -> Optional[int]:
        """
        Hitung menit overtime: selisih check_out vs shift end time.
        Returns None jika belum check-out atau tidak ada shift.
        """
        record = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date == target_date,
        ).first()
        if not record or not record.check_out:
            return None

        shift = self.get_active_shift(db, employee_id, target_date)
        if not shift:
            return None

        shift_end = self._parse_time(shift.end_time).replace(
            year=record.check_out.year,
            month=record.check_out.month,
            day=record.check_out.day,
        )
        if record.check_out > shift_end:
            return int((record.check_out - shift_end).total_seconds() / 60)
        return 0

    def get_stats(self, db: Session, start_date: Optional[str], end_date: Optional[str]) -> dict:
        """Statistik absensi"""
        today = date.today()

        # Total karyawan aktif
        total_employees = db.query(Employee).filter(Employee.is_active == True).count()

        # Absensi hari ini
        today_records = db.query(Attendance).filter(Attendance.date == today).all()
        present_today = len([r for r in today_records if r.status in ["present", "late"]])
        late_today = len([r for r in today_records if r.status == "late"])
        absent_today = total_employees - present_today

        # Data per hari (30 hari terakhir)
        thirty_days_ago = today - timedelta(days=30)
        daily_data = (
            db.query(
                Attendance.date,
                func.count(Attendance.id).label("present"),
                func.sum(func.cast(Attendance.status == "late", db.bind.dialect.type_descriptor(func.count().type))).label("late")
            )
            .filter(Attendance.date >= thirty_days_ago)
            .group_by(Attendance.date)
            .order_by(Attendance.date)
            .all()
        )

        # Department breakdown
        dept_stats = []
        departments = db.query(Employee.department).distinct().all()
        for dept_row in departments:
            dept = dept_row[0]
            dept_employees = db.query(Employee).filter(
                Employee.department == dept,
                Employee.is_active == True
            ).count()
            dept_present = db.query(Attendance).join(Employee).filter(
                Attendance.date == today,
                Employee.department == dept
            ).count()
            dept_stats.append({
                "department": dept,
                "total": dept_employees,
                "present": dept_present,
                "absent": dept_employees - dept_present
            })

        return {
            "today": {
                "total_employees": total_employees,
                "present": present_today,
                "absent": absent_today,
                "late": late_today,
                "on_time": present_today - late_today,
                "attendance_rate": round(present_today / total_employees * 100, 1) if total_employees > 0 else 0
            },
            "departments": dept_stats,
            "daily_trend": [
                {
                    "date": str(d.date),
                    "present": d.present,
                }
                for d in daily_data
            ]
        }

    def export_data(self, db: Session, start_date: str, end_date: str, format: str) -> list:
        """Export data absensi dalam rentang tanggal"""
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)

        records = (
            db.query(Attendance)
            .join(Employee)
            .filter(and_(Attendance.date >= start, Attendance.date <= end))
            .order_by(Attendance.date, Employee.name)
            .all()
        )

        data = []
        for r in records:
            duration = None
            if r.check_in and r.check_out:
                diff = r.check_out - r.check_in
                hours = diff.seconds // 3600
                minutes = (diff.seconds % 3600) // 60
                duration = f"{hours}j {minutes}m"

            data.append({
                "tanggal": str(r.date),
                "employee_id": r.employee_id,
                "nama": r.employee.name,
                "departemen": r.employee.department,
                "jabatan": r.employee.position or "-",
                "jam_masuk": r.check_in.strftime("%H:%M:%S") if r.check_in else "-",
                "jam_keluar": r.check_out.strftime("%H:%M:%S") if r.check_out else "-",
                "durasi": duration or "-",
                "status": r.status,
                "metode": r.method
            })

        return data

    def _parse_time(self, time_str: str) -> datetime:
        """Parse "HH:MM" string ke datetime object dengan tanggal hari ini"""
        h, m = map(int, time_str.split(":"))
        now = datetime.now()
        return now.replace(hour=h, minute=m, second=0, microsecond=0)
