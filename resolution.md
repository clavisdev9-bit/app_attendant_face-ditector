# Bug Resolution History — Attendance Face+RFID System

---

## RES-007 — Rekap Bulanan: Karyawan Tidak Muncul Meski Sudah Absen

**Tanggal**   : 2026-06-23
**Modul**     : Reports — Tab Rekap Bulanan
**Severity**  : High — data absen karyawan tidak tercatat di laporan operasional
**Status**    : ✅ RESOLVED

### Gejala
Karyawan ID `0415711041` tidak muncul di Rekap Bulanan meskipun sudah melakukan absensi. Karyawan lain yang punya absen juga bisa terdampak hal yang sama.

### Root Cause — Dua Bug Bersamaan

**Bug A (primer) — Filter `location_id` wajib di backend:**
```python
# SALAH — hanya tampilkan karyawan yang punya location_id
employees = db.query(Employee).filter(
    Employee.location_id == location_id,  # ← NULL = tidak muncul!
    Employee.is_active == True,
).all()
```
Karyawan yang dibuat sebelum fitur lokasi ditambahkan (atau yang tidak diassign ke lokasi) memiliki `location_id = NULL`. Mereka tidak pernah muncul di rekap meskipun punya data absen.

**Bug B (sekunder) — `rekapBulanan` di api.js selalu kirim `location_id`:**
```js
// SALAH — selalu append location_id, tidak bisa query tanpa lokasi
requestV2(`/reports/rekap-bulanan?location_id=${locationId}&year=${year}&month=${month}`)
```

### Fix Applied

| File | Perubahan |
|------|-----------|
| `backend/routers/reports.py` | `location_id: Optional[int] = None` — tanpa filter = semua karyawan aktif |
| `frontend/src/utils/api.js` | `rekapBulanan`: kirim `location_id` hanya jika ada |
| `frontend/src/pages/Reports.jsx` | Dropdown: opsi default "Semua Lokasi" (bukan required); tombol tidak lagi disabled tanpa lokasi; `handleLoadRekap`: pass `null` jika tidak dipilih |

### Pencegahan
- Report yang menggunakan FK filter (location_id, department_id) WAJIB punya opsi "Semua" sebagai fallback
- Filter optional di backend harus `Optional[int] = None`, bukan `int` (required)
- Query employee untuk report TIDAK BOLEH bergantung pada field yang mungkin NULL untuk karyawan lama

---

## RES-006 — Face Enrollment: Wajah Karyawan yang Sudah Dihapus Masih Terdeteksi

**Tanggal**   : 2026-06-23
**Modul**     : Employee — Face Enrollment & Attendance Verify Face
**Severity**  : Critical — operasional terhenti, karyawan baru tidak bisa didaftarkan wajah
**Status**    : ✅ RESOLVED

### Gejala
Error saat mendaftarkan wajah karyawan baru:
```
"Wajah ini sudah terdaftar untuk karyawan 3966841934 (Aristya Rahadiyan).
Setiap karyawan harus menggunakan wajah yang berbeda."
```
Padahal karyawan 3966841934 sudah dihapus dari sistem.

### Root Cause — Dua Bug Bersamaan

**Bug A — `delete_employee` gagal diam-diam karena FK constraint:**

Tabel `contractor_payroll` memiliki FK ke `employees.employee_id` tanpa `ON DELETE CASCADE`. Endpoint `DELETE /api/employees/{id}` tidak membersihkan `contractor_payroll` sebelum hapus employee. Akibatnya:
- `db.delete(emp)` → PostgreSQL raise FK constraint violation
- Transaksi rollback → employee TIDAK terhapus dari DB
- Backend return 500, frontend tampil alert tapi user dismiss → mengira employee sudah terhapus

**Bug B — Face duplicate check tidak filter `is_active`:**
```python
# SALAH — ikut sertakan employee non-aktif/yang "gagal dihapus"
others = db.query(Employee).filter(
    Employee.face_enrolled == True,
    Employee.employee_id != employee_id,
    # ← is_active tidak dicek!
).all()
```
Employee yang masih ada di DB (gagal dihapus) tetap ikut dideteksi.

### Fix Applied

| File | Perubahan |
|------|-----------|
| `backend/main.py` — `delete_employee` | Tambah DELETE dari `contractor_payroll` via raw SQL (savepoint-protected) sebelum `db.delete(emp)` |
| `backend/main.py` — `enroll_face` | Tambah `Employee.is_active == True` ke query duplicate check |
| `backend/main.py` — `verify_face` | Tambah `Employee.is_active == True` ke query cross-check |

### Immediate Fix — SQL (untuk kondisi saat ini)

Jika employee 3966841934 masih ada di DB, jalankan perintah berikut di PostgreSQL:
```sql
-- Cek apakah employee masih ada
SELECT employee_id, name, is_active, face_enrolled
FROM employees WHERE employee_id = '3966841934';

-- Hapus data contractor dulu (jika ada)
DELETE FROM contractor_payroll WHERE employee_id = '3966841934';

-- Hapus employee
DELETE FROM employees WHERE employee_id = '3966841934';
```
Atau cukup clear face encoding-nya saja (tanpa delete employee):
```sql
UPDATE employees
SET face_enrolled = false, face_encoding = null
WHERE employee_id = '3966841934';
```

### Pencegahan
- Setiap tabel baru yang punya FK ke `employees.employee_id` WAJIB ditambahkan ke sequence cleanup di `delete_employee`
- Face duplicate check dan verify-face cross-check SELALU harus filter `is_active == True`

---

## RES-005 — "Failed to fetch" pada Form Tambah & Edit Karyawan (Post-Revert)

**Tanggal**   : 2026-06-23
**Modul**     : Employees — Form Tambah Karyawan & Edit Karyawan
**Severity**  : High — tidak bisa tambah atau edit karyawan sama sekali
**Status**    : ✅ RESOLVED

### Gejala
Klik "Simpan Karyawan" (tambah) atau "Simpan Perubahan" (edit) → error "Failed to fetch". List karyawan tampil (data demo) tanpa pesan error apapun.

### Root Cause — Tiga Level

**Level 1 (primer) — CORS invalid di `main.py`:**
```python
# SALAH — kombinasi ini dilarang oleh browser spec
allow_credentials=True,
allow_origins=["*"],
```
Browser kirim preflight OPTIONS → server balas `Allow-Origin: *` + `Allow-Credentials: true` → browser tolak (spec melarang kombinasi ini) → semua POST/PUT gagal dengan "Failed to fetch".

**Level 2 (sekunder) — `api.js` menggunakan absolute URL, bypass Vite proxy:**
```js
// SALAH — cross-origin request langsung ke port 8000
const BASE_URL = "http://localhost:8000/api";
```
Request tidak melalui Vite proxy → browser membuat cross-origin request → CORS diperlukan → gagal karena Level 1.

**Level 3 (tersier) — `vite.config.js` proxy target Docker-only:**
```js
// SALAH — tidak resolve di luar Docker
target: "http://backend:8000"
```
Jika menggunakan relative URL pun, Vite proxy akan gagal terhubung ke `backend:8000`.

**Level 4 (kuarterner) — `Employees.jsx` menelan error load secara diam-diam:**
```js
// SALAH — user tidak tahu backend down
catch { setEmployees(DEMO_EMPLOYEES); }
```
List tampil normal (demo data), user tidak sadar backend bermasalah → kaget saat form save gagal.

### Fix Applied

| File | Perubahan |
|------|-----------|
| `backend/main.py` | `allow_credentials=False` — Bearer token tidak butuh cookie credentials |
| `frontend/src/utils/api.js` | BASE_URL default ke `"/api"` (relative) — request melalui Vite proxy |
| `frontend/vite.config.js` | Proxy target: `process.env.BACKEND_URL \|\| "http://localhost:8000"` |
| `frontend/src/pages/Employees.jsx` | `isNetworkError()` helper; `backendDown` state + banner; proper catch di `handleSave` dan `handleEditSave` |

### Pencegahan
- `allow_credentials=True` HANYA untuk cookie-based auth dengan explicit origin list (bukan `"*"`)
- api.js WAJIB pakai relative URL sebagai default — lihat `standard.md` §7.1
- vite.config.js WAJIB pakai `process.env.BACKEND_URL || "http://localhost:8000"` — lihat `standard.md` §7.2
- Setiap `load()` yang memanggil API WAJIB membedakan network error vs HTTP error — lihat `standard.md` §3.3

---

## RES-004 — Audit Menyeluruh: Anomali di Semua Modul

**Tanggal**   : 2026-06-23
**Modul**     : Semua modul (12 halaman frontend + 10 router backend)
**Severity**  : High — berbagai anomali sistemik di seluruh codebase
**Status**    : RESOLVED

### Root Cause Pattern — Sistemik

Dua pola anomali sistemik ditemukan di seluruh codebase:

**Frontend:** Semua `load()` menggunakan `.catch(console.error)` atau `.catch(() => {})` tanpa feedback ke user. Ketika backend tidak dapat dijangkau, halaman menampilkan tabel kosong tanpa pesan apapun.

**Backend:** Sejumlah anomali spesifik: endpoint WFH checkin tanpa autentikasi, N+1 query di reports (600+ query/request), validasi status request yang hilang, `datetime.utcnow()` deprecated di Python 3.12+.

### Files Fixed

**Frontend (10 halaman):**

| File | Anomali | Fix |
|------|---------|-----|
| `Reports.jsx` | Silent catch, demo data tanpa banner, duplicate row key | `isNetworkError`, banner, remove DEMO_DATA, fix key |
| `ScanStation.jsx` | `.catch(() => {})` di RecentLog, missing card focus reset | `console.warn` on error, `setCardInput("")` in catch |
| `Shifts.jsx` | Silent catches, NaN di `grace_period_minutes`, `shift_id`, null coercion pada `break_start/end/valid_to` | `isNetworkError`, banner, `parseInt(...) \|\| 0/null` |
| `LeaveManagement.jsx` | 4 tab dengan silent catches, no backend down detection | `isNetworkError`, banner di parent, `onBackendError` prop ke semua tab |
| `OvertimeApproval.jsx` | Silent catches di 3 load calls, no state reset sebelum action | `isNetworkError`, banner, `setMsg(null)` di `submitAction` |
| `OvertimeManagement.jsx` | Silent catches, `employee_id` null coercion, delete button tanpa status guard | `isNetworkError`, banner, FK null coercion, delete hanya untuk `pending` |
| `WFHManagement.jsx` | Sama dengan OvertimeManagement | Sama dengan OvertimeManagement |
| `UserManagement.jsx` | Silent catches, `role_id` bisa `0` (tidak valid FK), toggle tanpa success feedback | `isNetworkError`, banner, `role_id ? +role_id : null`, `setMsg` di `handleToggle` |
| `ContractorReports.jsx` | Silent catches, export tanpa guard | `isNetworkError`, banner, `disabled={!selProject \|\| !data.length}` |
| `ContractorPayroll.jsx` | `<>` tanpa key di `.map()` (React Fragment bug), `fmt` bisa NaN, silent catches | `<React.Fragment key={p.id}>`, `Math.round(n \|\| 0)`, banner |
| `ContractorMaster.jsx` | Silent catches di 4 load functions | `isNetworkError`, banner; `loadSettings` catch: network=setBackendDown, 404=reset to defaults |

**Backend (4 files):**

| File | Anomali | Fix |
|------|---------|-----|
| `routers/wfh.py` | **CRITICAL**: `POST /attendance/wfh-checkin` tanpa autentikasi; tidak ada status guard di approve/reject/delete; tidak ada duplicate guard di create | Tambah `require_permission("attendance:checkin")`; status guard; 409 pada duplikat tanggal |
| `services/wfh_service.py` | GPS/selfie validation silently skip saat required; magic number `99`; no logging di face verify | `ValueError` saat required validation absent; `WFH_UNLIMITED_SENTINEL = 99`; `_log.error(...)` |
| `routers/reports.py` | N+1 query (600+ query/request di payroll, department summary, overtime summary); date param sebagai `str` (manual parse) | Bulk-load dengan `.in_()`, group di Python; `start_date: date` auto-validates |
| `services/auth_service.py` | `datetime.utcnow()` deprecated Python 3.12+; `SECRET_KEY` hardcoded tanpa warning | `datetime.now(timezone.utc)`; `warnings.warn(RuntimeWarning)` di dev |
| `services/contractor_service.py` | `auto_create_overtime_request` bisa block check-out; `calculate_overtime` tidak guard `duration_minutes <= 0` | `try/except` wrap seluruh OT creation; guard negatif durasi |
| `models.py` | Missing index di 6 kolom query-heavy; `skill_level_id` dan `project_id` tanpa `ondelete="SET NULL"` | Tambah `index=True`; 3 composite index (`ContractorPayroll`, `OvertimeRequest`); `ondelete="SET NULL"` |

### Security Fix (CRITICAL)

`POST /api/v2/attendance/wfh-checkin` sebelumnya **sepenuhnya terbuka tanpa autentikasi** — siapa saja bisa submit WFH checkin tanpa token. Endpoint sekarang membutuhkan `require_permission("attendance:checkin")`.

---

## RES-003 — Master Data Tabel Kosong Tanpa Pesan Error

**Tanggal**   : 2026-06-23  
**Modul**     : Master Data — semua tab (Perusahaan, Departemen, Lokasi, Jabatan)  
**Severity**  : High — seluruh modul Master Data tidak bisa memuat data, user tidak tahu kenapa  
**Status**    : ✅ RESOLVED  

### Gejala
Semua tab di modul Master Data menampilkan tabel kosong (empty state) tanpa pesan error.
User melihat banner "Server tidak dapat dijangkau" di halaman Employees (bukan di Master Data).

### Root Cause — Tiga Level

**Level 1 (primer) — `vite.config.js` proxy target salah:**
```js
// SALAH — "backend" adalah Docker service name, tidak resolve di luar Docker
proxy: { "/api": { target: "http://backend:8000" } }
```
Ketika frontend dijalankan tanpa Docker, proxy gagal menghubungi backend.

**Level 2 (sekunder) — `api.js` menggunakan absolute URL, bypass Vite proxy:**
```js
// SALAH — absolute URL melewati Vite proxy, langsung ke port 8000 lintas origin
const BASE_URL = "http://localhost:8000/api";
```
Browser melakukan cross-origin request langsung ke port 8000 → CORS error (jika
`allow_credentials` salah) atau network error (jika backend tidak di port 8000).

**Level 3 (tersier) — `MasterData.jsx` menelan semua error secara diam-diam:**
```js
// SALAH — semua error dibuang tanpa feedback ke user
const load = () => masterApi.listDepts().then(setItems).catch(console.error);
useEffect(() => { masterApi.getCompany().then(setForm).catch(() => {}); }, []);
```
Network error → `catch` → tidak ada state yang berubah → tabel tetap kosong, user tidak tahu.

### Fix Applied

| File | Perubahan |
|------|-----------|
| `frontend/vite.config.js` | Proxy target: `process.env.BACKEND_URL \|\| "http://localhost:8000"` |
| `frontend/src/utils/api.js` | BASE_URL default ke `"/api"` (relative) — request melalui Vite proxy |
| `frontend/src/pages/MasterData.jsx` | Tambah `backendDown` state + banner di parent; `isNetworkError()` helper; fix semua `catch` di 4 tab |

### Fix Detail

```js
// vite.config.js — proxy target dari env var atau localhost default
proxy: {
  "/api": {
    target: process.env.BACKEND_URL || "http://localhost:8000",
    changeOrigin: true,
  },
},
```

```js
// api.js — relative URL by default, proxy handles routing
const BASE_URL = import.meta.env.VITE_API_URL || "/api";
const BASE_V2  = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, "") + "/api/v2"
  : "/api/v2";
```

```jsx
// MasterData.jsx — banner + error propagation
function isNetworkError(e) {
  const msg = e?.message || '';
  return msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('NetworkError');
}

// Parent state + banner
const [backendDown, setBackendDown] = useState(false);
// Banner di JSX, setiap tab menerima onBackendError prop

// Setiap tab load() sekarang:
const load = () => masterApi.listDepts().then(setItems).catch((e) => {
  if (isNetworkError(e)) { onBackendError(); return; }
  setMsg({ type: 'err', text: e.message });
});
```

### Pencegahan
- Vite proxy target WAJIB menggunakan `process.env.BACKEND_URL || "http://localhost:8000"` — tidak hardcode Docker hostname
- api.js WAJIB pakai relative URL (`"/api"`) sebagai default — request harus melalui Vite proxy agar tidak ada CORS issue
- Setiap `load()` yang memanggil API WAJIB membedakan network error vs HTTP error — lihat `standard.md` §3.3
- Network error → `onBackendError()` (page-level banner); HTTP error → `setMsg` (inline error)

### Konfigurasi untuk Docker
```bash
# Jalankan Vite dengan backend hostname Docker
BACKEND_URL=http://backend:8000 npm run dev

# Atau untuk production build dengan absolute URL
VITE_API_URL=http://prod-server:8000/api npm run build
```

---

## RES-002 — CORS Error + 500 pada GET /api/attendance/stats (Dashboard)

**Tanggal**   : 2026-06-23  
**Modul**     : Dashboard — attendanceApi.stats()  
**Severity**  : High — Dashboard tidak dapat memuat data kehadiran  
**Status**    : ✅ RESOLVED  

### Gejala
```
Access to fetch at 'http://localhost:8008/api/attendance/stats' blocked by CORS policy:
  No 'Access-Control-Allow-Origin' header is present.
GET http://localhost:8008/api/attendance/stats net::ERR_FAILED 500
TypeError: Cannot read properties of null (reading 'node') [ApexCharts]
```

### Root Cause — Tiga Level

**Level 1 (primer)** — `attendance_service.py` `get_stats()` line 196:
```python
# SALAH — db.bind tidak tersedia di SQLAlchemy 2.0 (returns None)
func.sum(func.cast(Attendance.status == "late",
    db.bind.dialect.type_descriptor(func.count().type))).label("late")
# AttributeError: 'NoneType' object has no attribute 'dialect'
```
Crash terjadi saat query dibangun → endpoint return 500.

**Level 2 (sekunder)** — CORS config invalid di `main.py`:
`allow_origins=["*"]` + `allow_credentials=True` dilarang oleh browser spec.
Ketika server return 500, CORS middleware tidak sempat attach header → browser blokir response.

**Level 3 (tersier)** — ApexCharts + React 18 Strict Mode:
Double-invoke effect di development menyebabkan chart animation berjalan saat DOM node sudah diganti.

### Fix Applied

| File | Perubahan |
|------|-----------|
| `backend/services/attendance_service.py` | Hapus kolom `late` dari query `daily_data` (tidak dipakai di return value) |
| `backend/main.py` | `allow_credentials=False` — Bearer token tidak butuh cookie credentials |
| `frontend/src/pages/Dashboard.jsx` | `animations: { enabled: false }` di semua chart; null-guard untuk data; safePresent/safeTotal |

### Fix Detail

```python
# attendance_service.py — query diperbaiki
daily_data = (
    db.query(
        Attendance.date,
        func.count(Attendance.id).label("present"),
        # kolom "late" dihapus — tidak digunakan di return value
    )
    .filter(Attendance.date >= thirty_days_ago)
    .group_by(Attendance.date)
    .order_by(Attendance.date)
    .all()
)
```

```python
# main.py — CORS fix
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Bearer token auth — tidak butuh cookie credentials
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Pencegahan
- Jangan gunakan `db.bind` di SQLAlchemy 2.0 — gunakan `func.case()` atau subquery untuk conditional aggregation
- `allow_credentials=True` hanya untuk cookie-based auth dengan explicit origin list
- Semua ApexCharts instance harus `animations: { enabled: false }` atau guard terhadap React Strict Mode

---

## RES-001 — "Failed to fetch" pada Form Tambah Karyawan

**Tanggal**   : 2026-06-23  
**Modul**     : Employees — Form Tambah Karyawan  
**Severity**  : High — fitur tambah karyawan tidak bisa digunakan  
**Status**    : ✅ RESOLVED  

### Gejala
Error "Failed to fetch" muncul saat user klik **Simpan Karyawan** pada modal Tambah Karyawan.
List karyawan tetap tampil (sebenarnya data demo) sehingga user tidak sadar backend bermasalah.

### Root Cause

**Masalah berlapis dua level:**

**Level 1 — Schema Mismatch (primer)**  
Form mengirim `skill_level_id: ""` dan `project_id: ""` (empty string hasil form HTML kosong).  
`EmployeeCreate` schema di `schemas.py` tidak mendefinisikan field ini.  

Jika migration `009_add_contractor_module.py` belum dijalankan:
- Kolom `is_contractor`, `skill_level_id`, `project_id` **belum ada** di tabel `employees` di database
- SQLAlchemy menggenerate `SELECT employees.is_contractor, employees.skill_level_id, ...`
- PostgreSQL mengembalikan error `column "is_contractor" does not exist`
- Server drop connection tanpa mengirim HTTP response
- Browser: **TypeError: Failed to fetch**

**Level 2 — Silent Fallback (sekunder)**  
`load()` menangkap semua error (termasuk "Failed to fetch") dan menampilkan `DEMO_EMPLOYEES` tanpa notifikasi.  
User mengira backend berjalan normal karena tabel tampil berisi data.

### Files yang Diubah

| File | Perubahan |
|------|-----------|
| `backend/schemas.py` | Tambah `is_contractor`, `skill_level_id`, `project_id` ke `EmployeeCreate` dan `EmployeeResponse` |
| `backend/main.py` | `create_employee`: konversi empty string → None untuk FK fields |
| `backend/main.py` | `update_employee`: tambah contractor fields ke allowed list + konversi empty → None |
| `frontend/src/pages/Employees.jsx` | `handleSave`: clean payload (empty string → null) sebelum kirim |
| `frontend/src/pages/Employees.jsx` | `handleSave`: error "Failed to fetch" tampilkan pesan actionable |
| `frontend/src/pages/Employees.jsx` | `load`: set `backendDown=true` + tampilkan banner peringatan server offline |

### Fix Detail

```python
# schemas.py — EmployeeCreate sekarang include contractor fields
class EmployeeCreate(BaseModel):
    ...
    is_contractor:  Optional[bool] = False
    skill_level_id: Optional[int] = None
    project_id:     Optional[int] = None
```

```python
# main.py — create_employee: sanitize FK fields
data = employee.dict()
if not data.get("skill_level_id"):
    data["skill_level_id"] = None
if not data.get("project_id"):
    data["project_id"] = None
```

```js
// Employees.jsx — handleSave: clean payload sebelum submit
const payload = {
  ...form,
  skill_level_id: form.skill_level_id ? Number(form.skill_level_id) : null,
  project_id:     form.project_id     ? Number(form.project_id)     : null,
};
```

### Pencegahan

- FK integer WAJIB dikonversi ke `null` (bukan empty string) — lihat `standard.md` §3.1
- Backend down HARUS ditampilkan sebagai banner, bukan silent fallback — lihat `standard.md` §3.3
- Setiap kolom baru di model wajib ada migrasinya — lihat `standard.md` §6

### Risk Assessment

Perubahan ini **tidak breaking** ke module lain:
- Semua field baru di schema `Optional` dengan default `None`/`False`
- `update_employee` hanya menambah whitelist, tidak mengubah logika existing
- Module Attendance, Leave, Overtime, WFH tidak menyentuh `EmployeeCreate`/`EmployeeResponse`
