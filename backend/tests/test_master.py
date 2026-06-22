"""Tests for Master Data module (Module A)"""
import pytest


def test_create_department(client, auth_headers):
    resp = client.post("/api/v2/master/departments", json={
        "dept_code": "TECH", "dept_name": "Technology", "is_active": True
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["dept_code"] == "TECH"


def test_duplicate_dept_code(client, auth_headers):
    client.post("/api/v2/master/departments", json={"dept_code": "FIN", "dept_name": "Finance", "is_active": True}, headers=auth_headers)
    resp = client.post("/api/v2/master/departments", json={"dept_code": "FIN", "dept_name": "Finance2", "is_active": True}, headers=auth_headers)
    assert resp.status_code == 400


def test_list_departments(client, auth_headers):
    resp = client.get("/api/v2/master/departments", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_location(client, auth_headers):
    resp = client.post("/api/v2/master/locations", json={
        "location_code": "HQ01", "location_name": "Kantor Pusat",
        "latitude": -6.2, "longitude": 106.8, "gps_radius_meters": 150, "is_active": True
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["gps_radius_meters"] == 150


def test_create_position(client, auth_headers):
    resp = client.post("/api/v2/master/positions", json={
        "position_code": "SE01", "position_name": "Senior Engineer", "level": "L4", "is_active": True
    }, headers=auth_headers)
    assert resp.status_code == 200


def test_company_upsert(client, auth_headers):
    resp = client.put("/api/v2/master/company", json={
        "company_name": "PT Test Indonesia",
        "company_code": "PTTI",
        "timezone": "Asia/Jakarta",
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["company_name"] == "PT Test Indonesia"

    # Upsert again
    resp2 = client.put("/api/v2/master/company", json={
        "company_name": "PT Test Indonesia Updated",
        "company_code": "PTTI",
        "timezone": "Asia/Jakarta",
    }, headers=auth_headers)
    assert resp2.status_code == 200
    assert resp2.json()["company_name"] == "PT Test Indonesia Updated"
