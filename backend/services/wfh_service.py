"""
WFH Service — GPS validation, rule check, WFH attendance recording
"""

import math
from datetime import date, datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from models import WFHRule, WFHRequest, Employee, WorkLocation, Attendance, LeaveStatus, AttendanceTypeEnum


class WFHService:

    def haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Hitung jarak dua koordinat GPS dalam meter menggunakan Haversine formula."""
        R = 6_371_000  # meter
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        return 2 * R * math.asin(math.sqrt(a))

    def get_applicable_rule(self, db: Session, employee_id: str) -> Optional[WFHRule]:
        """Dapatkan aturan WFH yang berlaku untuk karyawan."""
        emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
        if not emp:
            return None
        rules = db.query(WFHRule).filter(WFHRule.is_active == True).all()
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

    def count_wfh_this_week(self, db: Session, employee_id: str, target_date: date) -> int:
        """Hitung berapa kali WFH minggu ini."""
        week_start = target_date - timedelta(days=target_date.weekday())
        week_end   = week_start + timedelta(days=6)
        return db.query(WFHRequest).filter(
            WFHRequest.employee_id == employee_id,
            WFHRequest.date >= week_start,
            WFHRequest.date <= week_end,
            WFHRequest.status == LeaveStatus.approved,
        ).count()

    def validate_gps(self, db: Session, employee_id: str, latitude: float, longitude: float, rule: Optional[WFHRule]) -> Tuple[bool, str]:
        """Validasi GPS karyawan terhadap lokasi kerja yang terdaftar."""
        emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
        if not emp or not emp.location_id:
            return True, "ok"  # tidak ada lokasi terdaftar = bypass

        location = db.query(WorkLocation).filter(WorkLocation.id == emp.location_id).first()
        if not location or not location.latitude or not location.longitude:
            return True, "ok"

        radius = (rule.gps_radius_override_meters if rule and rule.gps_radius_override_meters
                  else location.gps_radius_meters)

        distance = self.haversine_distance(latitude, longitude, location.latitude, location.longitude)
        if distance > radius:
            return False, f"Lokasi terlalu jauh dari kantor ({int(distance)}m, batas {radius}m)"
        return True, "ok"

    def checkin_wfh(
        self,
        db: Session,
        employee_id: str,
        image_base64: Optional[str],
        latitude: Optional[float],
        longitude: Optional[float],
    ) -> dict:
        """
        Pipeline WFH check-in:
        1. Cek aturan WFH berlaku
        2. Cek / auto-create WFH request
        3. GPS validation (jika required)
        4. Face selfie verification (jika required)
        5. Buat attendance record
        """
        from services.face_service import FaceService
        import base64
        import numpy as np

        today = date.today()
        emp = db.query(Employee).filter(Employee.employee_id == employee_id, Employee.is_active == True).first()
        if not emp:
            raise ValueError("Karyawan tidak ditemukan")

        rule = self.get_applicable_rule(db, employee_id)
        if rule and rule.max_wfh_days_per_week == 0:
            raise ValueError("WFH tidak diizinkan untuk posisi/departemen ini")

        # Cek / buat WFH request
        wfh_req = db.query(WFHRequest).filter(
            WFHRequest.employee_id == employee_id,
            WFHRequest.date == today,
            WFHRequest.status == LeaveStatus.approved,
        ).first()

        if not wfh_req:
            if rule and not rule.requires_manager_approval:
                # Auto-approve jika aturan mengizinkan
                if rule.max_wfh_days_per_week != 99:
                    weekly_count = self.count_wfh_this_week(db, employee_id, today)
                    if weekly_count >= rule.max_wfh_days_per_week:
                        raise ValueError(f"Kuota WFH minggu ini sudah habis ({rule.max_wfh_days_per_week} hari)")

                wfh_req = WFHRequest(
                    employee_id=employee_id,
                    date=today,
                    reason="Auto-approved via check-in",
                    status=LeaveStatus.approved,
                    approved_at=datetime.utcnow(),
                )
                db.add(wfh_req)
                db.flush()
            else:
                raise ValueError("Tidak ada permohonan WFH yang disetujui untuk hari ini")

        # GPS validation
        if rule and rule.require_gps_validation and latitude is not None and longitude is not None:
            gps_ok, gps_msg = self.validate_gps(db, employee_id, latitude, longitude, rule)
            if not gps_ok:
                raise ValueError(gps_msg)

        # Face verification
        if rule and rule.require_selfie and image_base64 and emp.face_encoding:
            try:
                image_data = base64.b64decode(image_base64.split(',')[-1])
                stored_encoding = np.frombuffer(emp.face_encoding, dtype=np.float64)
                face_svc = FaceService()
                is_match, confidence = face_svc.verify_face(image_data, stored_encoding)
                if not is_match:
                    raise ValueError(f"Wajah tidak cocok (confidence: {round(confidence, 3)})")
            except ValueError:
                raise
            except Exception as e:
                raise ValueError(f"Gagal verifikasi wajah: {str(e)}")

        # Buat atau update attendance
        existing = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date == today,
        ).first()
        now = datetime.now()

        if not existing:
            record = Attendance(
                employee_id=employee_id,
                date=today,
                check_in=now,
                status="present",
                method="wfh",
                attendance_type=AttendanceTypeEnum.wfh,
                wfh_request_id=wfh_req.id,
                gps_latitude=latitude,
                gps_longitude=longitude,
            )
            db.add(record)
            action = "check_in"
        elif existing.check_out is None:
            existing.check_out = now
            existing.attendance_type = AttendanceTypeEnum.wfh
            action = "check_out"
        else:
            db.commit()
            return {"action": "already_out", "time": existing.check_out.strftime("%H:%M:%S")}

        db.commit()
        return {"action": action, "time": now.strftime("%H:%M:%S"), "method": "wfh"}
