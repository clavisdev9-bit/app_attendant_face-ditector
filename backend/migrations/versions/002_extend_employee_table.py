"""Extend employee table with new FK columns (add_column only, never drop)

Revision ID: 002
Revises: 001
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employees", sa.Column("department_id",     sa.Integer, sa.ForeignKey("departments.id"), nullable=True))
    op.add_column("employees", sa.Column("position_id",       sa.Integer, sa.ForeignKey("job_positions.id"), nullable=True))
    op.add_column("employees", sa.Column("location_id",       sa.Integer, sa.ForeignKey("work_locations.id"), nullable=True))
    op.add_column("employees", sa.Column("direct_manager_id", sa.Integer, sa.ForeignKey("employees.id"), nullable=True))
    op.add_column("employees", sa.Column("employment_type",   sa.String(20), nullable=True))
    op.add_column("employees", sa.Column("attendance_type",   sa.String(20), nullable=True, server_default="onsite"))
    op.add_column("employees", sa.Column("profile_photo",     sa.String(255), nullable=True))


def downgrade() -> None:
    # Never drop columns to preserve data safety
    pass
