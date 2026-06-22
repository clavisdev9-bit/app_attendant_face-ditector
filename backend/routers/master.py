"""
Master Data Router — Company, Department, WorkLocation, JobPosition
"""

import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database import get_db
from models import Company, Department, WorkLocation, JobPosition, Employee
from services.auth_service import require_permission

router = APIRouter(prefix="/api/v2/master", tags=["Master Data"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/uploads")


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class CompanyUpsert(BaseModel):
    company_name: str
    company_code: str
    address:      Optional[str] = None
    city:         Optional[str] = None
    province:     Optional[str] = None
    phone:        Optional[str] = None
    npwp:         Optional[str] = None
    timezone:     str = "Asia/Jakarta"


class CompanyResponse(BaseModel):
    id:           int
    company_name: str
    company_code: str
    address:      Optional[str]
    city:         Optional[str]
    province:     Optional[str]
    phone:        Optional[str]
    npwp:         Optional[str]
    logo_path:    Optional[str]
    timezone:     str
    class Config:
        from_attributes = True


class DepartmentCreate(BaseModel):
    dept_code:        str
    dept_name:        str
    parent_dept_id:   Optional[int] = None
    head_employee_id: Optional[str] = None
    location_id:      Optional[int] = None
    is_active:        bool = True


class DepartmentResponse(BaseModel):
    id:               int
    dept_code:        str
    dept_name:        str
    parent_dept_id:   Optional[int]
    head_employee_id: Optional[str]
    location_id:      Optional[int]
    is_active:        bool
    class Config:
        from_attributes = True


class DepartmentTree(DepartmentResponse):
    children: List["DepartmentTree"] = []
    class Config:
        from_attributes = True


class WorkLocationCreate(BaseModel):
    location_code:     str
    location_name:     str
    address:           Optional[str] = None
    latitude:          Optional[float] = None
    longitude:         Optional[float] = None
    gps_radius_meters: int = 100
    is_active:         bool = True


class WorkLocationResponse(BaseModel):
    id:                int
    location_code:     str
    location_name:     str
    address:           Optional[str]
    latitude:          Optional[float]
    longitude:         Optional[float]
    gps_radius_meters: int
    is_active:         bool
    class Config:
        from_attributes = True


class JobPositionCreate(BaseModel):
    position_code: str
    position_name: str
    level:         Optional[str] = None
    department_id: Optional[int] = None
    is_active:     bool = True


class JobPositionResponse(BaseModel):
    id:            int
    position_code: str
    position_name: str
    level:         Optional[str]
    department_id: Optional[int]
    is_active:     bool
    class Config:
        from_attributes = True


# ─── COMPANY ─────────────────────────────────────────────────────────────────

@router.get("/company", response_model=CompanyResponse,
            dependencies=[Depends(require_permission("master:view"))])
def get_company(db: Session = Depends(get_db)):
    company = db.query(Company).first()
    if not company:
        raise HTTPException(404, "Data perusahaan belum diisi")
    return company


@router.put("/company", response_model=CompanyResponse,
            dependencies=[Depends(require_permission("master:manage"))])
def upsert_company(body: CompanyUpsert, db: Session = Depends(get_db)):
    """Upsert — satu record perusahaan."""
    company = db.query(Company).first()
    if company:
        for k, v in body.model_dump().items():
            setattr(company, k, v)
    else:
        company = Company(**body.model_dump())
        db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.post("/company/logo",
             dependencies=[Depends(require_permission("master:manage"))])
async def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    company = db.query(Company).first()
    if not company:
        raise HTTPException(404, "Data perusahaan belum diisi")
    now_str = datetime.now().strftime("%Y-%m")
    dest_dir = f"{UPLOAD_DIR}/company/{now_str}"
    os.makedirs(dest_dir, exist_ok=True)
    dest = f"{dest_dir}/{file.filename}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    company.logo_path = dest
    db.commit()
    return {"logo_path": dest}


# ─── DEPARTMENT ───────────────────────────────────────────────────────────────

@router.get("/departments", response_model=List[DepartmentResponse],
            dependencies=[Depends(require_permission("master:view"))])
def list_departments(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(Department)
    if active_only:
        q = q.filter(Department.is_active == True)
    return q.all()


@router.get("/departments/tree", response_model=List[DepartmentTree],
            dependencies=[Depends(require_permission("master:view"))])
def department_tree(db: Session = Depends(get_db)):
    """Kembalikan departemen dalam struktur pohon."""
    all_depts = db.query(Department).filter(Department.is_active == True).all()

    def build_tree(parent_id):
        nodes = []
        for d in all_depts:
            if d.parent_dept_id == parent_id:
                node = DepartmentTree.model_validate(d)
                node.children = build_tree(d.id)
                nodes.append(node)
        return nodes

    return build_tree(None)


@router.post("/departments", response_model=DepartmentResponse,
             dependencies=[Depends(require_permission("master:manage"))])
def create_department(body: DepartmentCreate, db: Session = Depends(get_db)):
    if db.query(Department).filter(Department.dept_code == body.dept_code).first():
        raise HTTPException(400, "dept_code sudah digunakan")
    dept = Department(**body.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/departments/{dept_id}", response_model=DepartmentResponse,
            dependencies=[Depends(require_permission("master:manage"))])
def update_department(dept_id: int, body: DepartmentCreate, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Departemen tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(dept, k, v)
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/departments/{dept_id}",
               dependencies=[Depends(require_permission("master:manage"))])
def deactivate_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Departemen tidak ditemukan")
    dept.is_active = False
    db.commit()
    return {"message": "Departemen dinonaktifkan"}


# ─── WORK LOCATION ────────────────────────────────────────────────────────────

@router.get("/locations", response_model=List[WorkLocationResponse],
            dependencies=[Depends(require_permission("master:view"))])
def list_locations(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(WorkLocation)
    if active_only:
        q = q.filter(WorkLocation.is_active == True)
    return q.all()


@router.post("/locations", response_model=WorkLocationResponse,
             dependencies=[Depends(require_permission("master:manage"))])
def create_location(body: WorkLocationCreate, db: Session = Depends(get_db)):
    if db.query(WorkLocation).filter(WorkLocation.location_code == body.location_code).first():
        raise HTTPException(400, "location_code sudah digunakan")
    loc = WorkLocation(**body.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.put("/locations/{loc_id}", response_model=WorkLocationResponse,
            dependencies=[Depends(require_permission("master:manage"))])
def update_location(loc_id: int, body: WorkLocationCreate, db: Session = Depends(get_db)):
    loc = db.query(WorkLocation).filter(WorkLocation.id == loc_id).first()
    if not loc:
        raise HTTPException(404, "Lokasi tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(loc, k, v)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/locations/{loc_id}",
               dependencies=[Depends(require_permission("master:manage"))])
def deactivate_location(loc_id: int, db: Session = Depends(get_db)):
    loc = db.query(WorkLocation).filter(WorkLocation.id == loc_id).first()
    if not loc:
        raise HTTPException(404, "Lokasi tidak ditemukan")
    loc.is_active = False
    db.commit()
    return {"message": "Lokasi dinonaktifkan"}


# ─── JOB POSITION ─────────────────────────────────────────────────────────────

@router.get("/positions", response_model=List[JobPositionResponse],
            dependencies=[Depends(require_permission("master:view"))])
def list_positions(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(JobPosition)
    if active_only:
        q = q.filter(JobPosition.is_active == True)
    return q.all()


@router.post("/positions", response_model=JobPositionResponse,
             dependencies=[Depends(require_permission("master:manage"))])
def create_position(body: JobPositionCreate, db: Session = Depends(get_db)):
    if db.query(JobPosition).filter(JobPosition.position_code == body.position_code).first():
        raise HTTPException(400, "position_code sudah digunakan")
    pos = JobPosition(**body.model_dump())
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return pos


@router.put("/positions/{pos_id}", response_model=JobPositionResponse,
            dependencies=[Depends(require_permission("master:manage"))])
def update_position(pos_id: int, body: JobPositionCreate, db: Session = Depends(get_db)):
    pos = db.query(JobPosition).filter(JobPosition.id == pos_id).first()
    if not pos:
        raise HTTPException(404, "Posisi tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(pos, k, v)
    db.commit()
    db.refresh(pos)
    return pos


@router.delete("/positions/{pos_id}",
               dependencies=[Depends(require_permission("master:manage"))])
def deactivate_position(pos_id: int, db: Session = Depends(get_db)):
    pos = db.query(JobPosition).filter(JobPosition.id == pos_id).first()
    if not pos:
        raise HTTPException(404, "Posisi tidak ditemukan")
    pos.is_active = False
    db.commit()
    return {"message": "Posisi dinonaktifkan"}
