"""
Attendance System Backend - FastAPI
Sistem Absensi dengan Face Detection & RFID Card
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Body
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from datetime import datetime, date, timedelta
from typing import Optional, List
import base64
import numpy as np
import io

from database import get_db, engine
from models import Base, Employee, Attendance, CardScan
from schemas import (
    EmployeeCreate, EmployeeResponse,
    AttendanceResponse, AttendanceStats,
    CardScanRequest, FaceVerifyRequest
)
from services.face_service import FaceService
from services.attendance_service import AttendanceService
import models

# ── New v2 routers ────────────────────────────────────────────────────────────
from routers import auth, users, master, shifts, policies, leaves, overtime, wfh, reports

# Create tables (all models registered via models.py import chain)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Attendance System API",
    description="Sistem Absensi dengan Face Detection & RFID",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount v2 routers ──────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(master.router)
app.include_router(shifts.router)
app.include_router(policies.router)
app.include_router(leaves.router)
app.include_router(overtime.router)
app.include_router(wfh.router)
app.include_router(reports.router)

face_service = FaceService()
attendance_service = AttendanceService()


# ─── EMPLOYEE ENDPOINTS ────────────────────────────────────────────────────────

@app.post("/api/employees", response_model=EmployeeResponse)
async def create_employee(employee: EmployeeCreate, db=Depends(get_db)):
    """Daftarkan karyawan baru"""
    existing = db.query(Employee).filter(
        (Employee.employee_id == employee.employee_id) |
        (Employee.card_uid == employee.card_uid)
    ).first()
    if existing:
        raise HTTPException(400, "Karyawan atau kartu sudah terdaftar")

    db_employee = Employee(**employee.dict())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


@app.post("/api/employees/{employee_id}/enroll-face")
async def enroll_face(
    employee_id: str,
    file: UploadFile = File(...),
    db=Depends(get_db)
):
    """Daftarkan wajah karyawan"""
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(404, "Karyawan tidak ditemukan")

    image_data = await file.read()
    encoding = face_service.encode_face(image_data)

    if encoding is None:
        raise HTTPException(400, "Wajah tidak terdeteksi, coba foto dengan pencahayaan lebih baik")

    # Check for duplicate biometric — reject if face too similar to another employee
    try:
        import face_recognition as fr
        import numpy as np
        others = db.query(Employee).filter(
            Employee.face_enrolled == True,
            Employee.is_active == True,
            Employee.employee_id != employee_id,
            Employee.face_encoding != None,
        ).all()
        for other in others:
            stored = np.frombuffer(other.face_encoding, dtype=np.float64)
            dist = fr.face_distance([stored], encoding)[0]
            if dist < face_service.tolerance:
                raise HTTPException(
                    400,
                    f"Wajah ini sudah terdaftar untuk karyawan {other.employee_id} ({other.name}). "
                    f"Setiap karyawan harus menggunakan wajah yang berbeda."
                )
    except HTTPException:
        raise
    except Exception:
        pass  # face_recognition not available — skip duplicate check

    employee.face_encoding = encoding.tobytes()
    employee.face_enrolled = True
    db.commit()
    return {"message": "Wajah berhasil didaftarkan", "employee_id": employee_id}


@app.get("/api/employees", response_model=List[EmployeeResponse])
async def list_employees(
    department: Optional[str] = None,
    db=Depends(get_db)
):
    """Daftar semua karyawan"""
    query = db.query(Employee).filter(Employee.is_active == True)
    if department:
        query = query.filter(Employee.department == department)
    return query.all()


@app.get("/api/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(employee_id: str, db=Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(404, "Karyawan tidak ditemukan")
    return employee


@app.put("/api/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: str, data: dict = Body(...), db=Depends(get_db)):
    emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Karyawan tidak ditemukan")
    allowed = ["name", "department", "position", "email", "phone", "card_uid",
               "work_start", "work_end", "late_tolerance", "is_active"]
    for k, v in data.items():
        if k in allowed and v is not None:
            setattr(emp, k, v)
    db.commit()
    db.refresh(emp)
    return emp


@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: str, db=Depends(get_db)):
    emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Karyawan tidak ditemukan")

    # Nullify nullable FK references pointing to this employee
    db.query(models.User).filter(models.User.employee_id == employee_id).update(
        {"employee_id": None}, synchronize_session=False
    )
    db.query(models.Department).filter(models.Department.head_employee_id == employee_id).update(
        {"head_employee_id": None}, synchronize_session=False
    )
    db.query(Employee).filter(Employee.direct_manager_id == emp.id).update(
        {"direct_manager_id": None}, synchronize_session=False
    )

    # Delete all dependent records (order respects FK constraints)
    # contractor_payroll — tabel dari contractor module (mungkin belum ada jika migrasi belum dijalankan)
    # Pakai savepoint agar kegagalan di sini tidak membatalkan seluruh transaksi
    sp = db.begin_nested()
    try:
        db.execute(text("DELETE FROM contractor_payroll WHERE employee_id = :eid"), {"eid": employee_id})
        sp.commit()
    except Exception:
        sp.rollback()
    db.query(Attendance).filter(Attendance.employee_id == employee_id).delete(synchronize_session=False)
    db.query(models.WFHRequest).filter(models.WFHRequest.employee_id == employee_id).delete(synchronize_session=False)
    db.query(models.OvertimeRequest).filter(models.OvertimeRequest.employee_id == employee_id).delete(synchronize_session=False)
    db.query(models.LeaveRequest).filter(models.LeaveRequest.employee_id == employee_id).delete(synchronize_session=False)
    db.query(models.PermissionRequest).filter(models.PermissionRequest.employee_id == employee_id).delete(synchronize_session=False)
    db.query(models.LeaveBalance).filter(models.LeaveBalance.employee_id == employee_id).delete(synchronize_session=False)
    db.query(models.EmployeeSchedule).filter(models.EmployeeSchedule.employee_id == employee_id).delete(synchronize_session=False)
    db.query(CardScan).filter(CardScan.employee_id == employee_id).delete(synchronize_session=False)

    db.delete(emp)
    db.commit()
    return {"message": "Karyawan berhasil dihapus permanen"}


# ─── ABSENSI ENDPOINTS ────────────────────────────────────────────────────────

@app.post("/api/attendance/card-scan")
async def card_scan(request: CardScanRequest, db=Depends(get_db)):
    """
    Step 1: Scan kartu RFID → return employee info untuk verifikasi wajah
    """
    employee = db.query(Employee).filter(
        Employee.card_uid == request.card_uid,
        Employee.is_active == True
    ).first()

    if not employee:
        return {"status": "NOT_FOUND", "message": "Kartu tidak terdaftar"}

    if not employee.face_enrolled:
        return {"status": "NO_FACE", "message": "Wajah belum didaftarkan, hubungi admin"}

    # Log card scan
    scan = CardScan(
        employee_id=employee.employee_id,
        card_uid=request.card_uid,
        scanned_at=datetime.now()
    )
    db.add(scan)
    db.commit()

    return {
        "status": "OK",
        "employee_id": employee.employee_id,
        "name": employee.name,
        "department": employee.department,
        "message": "Kartu valid, silakan lihat kamera untuk verifikasi wajah"
    }


@app.post("/api/attendance/verify-face")
async def verify_face(request: FaceVerifyRequest, db=Depends(get_db)):
    """
    Step 2: Verifikasi wajah → catat absensi jika cocok.
    Includes cross-check: live face must NOT match any other enrolled employee.
    """
    employee = db.query(Employee).filter(
        Employee.employee_id == request.employee_id,
        Employee.is_active == True
    ).first()

    if not employee or not employee.face_encoding:
        raise HTTPException(404, "Data karyawan tidak ditemukan")

    try:
        image_data = base64.b64decode(request.image_base64.split(',')[-1])
    except Exception:
        raise HTTPException(400, "Format gambar tidak valid")

    # Encode live face once
    live_encoding = face_service.encode_face(image_data)
    if live_encoding is None:
        return {
            "status": "MISMATCH",
            "confidence": 1.0,
            "message": "Wajah tidak terdeteksi, posisikan ulang di depan kamera"
        }

    # Step A: compare against the intended employee
    stored_encoding = np.frombuffer(employee.face_encoding, dtype=np.float64)
    is_match, confidence = face_service.compare_encodings(live_encoding, stored_encoding)

    if not is_match:
        return {
            "status": "MISMATCH",
            "confidence": round(confidence, 3),
            "message": "Wajah tidak cocok, akses ditolak"
        }

    # Step B: cross-check — live face must NOT also match another employee
    other_employees = (
        db.query(Employee)
        .filter(
            Employee.face_enrolled == True,
            Employee.is_active == True,
            Employee.employee_id != request.employee_id,
            Employee.face_encoding != None,
        )
        .all()
    )
    conflict_id = face_service.find_conflicting_employee(live_encoding, other_employees)
    if conflict_id:
        return {
            "status": "MISMATCH",
            "confidence": round(confidence, 3),
            "message": (
                f"Wajah cocok dengan lebih dari satu akun ({conflict_id}). "
                "Hubungi admin untuk re-enroll biometrik."
            )
        }

    # All checks passed — record attendance
    result = attendance_service.record_attendance(db, employee.employee_id)

    return {
        "status": "SUCCESS",
        "confidence": round(confidence, 3),
        "action": result["action"],
        "time": result["time"],
        "employee_name": employee.name,
        "message": f"{'Masuk' if result['action'] == 'check_in' else 'Pulang'} berhasil dicatat"
    }


@app.get("/api/attendance/today")
async def get_today_attendance(db=Depends(get_db)):
    """Absensi hari ini"""
    today = date.today()
    records = db.query(Attendance).filter(
        Attendance.date == today
    ).join(Employee).all()

    return [
        {
            "employee_id": r.employee_id,
            "name": r.employee.name,
            "department": r.employee.department,
            "check_in": r.check_in.strftime("%H:%M:%S") if r.check_in else None,
            "check_out": r.check_out.strftime("%H:%M:%S") if r.check_out else None,
            "status": r.status,
            "duration": str(r.check_out - r.check_in) if r.check_in and r.check_out else None
        }
        for r in records
    ]


@app.get("/api/attendance/stats")
async def get_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db=Depends(get_db)
):
    """Statistik absensi"""
    return attendance_service.get_stats(db, start_date, end_date)


@app.get("/api/attendance/export")
async def export_attendance(
    start_date: str,
    end_date: str,
    format: str = "json",
    db=Depends(get_db)
):
    """Export data absensi"""
    return attendance_service.export_data(db, start_date, end_date, format)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
