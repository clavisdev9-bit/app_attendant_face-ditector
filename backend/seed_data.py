"""
Seed data for HADIR v2 — covers seluruh flow process.
Jalankan di dalam container:
    docker compose exec backend python seed_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date, datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://admin:secret@db:5432/attendance_db"
)
engine  = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def upsert(db, model, filter_kw, extra_kw=None):
    """Get existing row or create new one; never duplicates."""
    obj = db.query(model).filter_by(**filter_kw).first()
    if obj:
        return obj, False
    obj = model(**filter_kw, **(extra_kw or {}))
    db.add(obj)
    db.flush()
    return obj, True


def dt(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute)


# ─── 1. COMPANY ───────────────────────────────────────────────────────────────

def seed_company(db):
    from models import Company
    obj, created = upsert(db, Company, {"company_code": "STI"}, {
        "company_name": "PT Solusi Teknologi Indonesia",
        "address":      "Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan",
        "city":         "Jakarta Selatan",
        "province":     "DKI Jakarta",
        "phone":        "+62-21-5557890",
        "npwp":         "01.234.567.8-901.000",
        "timezone":     "Asia/Jakarta",
    })
    print(f"  Company     : {'created' if created else 'exists'} — {obj.company_name}")


# ─── 2. WORK LOCATIONS ────────────────────────────────────────────────────────

def seed_locations(db):
    from models import WorkLocation
    rows = [
        dict(location_code="JKPST", extra=dict(
            location_name="Kantor Pusat Jakarta",
            address="Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan",
            latitude=-6.208763, longitude=106.822757,
            gps_radius_meters=150, is_active=True,
        )),
        dict(location_code="BDCAB", extra=dict(
            location_name="Kantor Cabang Bandung",
            address="Jl. Asia Afrika No. 65, Bandung",
            latitude=-6.921488, longitude=107.607193,
            gps_radius_meters=200, is_active=True,
        )),
        dict(location_code="REMOTE", extra=dict(
            location_name="Remote / Work From Home",
            address=None,
            latitude=None, longitude=None,
            gps_radius_meters=0, is_active=True,
        )),
    ]
    result = {}
    for r in rows:
        obj, created = upsert(db, WorkLocation, {"location_code": r["location_code"]}, r["extra"])
        result[r["location_code"]] = obj
        print(f"  Location    : {'created' if created else 'exists'} — {obj.location_name}")
    return result


# ─── 3. DEPARTMENTS ───────────────────────────────────────────────────────────

def seed_departments(db, locs):
    from models import Department
    # First pass: create all without head (circular FK)
    defs = [
        # (dept_code, dept_name, parent_code, location_code)
        ("CORP",   "Korporat",              None,   "JKPST"),
        ("IT",     "Teknologi Informasi",   "CORP", "JKPST"),
        ("IT-DEV", "IT Development",        "IT",   "JKPST"),
        ("IT-INF", "IT Infrastructure",     "IT",   "JKPST"),
        ("HR",     "Human Resources",       "CORP", "JKPST"),
        ("FIN",    "Finance",               "CORP", "BDCAB"),
        ("OPS",    "Operasional",           "CORP", "BDCAB"),
    ]
    result = {}
    for code, name, parent_code, loc_code in defs:
        obj, created = upsert(db, Department, {"dept_code": code}, {
            "dept_name":   name,
            "location_id": locs[loc_code].id,
            "is_active":   True,
        })
        result[code] = obj
        print(f"  Dept        : {'created' if created else 'exists'} — {name}")

    # Second pass: set parent_dept_id
    for code, _name, parent_code, _loc in defs:
        if parent_code:
            d = result[code]
            d.parent_dept_id = result[parent_code].id
    db.flush()
    return result


# ─── 4. JOB POSITIONS ─────────────────────────────────────────────────────────

def seed_positions(db, depts):
    from models import JobPosition
    defs = [
        # (position_code, position_name, level, dept_code)
        ("DIR",     "Direktur Utama",         "8", "CORP"),
        ("IT-MGR",  "IT Manager",             "6", "IT"),
        ("HR-MGR",  "HR Manager",             "6", "HR"),
        ("FIN-MGR", "Finance Manager",        "6", "FIN"),
        ("OPS-MGR", "Operations Manager",     "6", "OPS"),
        ("SR-DEV",  "Senior Software Engineer","4", "IT-DEV"),
        ("DEV",     "Software Engineer",      "3", "IT-DEV"),
        ("IT-OPS",  "IT Operations Engineer", "3", "IT-INF"),
        ("HR-STF",  "HR Staff",               "3", "HR"),
        ("FIN-STF", "Finance Staff",          "3", "FIN"),
        ("OPS-STF", "Operations Staff",       "3", "OPS"),
    ]
    result = {}
    for code, name, level, dept_code in defs:
        obj, created = upsert(db, JobPosition, {"position_code": code}, {
            "position_name": name,
            "level":         level,
            "department_id": depts[dept_code].id,
            "is_active":     True,
        })
        result[code] = obj
        print(f"  Position    : {'created' if created else 'exists'} — {name}")
    return result


# ─── 5. EMPLOYEES ─────────────────────────────────────────────────────────────

def seed_employees(db, depts, positions, locs):
    from models import Employee
    # (employee_id, name, dept_str, dept_code, pos_code, loc_code,
    #  email, phone, card_uid, employment_type, attendance_type,
    #  work_start, work_end, grace)
    defs = [
        ("EMP001","Budi Santoso",       "Korporat",            "CORP",   "DIR",    "JKPST",
         "budi.santoso@sti.co.id",    "081211110001","CARD-001","permanent","onsite","08:00","17:00",15),
        ("EMP002","Andi Wijaya",        "Teknologi Informasi",  "IT",     "IT-MGR", "JKPST",
         "andi.wijaya@sti.co.id",     "081211110002","CARD-002","permanent","onsite","08:00","17:00",15),
        ("EMP003","Sari Dewi",          "Human Resources",      "HR",     "HR-MGR", "JKPST",
         "sari.dewi@sti.co.id",       "081211110003","CARD-003","permanent","onsite","08:00","17:00",15),
        ("EMP004","Dodi Pratama",       "Finance",              "FIN",    "FIN-MGR","BDCAB",
         "dodi.pratama@sti.co.id",    "081211110004","CARD-004","permanent","onsite","08:00","17:00",15),
        ("EMP005","Reza Firmansyah",    "IT Development",       "IT-DEV", "SR-DEV", "JKPST",
         "reza.firmansyah@sti.co.id", "081211110005","CARD-005","permanent","hybrid","09:00","18:00",30),
        ("EMP006","Nina Kusuma",        "IT Development",       "IT-DEV", "DEV",    "JKPST",
         "nina.kusuma@sti.co.id",     "081211110006","CARD-006","permanent","hybrid","09:00","18:00",30),
        ("EMP007","Bintang Nugraha",    "IT Development",       "IT-DEV", "DEV",    "JKPST",
         "bintang.nugraha@sti.co.id", "081211110007","CARD-007","contract","hybrid","09:00","18:00",30),
        ("EMP008","Dewi Rahayu",        "Human Resources",      "HR",     "HR-STF", "JKPST",
         "dewi.rahayu@sti.co.id",     "081211110008","CARD-008","permanent","onsite","08:00","17:00",15),
        ("EMP009","Ahmad Fauzi",        "Finance",              "FIN",    "FIN-STF","BDCAB",
         "ahmad.fauzi@sti.co.id",     "081211110009","CARD-009","permanent","onsite","08:00","17:00",15),
        ("EMP010","Laras Sari",         "IT Infrastructure",    "IT-INF", "IT-OPS", "JKPST",
         "laras.sari@sti.co.id",      "081211110010","CARD-010","permanent","onsite","13:00","22:00",15),
        ("EMP011","Hendra Gunawan",     "Operasional",          "OPS",    "OPS-MGR","BDCAB",
         "hendra.gunawan@sti.co.id",  "081211110011","CARD-011","permanent","onsite","08:00","17:00",15),
        ("EMP012","Rina Wulandari",     "Operasional",          "OPS",    "OPS-STF","BDCAB",
         "rina.wulandari@sti.co.id",  "081211110012","CARD-012","contract","onsite","08:00","17:00",15),
    ]
    result = {}
    for row in defs:
        (emp_id, name, dept_str, dept_code, pos_code, loc_code,
         email, phone, card_uid, emp_type, att_type,
         ws, we, grace) = row
        obj, created = upsert(db, Employee, {"employee_id": emp_id}, {
            "name":            name,
            "department":      dept_str,
            "position":        positions[pos_code].position_name,
            "department_id":   depts[dept_code].id,
            "position_id":     positions[pos_code].id,
            "location_id":     locs[loc_code].id,
            "email":           email,
            "phone":           phone,
            "card_uid":        card_uid,
            "employment_type": emp_type,
            "attendance_type": att_type,
            "work_start":      ws,
            "work_end":        we,
            "late_tolerance":  grace,
            "is_active":       True,
            "join_date":       date(2023, 1, 1),
        })
        result[emp_id] = obj
        print(f"  Employee    : {'created' if created else 'exists'} — {name}")

    # Set direct_manager_id (integer FK to employees.id)
    manager_map = {
        "EMP002": "EMP001","EMP003": "EMP001","EMP004": "EMP001","EMP011": "EMP001",
        "EMP005": "EMP002","EMP010": "EMP002",
        "EMP006": "EMP005","EMP007": "EMP005",
        "EMP008": "EMP003",
        "EMP009": "EMP004",
        "EMP012": "EMP011",
    }
    for emp_id, mgr_id in manager_map.items():
        result[emp_id].direct_manager_id = result[mgr_id].id
    db.flush()
    return result


def update_dept_heads(db, depts, employees):
    """Assign department heads after employees exist."""
    head_map = {
        "CORP":   "EMP001",
        "IT":     "EMP002",
        "IT-DEV": "EMP005",
        "IT-INF": "EMP010",
        "HR":     "EMP003",
        "FIN":    "EMP004",
        "OPS":    "EMP011",
    }
    for code, emp_id in head_map.items():
        depts[code].head_employee_id = emp_id
    db.flush()


# ─── 6. ROLES ─────────────────────────────────────────────────────────────────

ALL_PERMS = [
    "attendance:read_all", "attendance:read_team", "attendance:read_own",
    "attendance:correct_all", "attendance:correct_team", "attendance:correct_own",
    "leave:manage", "leave:request", "leave:approve_all", "leave:approve_team",
    "overtime:request", "overtime:approve_team",
    "shift:view_own", "shift:view_team", "shift:manage",
    "report:all", "report:team", "report:export",
    "master:view", "master:manage",
    "system:config", "system:audit_log", "system:user_manage",
]

def seed_roles(db):
    from models import Role
    defs = [
        ("super_admin", "Super Administrator", ALL_PERMS),
        ("admin", "Administrator", [
            "attendance:read_all","attendance:correct_all",
            "leave:approve_all","leave:manage",
            "overtime:approve_team",
            "shift:manage","shift:view_team",
            "report:all","report:export",
            "master:view","master:manage",
        ]),
        ("hr_staff", "HR Staff", [
            "attendance:read_all",
            "leave:approve_all","leave:manage",
            "report:all","report:export",
            "master:view",
        ]),
        ("manager", "Manajer", [
            "attendance:read_team","attendance:correct_team",
            "leave:approve_team","leave:request",
            "overtime:approve_team","overtime:request",
            "shift:view_team","shift:view_own",
            "report:team","report:export",
        ]),
        ("employee", "Karyawan", [
            "attendance:read_own","attendance:correct_own",
            "leave:request",
            "overtime:request",
            "shift:view_own",
        ]),
    ]
    result = {}
    for code, name, perms in defs:
        obj, created = upsert(db, Role, {"role_code": code}, {
            "role_name":   name,
            "permissions": perms,
        })
        result[code] = obj
        print(f"  Role        : {'created' if created else 'exists'} — {name}")
    return result


# ─── 7. USERS ─────────────────────────────────────────────────────────────────

def seed_users(db, roles, employees):
    from models import User
    from services.auth_service import hash_password
    defs = [
        # (username, password, role_code, employee_id | None)
        ("superadmin",       "Admin@12345!", "super_admin", None),
        ("hr.admin",         "Admin@12345!", "admin",       None),
        ("sari.dewi",        "Pass@12345!",  "hr_staff",    "EMP003"),
        ("andi.wijaya",      "Pass@12345!",  "manager",     "EMP002"),
        ("dodi.pratama",     "Pass@12345!",  "manager",     "EMP004"),
        ("hendra.gunawan",   "Pass@12345!",  "manager",     "EMP011"),
        ("reza.firmansyah",  "Pass@12345!",  "employee",    "EMP005"),
        ("nina.kusuma",      "Pass@12345!",  "employee",    "EMP006"),
        ("bintang.nugraha",  "Pass@12345!",  "employee",    "EMP007"),
        ("ahmad.fauzi",      "Pass@12345!",  "employee",    "EMP009"),
        ("dewi.rahayu",      "Pass@12345!",  "employee",    "EMP008"),
        ("laras.sari",       "Pass@12345!",  "employee",    "EMP010"),
    ]
    for username, pwd, role_code, emp_id in defs:
        obj, created = upsert(db, User, {"username": username}, {
            "hashed_password": hash_password(pwd),
            "role_id":         roles[role_code].id,
            "employee_id":     emp_id,
            "is_active":       True,
        })
        print(f"  User        : {'created' if created else 'exists'} — {username} [{role_code}]")


# ─── 8. SHIFTS ────────────────────────────────────────────────────────────────

def seed_shifts(db):
    from models import Shift
    defs = [
        ("SHIFT-A", "Shift Pagi",      "08:00","17:00","12:00","13:00", 480, 15,  False),
        ("SHIFT-B", "Shift Sore",      "13:00","22:00","17:00","18:00", 480, 15,  False),
        ("SHIFT-C", "Shift Malam",     "22:00","07:00","02:00","03:00", 480, 15,  True),
        ("SHIFT-X", "Shift Fleksibel", "09:00","18:00","12:00","13:00", 480, 30,  False),
    ]
    result = {}
    for code, name, s, e, bs, be, tw, grace, cross in defs:
        obj, created = upsert(db, Shift, {"shift_code": code}, {
            "shift_name":           name,
            "start_time":           s,
            "end_time":             e,
            "break_start":          bs,
            "break_end":            be,
            "total_work_minutes":   tw,
            "grace_period_minutes": grace,
            "crosses_midnight":     cross,
            "is_active":            True,
        })
        result[code] = obj
        print(f"  Shift       : {'created' if created else 'exists'} — {name}")
    return result


# ─── 9. EMPLOYEE SCHEDULES ────────────────────────────────────────────────────

def seed_schedules(db, shifts, employees):
    from models import EmployeeSchedule
    WEEKDAYS = ["MON","TUE","WED","THU","FRI"]
    # (employee_id, shift_code, notes)
    defs = [
        ("EMP001","SHIFT-A","Jam kerja direktur"),
        ("EMP002","SHIFT-A","Jam kerja manager IT"),
        ("EMP003","SHIFT-A","Jam kerja manager HR"),
        ("EMP004","SHIFT-A","Jam kerja manager Finance"),
        ("EMP005","SHIFT-X","Flexible schedule — senior developer"),
        ("EMP006","SHIFT-X","Flexible schedule — developer"),
        ("EMP007","SHIFT-X","Flexible schedule — developer kontrak"),
        ("EMP008","SHIFT-A","Jam kerja HR staff"),
        ("EMP009","SHIFT-A","Jam kerja finance staff Bandung"),
        ("EMP010","SHIFT-B","Shift sore — IT support"),
        ("EMP011","SHIFT-A","Jam kerja manager Operasional"),
        ("EMP012","SHIFT-A","Jam kerja staff Operasional"),
    ]
    for emp_id, shift_code, notes in defs:
        existing = db.query(EmployeeSchedule).filter_by(employee_id=emp_id).first()
        if existing:
            print(f"  Schedule    : exists   — {emp_id}")
            continue
        obj = EmployeeSchedule(
            employee_id=emp_id,
            shift_id=shifts[shift_code].id,
            valid_from=date(2025, 1, 1),
            valid_to=None,
            work_days=WEEKDAYS,
            notes=notes,
        )
        db.add(obj)
        db.flush()
        print(f"  Schedule    : created  — {emp_id} → {shift_code}")


# ─── 10. HOLIDAYS 2026 ────────────────────────────────────────────────────────

def seed_holidays(db):
    from models import Holiday
    defs = [
        (date(2026,  1,  1), "Tahun Baru Masehi 2026",               "national"),
        (date(2026,  1, 27), "Isra Mi'raj Nabi Muhammad SAW",         "national"),
        (date(2026,  1, 28), "Tahun Baru Imlek 2577 Kongzili",        "national"),
        (date(2026,  3, 29), "Hari Raya Nyepi Tahun Baru Saka 1948", "national"),
        (date(2026,  4,  2), "Wafat Isa Al Masih (Paskah)",           "national"),
        (date(2026,  4, 20), "Hari Raya Idul Fitri 1447 H",           "national"),
        (date(2026,  4, 21), "Hari Raya Idul Fitri 1447 H (hari 2)", "national"),
        (date(2026,  4, 24), "Cuti Bersama Idul Fitri",               "collective_leave"),
        (date(2026,  5,  1), "Hari Buruh Internasional",              "national"),
        (date(2026,  5, 14), "Kenaikan Isa Al Masih",                 "national"),
        (date(2026,  5, 29), "Hari Raya Waisak 2570 BE",              "national"),
        (date(2026,  6,  1), "Hari Lahir Pancasila",                  "national"),
        (date(2026,  6, 17), "Hari Raya Idul Adha 1447 H",            "national"),
        (date(2026,  7,  7), "Tahun Baru Islam 1448 H",               "national"),
        (date(2026,  8, 17), "Hari Kemerdekaan RI ke-81",             "national"),
        (date(2026,  9, 16), "Maulid Nabi Muhammad SAW",              "national"),
        (date(2026, 12, 25), "Hari Natal",                            "national"),
        (date(2026, 12, 26), "Cuti Bersama Natal",                    "collective_leave"),
        # Company-specific holidays
        (date(2026,  4, 22), "Cuti Bersama STI — Idul Fitri",        "company"),
        (date(2026,  4, 23), "Cuti Bersama STI — Idul Fitri",        "company"),
    ]
    for d, name, htype in defs:
        existing = db.query(Holiday).filter_by(date=d, holiday_name=name).first()
        if existing:
            print(f"  Holiday     : exists   — {name}")
            continue
        obj = Holiday(holiday_name=name, date=d, holiday_type=htype,
                      applicable_dept_ids=None, applicable_location_ids=None)
        db.add(obj)
        db.flush()
        print(f"  Holiday     : created  — {name} [{htype}]")


# ─── 11. ATTENDANCE POLICIES ──────────────────────────────────────────────────

def seed_policies(db, depts):
    from models import AttendancePolicy
    policies = [
        {
            "policy_name": "Kebijakan Umum STI",
            "applicable_dept_ids": None,      # berlaku global
            "grace_period_minutes": 15,
            "early_leave_tolerance_minutes": 0,
            "min_work_hours_per_day": 4.0,
            "auto_overtime": False,
            "max_auto_overtime_hours": 0.0,
            "mark_absent_if_no_checkin": True,
            "notify_manager_if_absent": True,
            "is_active": True,
        },
        {
            "policy_name": "Kebijakan IT — Flexible Schedule",
            # Berlaku untuk IT-DEV dan IT-INF
            "applicable_dept_ids": [depts["IT-DEV"].id, depts["IT-INF"].id],
            "grace_period_minutes": 30,
            "early_leave_tolerance_minutes": 30,
            "min_work_hours_per_day": 4.0,
            "auto_overtime": True,
            "max_auto_overtime_hours": 2.0,
            "mark_absent_if_no_checkin": False,
            "notify_manager_if_absent": True,
            "is_active": True,
        },
    ]
    for p in policies:
        existing = db.query(AttendancePolicy).filter_by(policy_name=p["policy_name"]).first()
        if existing:
            print(f"  Policy      : exists   — {p['policy_name']}")
            continue
        obj = AttendancePolicy(**p)
        db.add(obj)
        db.flush()
        print(f"  Policy      : created  — {p['policy_name']}")


# ─── 12. LEAVE TYPES ──────────────────────────────────────────────────────────

def seed_leave_types(db):
    from models import LeaveType
    defs = [
        ("CUTI-TH",  "Cuti Tahunan",         12, 24,  3, False, True,  True),
        ("CUTI-SKT", "Cuti Sakit",            14, 14,  0, True,  True,  False),
        ("CUTI-MLH", "Cuti Melahirkan",       90, 90, 30, True,  False, False),
        ("CUTI-NKH", "Cuti Menikah",           3,  3,  7, True,  False, False),
        ("CUTI-DKB", "Cuti Kemalangan/Duka",   3,  3,  0, False, False, False),
        ("CUTI-IBD", "Cuti Ibadah Haji/Umroh", 40, 40, 30, True, False, False),
    ]
    result = {}
    for code, name, init, maxd, adv, req_doc, half, carry in defs:
        obj, created = upsert(db, LeaveType, {"leave_code": code}, {
            "leave_name":          name,
            "initial_balance_days": init,
            "max_balance_days":    maxd,
            "min_advance_days":    adv,
            "requires_document":   req_doc,
            "allow_half_day":      half,
            "carry_over":          carry,
            "is_active":           True,
        })
        result[code] = obj
        print(f"  LeaveType   : {'created' if created else 'exists'} — {name}")
    return result


# ─── 13. PERMISSION TYPES ─────────────────────────────────────────────────────

def seed_permission_types(db):
    from models import PermissionType
    defs = [
        ("IZIN-MDK", "Izin Mendadak",              3, True,  False),
        ("DSPNS",    "Dispensasi Keluarga",         2, True,  True),
        ("TGAS-LR",  "Tugas Luar / Dinas",         30, True,  True),
        ("IZIN-MED", "Izin Medis / Periksa Dokter", 6, False, False),
    ]
    for code, name, max_days, req_appr, req_doc in defs:
        obj, created = upsert(db, PermissionType, {"permission_code": code}, {
            "permission_name":  name,
            "max_days_per_year": max_days,
            "requires_approval": req_appr,
            "requires_document": req_doc,
            "is_active":         True,
        })
        print(f"  PermType    : {'created' if created else 'exists'} — {name}")


# ─── 14. OVERTIME RULES ───────────────────────────────────────────────────────

def seed_overtime_rules(db, depts):
    from models import OvertimeRule
    rules = [
        {
            "rule_name": "Aturan Lembur Umum",
            "applicable_dept_ids": None,   # global
            "applicable_position_ids": None,
            "min_duration_minutes": 30,
            "max_daily_hours": 3.0,
            "max_weekly_hours": 14.0,
            "weekday_multiplier": 1.5,
            "holiday_multiplier": 2.0,
            "requires_pre_approval": True,
            "is_active": True,
        },
        {
            "rule_name": "Aturan Lembur IT — Proyek Khusus",
            "applicable_dept_ids": [depts["IT-DEV"].id, depts["IT-INF"].id],
            "applicable_position_ids": None,
            "min_duration_minutes": 30,
            "max_daily_hours": 4.0,
            "max_weekly_hours": 20.0,
            "weekday_multiplier": 1.5,
            "holiday_multiplier": 2.5,
            "requires_pre_approval": False,  # dev boleh lembur tanpa approval dulu
            "is_active": True,
        },
        {
            "rule_name": "Aturan Lembur Operasional",
            "applicable_dept_ids": [depts["OPS"].id],
            "applicable_position_ids": None,
            "min_duration_minutes": 60,
            "max_daily_hours": 5.0,
            "max_weekly_hours": 25.0,
            "weekday_multiplier": 2.0,
            "holiday_multiplier": 3.0,
            "requires_pre_approval": True,
            "is_active": True,
        },
    ]
    for r in rules:
        existing = db.query(OvertimeRule).filter_by(rule_name=r["rule_name"]).first()
        if existing:
            print(f"  OTRule      : exists   — {r['rule_name']}")
            continue
        db.add(OvertimeRule(**r))
        db.flush()
        print(f"  OTRule      : created  — {r['rule_name']}")


# ─── 15. WFH RULES ────────────────────────────────────────────────────────────

def seed_wfh_rules(db, depts):
    from models import WFHRule
    rules = [
        {
            "rule_name": "WFH IT Development — Max 2 Hari/Minggu",
            "applicable_dept_ids": [depts["IT-DEV"].id],
            "applicable_position_ids": None,
            "max_wfh_days_per_week": 2,
            "require_selfie": True,
            "require_gps_validation": False,  # developer tidak perlu GPS (WFH bebas lokasi)
            "gps_radius_override_meters": None,
            "requires_manager_approval": True,
            "is_active": True,
        },
        {
            "rule_name": "WFH Manajemen — Max 1 Hari/Minggu",
            "applicable_dept_ids": [depts["IT"].id, depts["HR"].id, depts["FIN"].id],
            "applicable_position_ids": None,
            "max_wfh_days_per_week": 1,
            "require_selfie": True,
            "require_gps_validation": False,
            "gps_radius_override_meters": None,
            "requires_manager_approval": True,
            "is_active": True,
        },
    ]
    for r in rules:
        existing = db.query(WFHRule).filter_by(rule_name=r["rule_name"]).first()
        if existing:
            print(f"  WFHRule     : exists   — {r['rule_name']}")
            continue
        db.add(WFHRule(**r))
        db.flush()
        print(f"  WFHRule     : created  — {r['rule_name']}")


# ─── 16. LEAVE BALANCES 2026 ──────────────────────────────────────────────────

def seed_leave_balances(db, employees):
    from models import LeaveType, LeaveBalance
    year = 2026
    leave_types = db.query(LeaveType).filter_by(is_active=True).all()
    active_emps = [e for e in employees.values() if e.is_active]
    created_count = 0
    for emp in active_emps:
        for lt in leave_types:
            existing = db.query(LeaveBalance).filter_by(
                employee_id=emp.employee_id, leave_type_id=lt.id, year=year
            ).first()
            if not existing:
                carry = lt.initial_balance_days * 0.1 if lt.carry_over else 0
                db.add(LeaveBalance(
                    employee_id=emp.employee_id,
                    leave_type_id=lt.id,
                    year=year,
                    total_balance=lt.initial_balance_days + carry,
                    carry_over_balance=carry,
                    used_balance=0,
                ))
                created_count += 1
    db.flush()
    print(f"  LeaveBalance: created {created_count} records ({len(active_emps)} emp × {len(leave_types)} types, tahun {year})")


# ─── 17. SAMPLE TRANSACTIONS ──────────────────────────────────────────────────

def seed_transactions(db, employees):
    from models import (
        LeaveType, LeaveBalance, LeaveRequest, LeaveStatus,
        PermissionType, PermissionRequest,
        OvertimeRequest, OvertimeStatus,
        WFHRequest,
    )

    lt_cuti = db.query(LeaveType).filter_by(leave_code="CUTI-TH").first()
    lt_sakit = db.query(LeaveType).filter_by(leave_code="CUTI-SKT").first()
    lt_menikah = db.query(LeaveType).filter_by(leave_code="CUTI-NKH").first()
    perm_mendadak = db.query(PermissionType).filter_by(permission_code="IZIN-MDK").first()
    perm_med = db.query(PermissionType).filter_by(permission_code="IZIN-MED").first()

    # ── Leave Requests ──────────────────────────────────────────────────────
    leave_reqs = [
        # (emp_id, leave_type, start, end, days, reason, status, approved_by, notes)
        ("EMP008","CUTI-TH",  date(2026,5,4),  date(2026,5,8),  5,
         "Liburan keluarga ke Yogyakarta", "approved", "EMP003",
         "Disetujui. Pastikan pekerjaan diserahterimakan."),

        ("EMP006","CUTI-TH",  date(2026,5,26), date(2026,5,28), 3,
         "Rehat akhir bulan", "pending", None, None),

        ("EMP007","CUTI-SKT", date(2026,5,19), date(2026,5,19), 1,
         "Sakit demam — surat dokter menyusul", "approved", "EMP005",
         "Disetujui. Lampirkan surat dokter maksimal 3 hari kerja."),

        ("EMP009","CUTI-TH",  date(2026,6,2),  date(2026,6,5),  4,
         "Mudik ke kampung halaman", "pending", None, None),

        ("EMP006","CUTI-NKH", date(2026,7,14), date(2026,7,16), 3,
         "Pernikahan saudara kandung", "approved", "EMP005",
         "Selamat, disetujui."),

        ("EMP005","CUTI-TH",  date(2026,4,10), date(2026,4,14), 5,
         "Cuti lebaran tambahan", "rejected", "EMP002",
         "Ditolak — terlalu dekat dengan deadline sprint Q2."),
    ]

    for emp_id, lt_code, s, e, days, reason, status, approved_by, notes in leave_reqs:
        lt = db.query(LeaveType).filter_by(leave_code=lt_code).first()
        existing = db.query(LeaveRequest).filter_by(
            employee_id=emp_id, leave_type_id=lt.id, start_date=s
        ).first()
        if existing:
            print(f"  LeaveReq    : exists   — {emp_id} {s}")
            continue
        req = LeaveRequest(
            employee_id=emp_id, leave_type_id=lt.id,
            start_date=s, end_date=e, total_days=days,
            reason=reason, status=status,
            approved_by=approved_by, notes=notes,
            approved_at=datetime.now() if status in ("approved","rejected") else None,
        )
        db.add(req)
        db.flush()
        # Deduct balance if approved
        if status == "approved":
            bal = db.query(LeaveBalance).filter_by(
                employee_id=emp_id, leave_type_id=lt.id, year=2026
            ).first()
            if bal:
                bal.used_balance += days
                bal.total_balance = max(0, bal.total_balance - days)
        print(f"  LeaveReq    : created  — {emp_id} [{status}] {s}~{e}")

    # ── Permission Requests ─────────────────────────────────────────────────
    perm_reqs = [
        ("EMP010","IZIN-MDK", date(2026,5,13), date(2026,5,13), 1,
         "Urus BPJS mendadak", "approved", "EMP002"),
        ("EMP012","DSPNS",    date(2026,5,20), date(2026,5,20), 1,
         "Mengantar orang tua ke rumah sakit", "approved", "EMP011"),
        ("EMP004","IZIN-MED", date(2026,5,22), date(2026,5,22), 1,
         "Periksa dokter spesialis", "pending", None),
    ]
    for emp_id, pcode, s, e, days, reason, status, approved_by in perm_reqs:
        pt = db.query(PermissionType).filter_by(permission_code=pcode).first()
        if not pt:
            continue
        existing = db.query(PermissionRequest).filter_by(
            employee_id=emp_id, permission_type_id=pt.id, start_date=s
        ).first()
        if existing:
            print(f"  PermReq     : exists   — {emp_id} {s}")
            continue
        db.add(PermissionRequest(
            employee_id=emp_id, permission_type_id=pt.id,
            start_date=s, end_date=e, total_days=days,
            reason=reason, status=status,
            approved_by=approved_by,
            approved_at=datetime.now() if status == "approved" else None,
        ))
        db.flush()
        print(f"  PermReq     : created  — {emp_id} [{status}] {s}")

    # ── Overtime Requests ───────────────────────────────────────────────────
    ot_reqs = [
        # (emp_id, date, p_start, p_end, p_min, reason, status, approved_by, a_min)
        ("EMP005", date(2026,5,15), "18:00","21:00", 180,
         "Finalisasi fitur laporan Q1 untuk demo klien besok", "approved", "EMP002", 175),
        ("EMP006", date(2026,5,22), "18:00","20:00", 120,
         "Bug fixing critical production", "pending", None, None),
        ("EMP010", date(2026,5,19), "22:00","01:00", 180,
         "Maintenance server backup malam hari", "approved", "EMP002", 180),
        ("EMP007", date(2026,5,13), "18:00","19:30",  90,
         "Refactoring modul API auth", "rejected", "EMP005", None),
        ("EMP005", date(2026,5,20), "18:00","20:30", 150,
         "Sprint closing — code review dan merge PR", "approved", "EMP002", 145),
        ("EMP012", date(2026,5,11), "17:00","20:00", 180,
         "Serah terima barang dari supplier Bandung", "completed", "EMP011", 175),
    ]
    for emp_id, d, ps, pe, pm, reason, status, approved_by, actual_min in ot_reqs:
        existing = db.query(OvertimeRequest).filter_by(employee_id=emp_id, date=d).first()
        if existing:
            print(f"  OTReq       : exists   — {emp_id} {d}")
            continue
        req = OvertimeRequest(
            employee_id=emp_id, date=d,
            planned_start=ps, planned_end=pe,
            planned_duration_minutes=pm,
            reason=reason, status=status,
            approved_by=approved_by,
        )
        if actual_min and status in ("completed", "approved"):
            req.actual_duration_minutes = actual_min
        db.add(req)
        db.flush()
        print(f"  OTReq       : created  — {emp_id} [{status}] {d}")

    # ── WFH Requests ────────────────────────────────────────────────────────
    wfh_reqs = [
        # (emp_id, date, reason, status, approved_by)
        ("EMP005", date(2026,5,18), "Konsentrasi pengerjaan fitur baru", "approved", "EMP002"),
        ("EMP006", date(2026,5,20), "Rumah dekat klien untuk diskusi langsung", "approved", "EMP005"),
        ("EMP007", date(2026,5,21), "Tidak enak badan, bisa WFH", "pending", None),
        ("EMP005", date(2026,5,12), "Sprint planning di rumah", "approved", "EMP002"),
        ("EMP006", date(2026,5,13), "Efisiensi perjalanan", "approved", "EMP005"),
        ("EMP002", date(2026,5,19), "Rapat internal virtual", "approved", "EMP001"),
    ]
    for emp_id, d, reason, status, approved_by in wfh_reqs:
        existing = db.query(WFHRequest).filter_by(employee_id=emp_id, date=d).first()
        if existing:
            print(f"  WFHReq      : exists   — {emp_id} {d}")
            continue
        db.add(WFHRequest(
            employee_id=emp_id, date=d, reason=reason,
            status=status, approved_by=approved_by,
            approved_at=datetime.now() if status == "approved" else None,
        ))
        db.flush()
        print(f"  WFHReq      : created  — {emp_id} [{status}] {d}")


# ─── 18. ATTENDANCE HISTORY (2 minggu) ───────────────────────────────────────

def seed_attendance(db, employees):
    from models import Attendance, WFHRequest

    # 2 minggu kerja: 2026-05-11 s.d. 2026-05-22
    # Hari libur: 2026-05-14 (Kenaikan Isa Al Masih)
    WORK_DAYS = [
        date(2026,5,11), date(2026,5,12), date(2026,5,13),
        # 14 = libur nasional
        date(2026,5,15),
        date(2026,5,18), date(2026,5,19), date(2026,5,20),
        date(2026,5,21), date(2026,5,22),
    ]

    # Profil per karyawan: (shift_start_h, shift_end_h, grace_min)
    PROFILE = {
        "EMP001": (8,  17, 15),
        "EMP002": (8,  17, 15),
        "EMP003": (8,  17, 15),
        "EMP004": (8,  17, 15),
        "EMP005": (9,  18, 30),
        "EMP006": (9,  18, 30),
        "EMP007": (9,  18, 30),
        "EMP008": (8,  17, 15),
        "EMP009": (8,  17, 15),
        "EMP010": (13, 22, 15),
        "EMP011": (8,  17, 15),
        "EMP012": (8,  17, 15),
    }

    # Skenario khusus per (emp_id, date): "absent" | "late" | "wfh" | "half" | None=normal
    SPECIAL = {
        # WFH
        ("EMP005", date(2026,5,12)): "wfh",
        ("EMP005", date(2026,5,18)): "wfh",
        ("EMP006", date(2026,5,13)): "wfh",
        ("EMP006", date(2026,5,20)): "wfh",
        ("EMP002", date(2026,5,19)): "wfh",
        # Sakit/absent
        ("EMP007", date(2026,5,19)): "absent",   # cuti sakit approved
        # Late
        ("EMP006", date(2026,5,11)): "late",
        ("EMP009", date(2026,5,15)): "late",
        ("EMP012", date(2026,5,18)): "late",
        ("EMP007", date(2026,5,22)): "late",
        # Half day (izin siang)
        ("EMP010", date(2026,5,13)): "half",    # izin BPJS setengah hari
        ("EMP004", date(2026,5,22)): "half",    # periksa dokter
    }

    created_count = 0
    for emp_id, emp in employees.items():
        if emp_id not in PROFILE:
            continue
        sh, eh, grace = PROFILE[emp_id]
        for d in WORK_DAYS:
            existing = db.query(Attendance).filter_by(employee_id=emp_id, date=d).first()
            if existing:
                continue

            scenario = SPECIAL.get((emp_id, d))

            if scenario == "absent":
                # Rekam absen (mark_absent menghasilkan record dengan status absent)
                db.add(Attendance(
                    employee_id=emp_id, date=d,
                    check_in=None, check_out=None,
                    status="absent", method="manual",
                    notes="Cuti sakit — disetujui",
                    attendance_type="onsite",
                ))
                created_count += 1
                continue

            if scenario == "wfh":
                wfh_req = db.query(WFHRequest).filter_by(
                    employee_id=emp_id, date=d, status="approved"
                ).first()
                db.add(Attendance(
                    employee_id=emp_id, date=d,
                    check_in=dt(d, sh, 5),
                    check_out=dt(d, eh, 10),
                    status="present", method="wfh",
                    attendance_type="wfh",
                    gps_latitude=-6.200000 + (hash(emp_id) % 100) * 0.0001,
                    gps_longitude=106.816666 + (hash(emp_id) % 100) * 0.0001,
                    wfh_request_id=wfh_req.id if wfh_req else None,
                ))
                created_count += 1
                continue

            # Tentukan jam masuk
            if scenario == "late":
                # Masuk setelah grace period
                late_minutes = grace + 10 + (hash(emp_id + str(d)) % 30)
                cin_h = sh
                cin_m = late_minutes % 60
                cin_h += late_minutes // 60
                status = "late"
            else:
                # Masuk sebelum/dalam grace period
                cin_m = (hash(emp_id + str(d)) % grace)
                cin_h = sh
                status = "present"

            if scenario == "half":
                cout_h = sh + 4   # hanya setengah hari
                cout_m = 30
                status = "half_day"
            else:
                cout_h = eh
                cout_m = 5 + (hash(str(d) + emp_id) % 30)
                if cout_m >= 60:
                    cout_h += 1
                    cout_m -= 60

            db.add(Attendance(
                employee_id=emp_id, date=d,
                check_in=dt(d, cin_h, cin_m),
                check_out=dt(d, cout_h, cout_m),
                status=status,
                method="card+face",
                attendance_type="onsite",
            ))
            created_count += 1

    db.flush()
    print(f"  Attendance  : created {created_count} records (2 minggu × {len(employees)} karyawan)")


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    db = Session()
    try:
        print("\n" + "="*60)
        print("  HADIR v2 — Seed Data Master & Sample Transactions")
        print("="*60)

        print("\n[1/18] Company")
        seed_company(db)

        print("\n[2/18] Work Locations")
        locs = seed_locations(db)

        print("\n[3/18] Departments")
        depts = seed_departments(db, locs)

        print("\n[4/18] Job Positions")
        positions = seed_positions(db, depts)

        print("\n[5/18] Employees")
        employees = seed_employees(db, depts, positions, locs)

        print("\n[6/18] Department Heads (update)")
        update_dept_heads(db, depts, employees)

        print("\n[7/18] Roles")
        roles = seed_roles(db)

        print("\n[8/18] Users")
        seed_users(db, roles, employees)

        print("\n[9/18] Shifts")
        shifts = seed_shifts(db)

        print("\n[10/18] Employee Schedules")
        seed_schedules(db, shifts, employees)

        print("\n[11/18] Holidays 2026")
        seed_holidays(db)

        print("\n[12/18] Attendance Policies")
        seed_policies(db, depts)

        print("\n[13/18] Leave Types")
        seed_leave_types(db)

        print("\n[14/18] Permission Types")
        seed_permission_types(db)

        print("\n[15/18] Overtime Rules")
        seed_overtime_rules(db, depts)

        print("\n[16/18] WFH Rules")
        seed_wfh_rules(db, depts)

        print("\n[17/18] Leave Balances 2026")
        seed_leave_balances(db, employees)

        print("\n[17b] Sample Transactions (Leave / Permission / Overtime / WFH requests)")
        seed_transactions(db, employees)

        print("\n[18/18] Attendance History (2026-05-11 ~ 2026-05-22)")
        seed_attendance(db, employees)

        db.commit()
        print("\n" + "="*60)
        print("  ✓ Seed selesai — semua data berhasil disimpan.")
        print("="*60)

        print("\n  Akun login yang tersedia:")
        print("  ─────────────────────────────────────────────────────")
        print("  Username            Password        Role")
        print("  ─────────────────────────────────────────────────────")
        print("  superadmin          Admin@12345!    super_admin")
        print("  hr.admin            Admin@12345!    admin")
        print("  sari.dewi           Pass@12345!     hr_staff  (EMP003)")
        print("  andi.wijaya         Pass@12345!     manager   (EMP002 — IT Mgr)")
        print("  dodi.pratama        Pass@12345!     manager   (EMP004 — Finance Mgr)")
        print("  reza.firmansyah     Pass@12345!     employee  (EMP005 — Sr Dev)")
        print("  nina.kusuma         Pass@12345!     employee  (EMP006 — Dev)")
        print("  bintang.nugraha     Pass@12345!     employee  (EMP007 — Dev kontrak)")
        print("  ─────────────────────────────────────────────────────\n")

    except Exception as e:
        db.rollback()
        print(f"\n  ✗ Error: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
