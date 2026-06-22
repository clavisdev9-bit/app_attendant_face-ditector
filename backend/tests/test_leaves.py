"""Tests for Leave Management module (Module C)"""
import pytest
from datetime import date


def _seed_employee(db):
    from models import Employee
    emp = db.query(Employee).filter(Employee.employee_id == "LEAVETEST").first()
    if not emp:
        emp = Employee(employee_id="LEAVETEST", name="Test Cuti", department="HR", card_uid="CARD-LEAVE")
        db.add(emp)
        db.commit()
    return emp


def test_create_leave_type(client, auth_headers):
    resp = client.post("/api/v2/master/leave-types", json={
        "leave_code": "ANNUAL", "leave_name": "Cuti Tahunan",
        "initial_balance_days": 12, "max_balance_days": 24,
        "min_advance_days": 1, "carry_over": True, "is_active": True,
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["leave_code"] == "ANNUAL"


def test_generate_annual_balances(client, auth_headers, db):
    _seed_employee(db)
    resp = client.post("/api/v2/leave-balances/generate-annual?year=2026", headers=auth_headers)
    assert resp.status_code == 200
    assert "created" in resp.json()


def test_create_leave_request(client, auth_headers, db):
    _seed_employee(db)
    from models import LeaveType
    lt = db.query(LeaveType).filter(LeaveType.leave_code == "ANNUAL").first()
    if not lt:
        pytest.skip("Leave type ANNUAL not found")

    resp = client.post("/api/v2/leave-requests", json={
        "employee_id": "LEAVETEST",
        "leave_type_id": lt.id,
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "reason": "Liburan keluarga",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"
    assert data["total_days"] == 3.0


def test_approve_leave_request(client, auth_headers, db):
    from models import LeaveType, LeaveRequest
    lt = db.query(LeaveType).filter(LeaveType.leave_code == "ANNUAL").first()
    req = db.query(LeaveRequest).filter(LeaveRequest.employee_id == "LEAVETEST", LeaveRequest.status == "pending").first()
    if not req:
        pytest.skip("No pending leave request")

    resp = client.post(f"/api/v2/leave-requests/{req.id}/approve", json={"notes": "OK"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


def test_leave_working_days_calculation():
    from services.leave_service import LeaveService
    svc = LeaveService()
    # Monday to Friday = 5 days
    start = date(2026, 6, 1)  # Monday
    end   = date(2026, 6, 5)  # Friday
    assert svc.calculate_working_days(start, end) == 5.0

    # Monday to Sunday = 5 working days
    end2 = date(2026, 6, 7)
    assert svc.calculate_working_days(start, end2) == 5.0
