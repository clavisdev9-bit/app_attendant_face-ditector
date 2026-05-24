"""
Attendance Service - Business Logic
"""

from datetime import datetime, date, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import json

from models import Employee, Attendance


class AttendanceService:

    def record_attendance(self, db: Session, employee_id: str) -> dict:
        """
        Catat absensi: check-in jika belum ada, check-out jika sudah check-in hari ini
        """
        employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
        today = date.today()
        now = datetime.now()

        existing = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date == today
        ).first()

        if existing is None:
            # ── CHECK IN ─────────────────────────────────────────────────────
            work_start = self._parse_time(employee.work_start)
            tolerance = employee.late_tolerance  # menit

            # Tentukan status
            if now.hour < work_start.hour or (
                now.hour == work_start.hour and
                now.minute <= work_start.minute + tolerance
            ):
                status = "present"
            else:
                status = "late"

            record = Attendance(
                employee_id=employee_id,
                date=today,
                check_in=now,
                status=status,
                method="card+face"
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
            work_end = self._parse_time(employee.work_end)

            # Update status ke half_day jika pulang terlalu cepat
            duration = now - existing.check_in
            if duration.total_seconds() < 4 * 3600:  # kurang dari 4 jam
                existing.status = "half_day"

            db.commit()
            return {
                "action": "check_out",
                "time": now.strftime("%H:%M:%S"),
                "duration": str(duration).split('.')[0]
            }

        else:
            # Sudah check-in dan check-out hari ini
            return {
                "action": "already_out",
                "time": existing.check_out.strftime("%H:%M:%S"),
                "message": "Sudah absen pulang hari ini"
            }

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
