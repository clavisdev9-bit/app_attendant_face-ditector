"""
Attendance System Backend - FastAPI
Sistem Absensi dengan Face Detection & RFID Card
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
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

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Attendance System API",
    description="Sistem Absensi dengan Face Detection & RFID",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    Step 2: Verifikasi wajah → catat absensi jika cocok
    """
    employee = db.query(Employee).filter(
        Employee.employee_id == request.employee_id,
        Employee.is_active == True
    ).first()

    if not employee or not employee.face_encoding:
        raise HTTPException(404, "Data karyawan tidak ditemukan")

    # Decode base64 image
    try:
        image_data = base64.b64decode(request.image_base64.split(',')[-1])
    except Exception:
        raise HTTPException(400, "Format gambar tidak valid")

    # Verify face
    stored_encoding = np.frombuffer(employee.face_encoding, dtype=np.float64)
    is_match, confidence = face_service.verify_face(image_data, stored_encoding)

    if not is_match:
        return {
            "status": "MISMATCH",
            "confidence": round(confidence, 3),
            "message": "Wajah tidak cocok, akses ditolak"
        }

    # Catat absensi
    result = attendance_service.record_attendance(db, employee.employee_id)

    return {
        "status": "SUCCESS",
        "confidence": round(confidence, 3),
        "action": result["action"],  # "check_in" atau "check_out"
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
