"""Tests for Overtime module (Module D)"""
import pytest
from datetime import date


def _seed_employee(db):
    from models import Employee
    emp = db.query(Employee).filter(Employee.employee_id == "OTTEST").first()
    if not emp:
        emp = Employee(employee_id="OTTEST", name="Test OT", department="IT", card_uid="CARD-OT")
        db.add(emp)
        db.commit()
    return emp


def test_create_overtime_rule(client, auth_headers):
    resp = client.post("/api/v2/master/overtime-rules", json={
        "rule_name": "Rule Lembur Default",
        "min_duration_minutes": 30,
        "max_daily_hours": 3.0,
        "max_weekly_hours": 14.0,
        "weekday_multiplier": 1.5,
        "holiday_multiplier": 2.0,
        "requires_pre_approval": True,
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["rule_name"] == "Rule Lembur Default"


def test_create_overtime_request(client, auth_headers, db):
    _seed_employee(db)
    resp = client.post("/api/v2/overtime-requests", json={
        "employee_id": "OTTEST",
        "date": "2026-06-10",
        "planned_start": "17:00",
        "planned_end": "19:00",
        "planned_duration_minutes": 120,
        "reason": "Deadline project",
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


def test_overtime_max_hours_validation(client, auth_headers, db):
    _seed_employee(db)
    # 5 jam = 300 menit, melebihi max_daily_hours=3
    resp = client.post("/api/v2/overtime-requests", json={
        "employee_id": "OTTEST",
        "date": "2026-06-11",
        "planned_duration_minutes": 300,
        "reason": "Terlalu lama",
    }, headers=auth_headers)
    assert resp.status_code == 400
    assert "batas" in resp.json()["detail"].lower()


def test_approve_overtime(client, auth_headers, db):
    from models import OvertimeRequest
    req = db.query(OvertimeRequest).filter(OvertimeRequest.employee_id == "OTTEST", OvertimeRequest.status == "pending").first()
    if not req:
        pytest.skip("No pending OT request")

    resp = client.post(f"/api/v2/overtime-requests/{req.id}/approve", json={}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


def test_overtime_validation_logic():
    from services.overtime_service import OvertimeService
    svc = OvertimeService()
    # Unit test get_applicable_rule with mocked DB returns None
    # When no rule, validation should return 'ok'
    class FakeDB:
        def query(self, *a): return self
        def filter(self, *a): return self
        def all(self): return []
        def first(self): return None
    result = svc.validate_overtime_hours(FakeDB(), "ANYONE", 60, date(2026, 6, 10))
    assert result == "ok"
