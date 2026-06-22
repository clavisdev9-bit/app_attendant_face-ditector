"""Add attendance_policies table

Revision ID: 006
Revises: 005
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance_policies",
        sa.Column("id",                            sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("policy_name",                   sa.String(100), nullable=False),
        sa.Column("applicable_dept_ids",           sa.JSON, nullable=True),
        sa.Column("grace_period_minutes",          sa.Integer, server_default="15"),
        sa.Column("early_leave_tolerance_minutes", sa.Integer, server_default="0"),
        sa.Column("min_work_hours_per_day",        sa.Float, server_default="4.0"),
        sa.Column("auto_overtime",                 sa.Boolean, server_default="false"),
        sa.Column("max_auto_overtime_hours",       sa.Float, server_default="2.0"),
        sa.Column("mark_absent_if_no_checkin",     sa.Boolean, server_default="false"),
        sa.Column("notify_manager_if_absent",      sa.Boolean, server_default="false"),
        sa.Column("is_active",                     sa.Boolean, server_default="true"),
    )


def downgrade() -> None:
    op.drop_table("attendance_policies")
