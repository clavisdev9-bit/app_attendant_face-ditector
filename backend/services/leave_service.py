"""
Leave Service — business logic for leave & permission requests
"""

from datetime import datetime, date
from typing import Optional
from sqlalchemy.orm import Session

from models import Employee, LeaveRequest, LeaveBalance, LeaveType, Attendance, LeaveStatus, PermissionRequest


class LeaveService:

    def calculate_working_days(self, start: date, end: date) -> float:
        """Hitung hari kerja antara dua tanggal (Mon-Fri)."""
        total = 0
        current = start
        while current <= end:
            if current.weekday() < 5:  # Mon=0 .. Fri=4
                total += 1
            from datetime import timedelta
            current += timedelta(days=1)
        return float(total)

    def get_balance(self, db: Session, employee_id: str, leave_type_id: int, year: int) -> Optional[LeaveBalance]:
        return db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.year == year,
        ).first()

    def approve_leave(self, db: Session, request_id: int, approved_by: str) -> LeaveRequest:
        """Setujui permohonan cuti, kurangi saldo, buat record absensi."""
        req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
        if not req:
            raise ValueError("Permohonan tidak ditemukan")
        if req.status != LeaveStatus.pending:
            raise ValueError(f"Permohonan sudah {req.status.value}")

        # Cek saldo
        balance = self.get_balance(db, req.employee_id, req.leave_type_id, req.start_date.year)
        if balance:
            available = balance.total_balance + balance.carry_over_balance - balance.used_balance
            if available < req.total_days:
                raise ValueError(f"Saldo cuti tidak cukup. Tersedia: {available}, Dibutuhkan: {req.total_days}")

        req.status     = LeaveStatus.approved
        req.approved_by = approved_by
        req.approved_at = datetime.utcnow()

        if balance:
            balance.used_balance += req.total_days

        # Buat record absensi untuk setiap hari cuti
        current = req.start_date
        from datetime import timedelta
        while current <= req.end_date:
            if current.weekday() < 5:
                existing = db.query(Attendance).filter(
                    Attendance.employee_id == req.employee_id,
                    Attendance.date == current,
                ).first()
                if not existing:
                    att = Attendance(
                        employee_id=req.employee_id,
                        date=current,
                        status="leave",
                        method="leave",
                        notes=f"Cuti disetujui oleh {approved_by}",
                    )
                    db.add(att)
            current += timedelta(days=1)

        db.commit()
        return req

    def generate_annual_balances(self, db: Session, year: int) -> int:
        """Generate saldo cuti tahunan untuk semua karyawan aktif."""
        from models import Employee
        employees  = db.query(Employee).filter(Employee.is_active == True).all()
        leave_types = db.query(LeaveType).filter(LeaveType.is_active == True).all()
        count = 0

        for emp in employees:
            for lt in leave_types:
                existing = self.get_balance(db, emp.employee_id, lt.id, year)
                if not existing:
                    # Carry over dari tahun sebelumnya jika diizinkan
                    carry_over = 0.0
                    if lt.carry_over:
                        prev = self.get_balance(db, emp.employee_id, lt.id, year - 1)
                        if prev:
                            carry_over = max(0, prev.total_balance + prev.carry_over_balance - prev.used_balance)
                            carry_over = min(carry_over, lt.max_balance_days)

                    bal = LeaveBalance(
                        employee_id=emp.employee_id,
                        leave_type_id=lt.id,
                        year=year,
                        total_balance=float(lt.initial_balance_days),
                        carry_over_balance=carry_over,
                        used_balance=0.0,
                    )
                    db.add(bal)
                    count += 1

        db.commit()
        return count
