"""Add leave management tables

Revision ID: 004
Revises: 003
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "leave_types",
        sa.Column("id",                   sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("leave_code",           sa.String(20), unique=True, nullable=False),
        sa.Column("leave_name",           sa.String(100), nullable=False),
        sa.Column("initial_balance_days", sa.Integer, server_default="12"),
        sa.Column("max_balance_days",     sa.Integer, server_default="24"),
        sa.Column("min_advance_days",     sa.Integer, server_default="1"),
        sa.Column("requires_document",    sa.Boolean, server_default="false"),
        sa.Column("allow_half_day",       sa.Boolean, server_default="true"),
        sa.Column("carry_over",           sa.Boolean, server_default="false"),
        sa.Column("is_active",            sa.Boolean, server_default="true"),
    )

    op.create_table(
        "leave_balances",
        sa.Column("id",                 sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("employee_id",        sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("leave_type_id",      sa.Integer, sa.ForeignKey("leave_types.id"), nullable=False),
        sa.Column("year",               sa.Integer, nullable=False),
        sa.Column("total_balance",      sa.Float, server_default="0"),
        sa.Column("carry_over_balance", sa.Float, server_default="0"),
        sa.Column("used_balance",       sa.Float, server_default="0"),
    )

    op.create_table(
        "leave_requests",
        sa.Column("id",            sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("employee_id",   sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("leave_type_id", sa.Integer, sa.ForeignKey("leave_types.id"), nullable=False),
        sa.Column("start_date",    sa.Date, nullable=False),
        sa.Column("end_date",      sa.Date, nullable=False),
        sa.Column("total_days",    sa.Float, nullable=False),
        sa.Column("is_half_day",   sa.Boolean, server_default="false"),
        sa.Column("reason",        sa.Text, nullable=True),
        sa.Column("document_path", sa.String(255), nullable=True),
        sa.Column("status",        sa.String(20), server_default="pending"),
        sa.Column("approved_by",   sa.String(20), nullable=True),
        sa.Column("approved_at",   sa.DateTime, nullable=True),
        sa.Column("notes",         sa.Text, nullable=True),
        sa.Column("created_at",    sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "permission_types",
        sa.Column("id",                sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("permission_code",   sa.String(20), unique=True, nullable=False),
        sa.Column("permission_name",   sa.String(100), nullable=False),
        sa.Column("max_days_per_year", sa.Integer, server_default="3"),
        sa.Column("requires_approval", sa.Boolean, server_default="true"),
        sa.Column("requires_document", sa.Boolean, server_default="false"),
        sa.Column("is_active",         sa.Boolean, server_default="true"),
    )

    op.create_table(
        "permission_requests",
        sa.Column("id",                 sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("employee_id",        sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("permission_type_id", sa.Integer, sa.ForeignKey("permission_types.id"), nullable=False),
        sa.Column("start_date",         sa.Date, nullable=False),
        sa.Column("end_date",           sa.Date, nullable=False),
        sa.Column("total_days",         sa.Float, nullable=False),
        sa.Column("reason",             sa.Text, nullable=True),
        sa.Column("document_path",      sa.String(255), nullable=True),
        sa.Column("status",             sa.String(20), server_default="pending"),
        sa.Column("approved_by",        sa.String(20), nullable=True),
        sa.Column("approved_at",        sa.DateTime, nullable=True),
        sa.Column("notes",              sa.Text, nullable=True),
        sa.Column("created_at",         sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("permission_requests")
    op.drop_table("permission_types")
    op.drop_table("leave_requests")
    op.drop_table("leave_balances")
    op.drop_table("leave_types")
