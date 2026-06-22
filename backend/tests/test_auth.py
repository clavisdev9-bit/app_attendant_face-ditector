"""Tests for auth module (Module G)"""
import pytest


def test_login_success(client, admin_token):
    assert admin_token is not None
    assert len(admin_token) > 10


def test_login_wrong_password(client):
    resp = client.post(
        "/api/v2/auth/login",
        data={"username": "testadmin", "password": "wrongpassword"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 401


def test_get_me(client, auth_headers):
    resp = client.get("/api/v2/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testadmin"
    assert "permissions" in data
    assert len(data["permissions"]) > 0


def test_refresh_token(client, auth_headers):
    login_resp = client.post(
        "/api/v2/auth/login",
        data={"username": "testadmin", "password": "testpass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    refresh_token = login_resp.json()["refresh_token"]
    resp = client.post("/api/v2/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_protected_endpoint_without_token(client):
    resp = client.get("/api/v2/master/roles")
    assert resp.status_code == 401


def test_permission_enforcement(client, db):
    """User dengan role employee tidak dapat akses system:user_manage."""
    from models import Role, User
    from services.auth_service import hash_password

    emp_role = Role(role_code="employee_test", role_name="Employee Test", permissions=["attendance:read_own"])
    db.add(emp_role)
    db.flush()
    emp_user = User(username="empuser", hashed_password=hash_password("pass123"), role_id=emp_role.id, is_active=True)
    db.add(emp_user)
    db.commit()

    login = client.post(
        "/api/v2/auth/login",
        data={"username": "empuser", "password": "pass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = login.json()["access_token"]
    resp = client.get("/api/v2/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
