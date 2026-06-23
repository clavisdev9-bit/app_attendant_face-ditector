"""Add contractor module: skill_levels, projects, contractor_settings, extend employees

Revision ID: 009
Revises: 008
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- skill_levels ---
    op.create_table(
        "skill_levels",
        sa.Column("id",                     sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("skill_code",             sa.String(20), unique=True, nullable=False),
        sa.Column("skill_name",             sa.String(100), nullable=False),
        sa.Column("daily_rate",             sa.Numeric(12, 2), nullable=False, default=0),
        sa.Column("overtime_rate_per_hour", sa.Numeric(12, 2), nullable=False, default=0),
        sa.Column("is_active",              sa.Boolean, default=True),
        sa.Column("created_at",             sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at",             sa.DateTime, server_default=sa.func.now()),
    )

    # --- projects ---
    op.create_table(
        "projects",
        sa.Column("id",          sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("project_code", sa.String(30), unique=True, nullable=False),
        sa.Column("project_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("location",    sa.String(200), nullable=True),
        sa.Column("start_date",  sa.Date, nullable=True),
        sa.Column("end_date",    sa.Date, nullable=True),
        sa.Column("is_active",   sa.Boolean, default=True),
        sa.Column("created_at",  sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime, server_default=sa.func.now()),
    )

    # --- contractor_settings (1 row per project) ---
    op.create_table(
        "contractor_settings",
        sa.Column("id",                         sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("project_id",                 sa.Integer, sa.ForeignKey("projects.id"), nullable=False, unique=True),
        # Jam kerja
        sa.Column("work_start",                 sa.String(5), nullable=False, default="09:00"),
        sa.Column("work_end",                   sa.String(5), nullable=False, default="18:00"),
        # Overtime
        sa.Column("overtime_start",             sa.String(5), nullable=False, default="19:00"),
        sa.Column("max_overtime_time",          sa.String(5), nullable=False, default="22:00"),
        # Uang makan
        sa.Column("meal_allowance_amount",      sa.Numeric(12, 2), nullable=False, default=25000),
        sa.Column("meal_allowance_threshold",   sa.String(5), nullable=False, default="22:00"),
        sa.Column("updated_at",                 sa.DateTime, server_default=sa.func.now()),
    )

    # --- extend employees ---
    op.add_column("employees", sa.Column("is_contractor",   sa.Boolean, nullable=True, default=False))
    op.add_column("employees", sa.Column("skill_level_id",  sa.Integer, sa.ForeignKey("skill_levels.id"), nullable=True))
    op.add_column("employees", sa.Column("project_id",      sa.Integer, sa.ForeignKey("projects.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("employees", "project_id")
    op.drop_column("employees", "skill_level_id")
    op.drop_column("employees", "is_contractor")
    op.drop_table("contractor_settings")
    op.drop_table("projects")
    op.drop_table("skill_levels")
