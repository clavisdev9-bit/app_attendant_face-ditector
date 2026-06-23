# Change Request History — Attendance Face+RFID System

| CR-ID  | Tanggal    | Modul            | Deskripsi                                                        | Status |
|--------|------------|------------------|------------------------------------------------------------------|--------|
| CR-001 | 2026-06-01 | All              | Initial setup: FastAPI + React + PostgreSQL + RFID/Face          | Done   |
| CR-002 | 2026-06-05 | Frontend         | Tailwind CSS redesign: corporate blue, dark mode, AppShell baru  | Done   |
| CR-003 | 2026-06-10 | All              | 8 modul baru: RBAC, Master, Shift, Policy, Cuti, Lembur, WFH, Reports | Done |
| CR-004 | 2026-06-15 | Contractor       | Modul Kontraktor: skill level, projects, payroll, approval 1-level | Done |
| CR-005 | 2026-06-23 | Employees        | Bug fix: "Failed to fetch" saat Tambah Karyawan — schema + form cleanup | Done |
| CR-006 | 2026-06-23 | Dashboard        | Bug fix: CORS + 500 pada /api/attendance/stats — SQLAlchemy db.bind + CORS config | Done |
| CR-007 | 2026-06-23 | Master Data + API | Bug fix: Master Data silent empty — Vite proxy target + absolute URL bypass CORS + silent catch | Done |
| CR-008 | 2026-06-23 | All Modules | Audit menyeluruh semua modul: fix silent catches, backendDown banners, backend anomali | Done |
| CR-009 | 2026-06-23 | Employees   | Bug fix (post-revert): "Failed to fetch" pada Tambah/Edit Karyawan — CORS + absolute URL + silent catch | Done |
| CR-010 | 2026-06-23 | Employees   | Bug fix: Face enrollment tolak wajah karyawan yang sudah dihapus — FK constraint block delete + is_active filter missing | Done |
| CR-011 | 2026-06-23 | Reports     | Bug fix: Rekap Bulanan tidak tampilkan karyawan tanpa location_id — location_id wajib → optional, tambah "Semua Lokasi" | Done |
