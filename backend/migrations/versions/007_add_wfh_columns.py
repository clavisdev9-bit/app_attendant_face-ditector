"""Add WFH tables and extend attendance table

Revision ID: 007
Revises: 006
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wfh_rules",
        sa.Column("id",                         sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("rule_name",                  sa.String(100), nullable=False),
        sa.Column("applicable_dept_ids",        sa.JSON, nullable=True),
        sa.Column("applicable_position_ids",    sa.JSON, nullable=True),
        sa.Column("max_wfh_days_per_week",      sa.Integer, server_default="0"),
        sa.Column("require_selfie",             sa.Boolean, server_default="true"),
        sa.Column("require_gps_validation",     sa.Boolean, server_default="true"),
        sa.Column("gps_radius_override_meters", sa.Integer, nullable=True),
        sa.Column("requires_manager_approval",  sa.Boolean, server_default="true"),
        sa.Column("is_active",                  sa.Boolean, server_default="true"),
    )

    op.create_table(
        "wfh_requests",
        sa.Column("id",          sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("employee_id", sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("date",        sa.Date, nullable=False),
        sa.Column("reason",      sa.Text, nullable=True),
        sa.Column("status",      sa.String(20), server_default="pending"),
        sa.Column("approved_by", sa.String(20), nullable=True),
        sa.Column("approved_at", sa.DateTime, nullable=True),
        sa.Column("created_at",  sa.DateTime, server_default=sa.func.now()),
    )

    # Extend attendance table (add_column only)
    op.add_column("attendance", sa.Column("attendance_type", sa.String(20), nullable=True, server_default="onsite"))
    op.add_column("attendance", sa.Column("wfh_request_id",  sa.Integer, sa.ForeignKey("wfh_requests.id"), nullable=True))
    op.add_column("attendance", sa.Column("gps_latitude",    sa.Float, nullable=True))
    op.add_column("attendance", sa.Column("gps_longitude",   sa.Float, nullable=True))


def downgrade() -> None:
    # Never drop attendance columns to preserve data
    op.drop_table("wfh_requests")
    op.drop_table("wfh_rules")
