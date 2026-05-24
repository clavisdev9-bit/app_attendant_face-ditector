"""
Database Configuration - PostgreSQL
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Ganti dengan credentials PostgreSQL Anda
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/attendance_db"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # Reconnect jika koneksi putus
    pool_size=10,
    max_overflow=20,
    echo=False               # Set True untuk debug SQL queries
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency injection untuk database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
