"""Tests for Shift & Schedule module (Module B)"""
import pytest
from datetime import date, timedelta


def test_create_shift(client, auth_headers):
    resp = client.post("/api/v2/shifts", json={
        "shift_code": "PAGI", "shift_name": "Shift Pagi",
        "start_time": "08:00", "end_time": "17:00",
        "grace_period_minutes": 15, "is_active": True,
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["shift_code"] == "PAGI"


def test_create_holiday(client, auth_headers):
    resp = client.post("/api/v2/holidays", json={
        "holiday_name": "Hari Kemerdekaan",
        "date": "2026-08-17",
        "holiday_type": "national",
    }, headers=auth_headers)
    assert resp.status_code == 200


def test_check_holiday_is_holiday(client, auth_headers):
    client.post("/api/v2/holidays", json={
        "holiday_name": "Test Holiday",
        "date": "2026-12-25",
        "holiday_type": "national",
    }, headers=auth_headers)
    resp = client.get("/api/v2/holidays/check?check_date=2026-12-25", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_holiday"] is True


def test_check_holiday_not_holiday(client, auth_headers):
    resp = client.get("/api/v2/holidays/check?check_date=2026-06-15", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_holiday"] is False


def test_active_schedule_not_found(client, auth_headers):
    resp = client.get("/api/v2/schedules/active?employee_id=NOEXIST", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() is None


def test_attendance_policy_creation(client, auth_headers):
    resp = client.post("/api/v2/master/attendance-policies", json={
        "policy_name": "Policy Default",
        "grace_period_minutes": 15,
        "min_work_hours_per_day": 4.0,
        "is_active": True,
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["grace_period_minutes"] == 15
