"""
Pytest configuration — in-memory SQLite test database
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    # SQLite JSON workaround
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override SAEnum to use String for SQLite compatibility
from sqlalchemy import String
from sqlalchemy import event
from sqlalchemy.engine import Engine
import sqlite3

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token(client, db):
    """Seed super_admin role + user dan return JWT token."""
    from models import Role, User
    from services.auth_service import hash_password

    role = db.query(Role).filter(Role.role_code == "super_admin").first()
    if not role:
        role = Role(
            role_code="super_admin",
            role_name="Super Admin",
            permissions=[
                "attendance:read_all", "attendance:correct_all",
                "leave:manage", "leave:request", "leave:approve_all",
                "overtime:request", "overtime:approve_team",
                "shift:view_own", "shift:view_team", "shift:manage",
                "report:all", "report:team", "report:export",
                "master:view", "master:manage",
                "system:config", "system:audit_log", "system:user_manage",
            ],
        )
        db.add(role)
        db.flush()

    user = db.query(User).filter(User.username == "testadmin").first()
    if not user:
        user = User(
            username="testadmin",
            hashed_password=hash_password("testpass123"),
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        db.commit()

    resp = client.post(
        "/api/v2/auth/login",
        data={"username": "testadmin", "password": "testpass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
