"""Add master data tables (company, departments, work_locations, job_positions)

Revision ID: 001
Revises:
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company",
        sa.Column("id",           sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("company_name", sa.String(200), nullable=False),
        sa.Column("company_code", sa.String(20), unique=True, nullable=False),
        sa.Column("address",      sa.Text, nullable=True),
        sa.Column("city",         sa.String(100), nullable=True),
        sa.Column("province",     sa.String(100), nullable=True),
        sa.Column("phone",        sa.String(30), nullable=True),
        sa.Column("npwp",         sa.String(30), nullable=True),
        sa.Column("logo_path",    sa.String(255), nullable=True),
        sa.Column("timezone",     sa.String(50), server_default="Asia/Jakarta"),
        sa.Column("updated_at",   sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "work_locations",
        sa.Column("id",                sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("location_code",     sa.String(20), unique=True, nullable=False),
        sa.Column("location_name",     sa.String(100), nullable=False),
        sa.Column("address",           sa.Text, nullable=True),
        sa.Column("latitude",          sa.Float, nullable=True),
        sa.Column("longitude",         sa.Float, nullable=True),
        sa.Column("gps_radius_meters", sa.Integer, server_default="100"),
        sa.Column("is_active",         sa.Boolean, server_default="true"),
    )

    op.create_table(
        "departments",
        sa.Column("id",               sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("dept_code",        sa.String(20), unique=True, nullable=False),
        sa.Column("dept_name",        sa.String(100), nullable=False),
        sa.Column("parent_dept_id",   sa.Integer, sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("head_employee_id", sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=True),
        sa.Column("location_id",      sa.Integer, sa.ForeignKey("work_locations.id"), nullable=True),
        sa.Column("is_active",        sa.Boolean, server_default="true"),
    )

    op.create_table(
        "job_positions",
        sa.Column("id",            sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("position_code", sa.String(20), unique=True, nullable=False),
        sa.Column("position_name", sa.String(100), nullable=False),
        sa.Column("level",         sa.String(20), nullable=True),
        sa.Column("department_id", sa.Integer, sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("is_active",     sa.Boolean, server_default="true"),
    )


def downgrade() -> None:
    op.drop_table("job_positions")
    op.drop_table("departments")
    op.drop_table("work_locations")
    op.drop_table("company")
