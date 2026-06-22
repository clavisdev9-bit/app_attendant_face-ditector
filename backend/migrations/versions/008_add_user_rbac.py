"""Add user RBAC tables (roles, users)

Revision ID: 008
Revises: 007
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id",          sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("role_code",   sa.String(30), unique=True, nullable=False),
        sa.Column("role_name",   sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("permissions", sa.JSON, nullable=True),
    )

    op.create_table(
        "users",
        sa.Column("id",              sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("employee_id",     sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=True),
        sa.Column("username",        sa.String(50), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role_id",         sa.Integer, sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("is_active",       sa.Boolean, default=True),
        sa.Column("last_login",      sa.DateTime, nullable=True),
        sa.Column("created_at",      sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"])


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("roles")
