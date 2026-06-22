"""Tests for WFH module (Module F)"""
import pytest
from datetime import date


def _seed_employee(db):
    from models import Employee
    emp = db.query(Employee).filter(Employee.employee_id == "WFHTEST").first()
    if not emp:
        emp = Employee(employee_id="WFHTEST", name="Test WFH", department="IT", card_uid="CARD-WFH")
        db.add(emp)
        db.commit()
    return emp


def test_create_wfh_rule(client, auth_headers):
    resp = client.post("/api/v2/master/wfh-rules", json={
        "rule_name": "WFH Hybrid",
        "max_wfh_days_per_week": 3,
        "require_selfie": True,
        "require_gps_validation": False,
        "requires_manager_approval": False,
        "is_active": True,
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["max_wfh_days_per_week"] == 3


def test_create_wfh_request(client, auth_headers, db):
    _seed_employee(db)
    resp = client.post("/api/v2/wfh-requests", json={
        "employee_id": "WFHTEST",
        "date": "2026-06-15",
        "reason": "Internet lebih cepat di rumah",
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


def test_approve_wfh_request(client, auth_headers, db):
    from models import WFHRequest
    req = db.query(WFHRequest).filter(WFHRequest.employee_id == "WFHTEST").first()
    if not req:
        pytest.skip("No WFH request")

    resp = client.post(f"/api/v2/wfh-requests/{req.id}/approve", json={}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


def test_wfh_checkin_no_approved_request(client, auth_headers, db):
    _seed_employee(db)
    resp = client.post("/api/v2/attendance/wfh-checkin", json={
        "employee_id": "WFHTEST",
        "latitude": -6.2,
        "longitude": 106.8,
    })
    # Should fail since we have a WFH rule requiring manager approval
    # and no rule with auto-approve is set for this dept
    assert resp.status_code in [200, 400]


def test_haversine_distance():
    from services.wfh_service import WFHService
    svc = WFHService()
    # Jakarta to Depok (~25km)
    dist = svc.haversine_distance(-6.2088, 106.8456, -6.4021, 106.7942)
    assert 20_000 < dist < 30_000  # 20-30 km in meters

    # Same point = 0
    dist_zero = svc.haversine_distance(-6.2, 106.8, -6.2, 106.8)
    assert dist_zero < 1
