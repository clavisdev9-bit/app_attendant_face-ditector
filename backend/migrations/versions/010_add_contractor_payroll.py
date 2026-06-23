"""Add contractor_payroll table

Revision ID: 010
Revises: 009
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contractor_payroll",
        sa.Column("id",                     sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("employee_id",            sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("project_id",             sa.Integer, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("period_month",           sa.Integer, nullable=False),   # 1-12
        sa.Column("period_year",            sa.Integer, nullable=False),
        # Kehadiran
        sa.Column("work_days",              sa.Integer, nullable=False, default=0),
        sa.Column("base_salary",            sa.Numeric(15, 2), nullable=False, default=0),
        # Lembur
        sa.Column("overtime_hours",         sa.Numeric(8, 2), nullable=False, default=0),
        sa.Column("overtime_amount",        sa.Numeric(15, 2), nullable=False, default=0),
        # Uang makan
        sa.Column("meal_allowance_days",    sa.Integer, nullable=False, default=0),
        sa.Column("meal_allowance_amount",  sa.Numeric(15, 2), nullable=False, default=0),
        # Potongan (dikosongkan dulu)
        sa.Column("deductions",             sa.Numeric(15, 2), nullable=False, default=0),
        # Total
        sa.Column("total_salary",           sa.Numeric(15, 2), nullable=False, default=0),
        # Status
        sa.Column("status",                 sa.String(20), nullable=False, default="draft"),  # draft / finalized
        sa.Column("notes",                  sa.Text, nullable=True),
        sa.Column("generated_at",           sa.DateTime, server_default=sa.func.now()),
        sa.Column("finalized_at",           sa.DateTime, nullable=True),
        sa.Column("finalized_by",           sa.String(50), nullable=True),
    )
    op.create_index("ix_contractor_payroll_employee_period",
                    "contractor_payroll",
                    ["employee_id", "period_year", "period_month"])


def downgrade() -> None:
    op.drop_index("ix_contractor_payroll_employee_period", "contractor_payroll")
    op.drop_table("contractor_payroll")
