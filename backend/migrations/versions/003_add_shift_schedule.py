"""Add shift, employee_schedules, holidays tables

Revision ID: 003
Revises: 002
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shifts",
        sa.Column("id",                   sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("shift_code",           sa.String(20), unique=True, nullable=False),
        sa.Column("shift_name",           sa.String(100), nullable=False),
        sa.Column("start_time",           sa.String(5), nullable=False),
        sa.Column("end_time",             sa.String(5), nullable=False),
        sa.Column("break_start",          sa.String(5), nullable=True),
        sa.Column("break_end",            sa.String(5), nullable=True),
        sa.Column("total_work_minutes",   sa.Integer, nullable=True),
        sa.Column("grace_period_minutes", sa.Integer, server_default="15"),
        sa.Column("crosses_midnight",     sa.Boolean, server_default="false"),
        sa.Column("is_active",            sa.Boolean, server_default="true"),
    )

    op.create_table(
        "employee_schedules",
        sa.Column("id",          sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("employee_id", sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("shift_id",    sa.Integer, sa.ForeignKey("shifts.id"), nullable=False),
        sa.Column("valid_from",  sa.Date, nullable=False),
        sa.Column("valid_to",    sa.Date, nullable=True),
        sa.Column("work_days",   sa.JSON, nullable=True),
        sa.Column("notes",       sa.Text, nullable=True),
    )

    op.create_table(
        "holidays",
        sa.Column("id",                      sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("holiday_name",            sa.String(100), nullable=False),
        sa.Column("date",                    sa.Date, nullable=False, index=True),
        sa.Column("holiday_type",            sa.String(30), nullable=False),
        sa.Column("applicable_dept_ids",     sa.JSON, nullable=True),
        sa.Column("applicable_location_ids", sa.JSON, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("holidays")
    op.drop_table("employee_schedules")
    op.drop_table("shifts")
