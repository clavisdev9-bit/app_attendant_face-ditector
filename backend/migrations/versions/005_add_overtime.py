"""Add overtime tables

Revision ID: 005
Revises: 004
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "overtime_rules",
        sa.Column("id",                      sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("rule_name",               sa.String(100), nullable=False),
        sa.Column("applicable_dept_ids",     sa.JSON, nullable=True),
        sa.Column("applicable_position_ids", sa.JSON, nullable=True),
        sa.Column("min_duration_minutes",    sa.Integer, server_default="30"),
        sa.Column("max_daily_hours",         sa.Float, server_default="3.0"),
        sa.Column("max_weekly_hours",        sa.Float, server_default="14.0"),
        sa.Column("weekday_multiplier",      sa.Numeric(4, 2), server_default="1.5"),
        sa.Column("holiday_multiplier",      sa.Numeric(4, 2), server_default="2.0"),
        sa.Column("requires_pre_approval",   sa.Boolean, server_default="true"),
        sa.Column("is_active",               sa.Boolean, server_default="true"),
    )

    op.create_table(
        "overtime_requests",
        sa.Column("id",                       sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("employee_id",              sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("date",                     sa.Date, nullable=False),
        sa.Column("planned_start",            sa.String(5), nullable=True),
        sa.Column("planned_end",              sa.String(5), nullable=True),
        sa.Column("planned_duration_minutes", sa.Integer, nullable=True),
        sa.Column("actual_start",             sa.DateTime, nullable=True),
        sa.Column("actual_end",               sa.DateTime, nullable=True),
        sa.Column("actual_duration_minutes",  sa.Integer, nullable=True),
        sa.Column("reason",                   sa.Text, nullable=True),
        sa.Column("status",                   sa.String(20), server_default="pending"),
        sa.Column("approved_by",              sa.String(20), nullable=True),
        sa.Column("created_at",               sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("overtime_requests")
    op.drop_table("overtime_rules")
