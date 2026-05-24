"""
Database Models - SQLAlchemy ORM
"""

from sqlalchemy import Column, String, Boolean, LargeBinary, DateTime, Date, Float, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Employee(Base):
    __tablename__ = "employees"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    employee_id    = Column(String(20), unique=True, nullable=False, index=True)
    name           = Column(String(100), nullable=False)
    department     = Column(String(50), nullable=False)
    position       = Column(String(50))
    email          = Column(String(100))
    phone          = Column(String(20))
    card_uid       = Column(String(50), unique=True, nullable=False, index=True)
    face_encoding  = Column(LargeBinary, nullable=True)   # numpy array bytes
    face_enrolled  = Column(Boolean, default=False)
    is_active      = Column(Boolean, default=True)
    join_date      = Column(Date, default=func.current_date())
    created_at     = Column(DateTime, default=func.now())
    updated_at     = Column(DateTime, default=func.now(), onupdate=func.now())

    # Work schedule
    work_start     = Column(String(5), default="08:00")   # "HH:MM"
    work_end       = Column(String(5), default="17:00")
    late_tolerance = Column(Integer, default=15)           # menit toleransi terlambat

    attendances    = relationship("Attendance", back_populates="employee")
    card_scans     = relationship("CardScan", back_populates="employee")


class Attendance(Base):
    __tablename__ = "attendance"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(String(20), ForeignKey("employees.employee_id"), nullable=False, index=True)
    date        = Column(Date, nullable=False, index=True)
    check_in    = Column(DateTime, nullable=True)
    check_out   = Column(DateTime, nullable=True)
    status      = Column(String(20), default="present")  # present, late, absent, half_day
    method      = Column(String(20), default="card+face") # card+face, manual
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=func.now())

    employee = relationship("Employee", back_populates="attendances")


class CardScan(Base):
    __tablename__ = "card_scans"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(String(20), ForeignKey("employees.employee_id"), nullable=True)
    card_uid    = Column(String(50), nullable=False)
    scanned_at  = Column(DateTime, default=func.now())
    success     = Column(Boolean, default=True)

    employee = relationship("Employee", back_populates="card_scans")
