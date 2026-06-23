"""Update contractor module: add day-type fields, weekend/holiday rates,
multipliers, contractor_holidays table, payroll breakdown columns.

Revision ID: 011
Revises: 010
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── skill_levels: add weekend & holiday rates ────────────────────────────
    op.add_column("skill_levels", sa.Column("weekend_rate_per_hour",
                  sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("skill_levels", sa.Column("holiday_rate_per_hour",
                  sa.Numeric(12, 2), nullable=False, server_default="0"))

    # ── contractor_settings: add multipliers & weekend caps ──────────────────
    op.add_column("contractor_settings", sa.Column("weekday_ot_multiplier",
                  sa.Numeric(4, 2), nullable=False, server_default="1.0"))
    op.add_column("contractor_settings", sa.Column("weekend_ot_multiplier",
                  sa.Numeric(4, 2), nullable=False, server_default="1.5"))
    op.add_column("contractor_settings", sa.Column("holiday_ot_multiplier",
                  sa.Numeric(4, 2), nullable=False, server_default="2.0"))
    op.add_column("contractor_settings", sa.Column("max_weekend_ot_hours",
                  sa.Numeric(4, 2), nullable=False, server_default="8.0"))
    op.add_column("contractor_settings", sa.Column("meal_weekend_min_hours",
                  sa.Numeric(4, 2), nullable=False, server_default="4.0"))

    # ── contractor_payroll: break overtime into 3 day-type buckets ───────────
    op.add_column("contractor_payroll", sa.Column("weekend_attendance_days",
                  sa.Integer, nullable=False, server_default="0"))
    op.add_column("contractor_payroll", sa.Column("holiday_attendance_days",
                  sa.Integer, nullable=False, server_default="0"))
    op.add_column("contractor_payroll", sa.Column("weekday_ot_hours",
                  sa.Numeric(8, 2), nullable=False, server_default="0"))
    op.add_column("contractor_payroll", sa.Column("weekday_ot_amount",
                  sa.Numeric(15, 2), nullable=False, server_default="0"))
    op.add_column("contractor_payroll", sa.Column("weekend_ot_hours",
                  sa.Numeric(8, 2), nullable=False, server_default="0"))
    op.add_column("contractor_payroll", sa.Column("weekend_ot_amount",
                  sa.Numeric(15, 2), nullable=False, server_default="0"))
    op.add_column("contractor_payroll", sa.Column("holiday_ot_hours",
                  sa.Numeric(8, 2), nullable=False, server_default="0"))
    op.add_column("contractor_payroll", sa.Column("holiday_ot_amount",
                  sa.Numeric(15, 2), nullable=False, server_default="0"))
    # rename generic overtime_hours/amount to total for backward compat
    # (keep existing columns as totals)

    # ── overtime_requests: add day_type ──────────────────────────────────────
    op.add_column("overtime_requests", sa.Column("day_type",
                  sa.String(10), nullable=True, server_default="workday"))
    # workday | saturday | sunday | holiday
    op.add_column("overtime_requests", sa.Column("reject_reason",
                  sa.Text, nullable=True))

    # ── contractor_holidays ──────────────────────────────────────────────────
    op.create_table(
        "contractor_holidays",
        sa.Column("id",                    sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("date",                  sa.Date, nullable=False),
        sa.Column("name",                  sa.String(100), nullable=False),
        sa.Column("holiday_type",          sa.String(20), nullable=False, server_default="national"),
        # national | company
        sa.Column("applicable_project_ids", sa.JSON, nullable=True),
        # NULL = applies to all projects
        sa.Column("created_at",            sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_contractor_holidays_date", "contractor_holidays", ["date"])

    # ── employees: add leader_employee_id ────────────────────────────────────
    op.add_column("employees", sa.Column("leader_employee_id",
                  sa.String(20), sa.ForeignKey("employees.employee_id"), nullable=True))


def downgrade() -> None:
    op.drop_column("employees", "leader_employee_id")
    op.drop_index("ix_contractor_holidays_date", "contractor_holidays")
    op.drop_table("contractor_holidays")
    op.drop_column("overtime_requests", "reject_reason")
    op.drop_column("overtime_requests", "day_type")
    for col in ["holiday_ot_amount", "holiday_ot_hours", "weekend_ot_amount",
                "weekend_ot_hours", "weekday_ot_amount", "weekday_ot_hours",
                "holiday_attendance_days", "weekend_attendance_days"]:
        op.drop_column("contractor_payroll", col)
    for col in ["meal_weekend_min_hours", "max_weekend_ot_hours",
                "holiday_ot_multiplier", "weekend_ot_multiplier", "weekday_ot_multiplier"]:
        op.drop_column("contractor_settings", col)
    for col in ["holiday_rate_per_hour", "weekend_rate_per_hour"]:
        op.drop_column("skill_levels", col)
