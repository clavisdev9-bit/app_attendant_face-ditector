"""Tests for Enhanced Reports module (Module H)"""
import pytest
from datetime import date


def test_department_summary_empty(client, auth_headers):
    today = date.today().isoformat()
    resp = client.get(f"/api/v2/reports/department-summary?start_date={today}&end_date={today}", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_leave_summary(client, auth_headers):
    resp = client.get("/api/v2/reports/leave-summary?year=2026", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_overtime_summary(client, auth_headers):
    today = date.today().isoformat()
    resp = client.get(f"/api/v2/reports/overtime-summary?start_date=2026-01-01&end_date={today}", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_payroll_export(client, auth_headers):
    resp = client.get("/api/v2/reports/payroll-export?start_date=2026-01-01&end_date=2026-01-31", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        row = data[0]
        assert "employee_id" in row
        assert "hari_hadir" in row
        assert "total_lembur_jam" in row


def test_payroll_export_missing_params(client, auth_headers):
    resp = client.get("/api/v2/reports/payroll-export", headers=auth_headers)
    assert resp.status_code == 422
