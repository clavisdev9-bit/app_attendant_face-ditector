# HADIR — Sistem Absensi Face Detection + RFID

Sistem absensi berbasis web dengan verifikasi **dua faktor**: kartu RFID/NFC + pengenalan wajah.

## Arsitektur

```
Frontend (React/Vite) ←──── Browser
         ↕ HTTP REST
Backend (FastAPI/Python)
         ↕ SQLAlchemy ORM
Database (PostgreSQL)
```

## Fitur

- ✅ **Terminal Absensi** — Scan kartu RFID → verifikasi wajah via kamera
- ✅ **Dashboard** — Statistik real-time, tren kehadiran, ringkasan per departemen
- ✅ **Manajemen Karyawan** — CRUD, pendaftaran wajah langsung dari browser
- ✅ **Laporan & Export** — Filter tanggal, export ke Excel (.xlsx)
- ✅ **Anti-spoofing** — Deteksi liveness dasar (variasi antar frame)
- ✅ **Status otomatis** — Hadir / Terlambat / Setengah Hari berdasarkan jadwal karyawan

---

## Cara Menjalankan

### Opsi A: Docker (Direkomendasikan)

```bash
git clone <repo>
cd attendance-system

# Jalankan semua service (DB + Backend + Frontend)
docker compose up --build
```

Akses: http://localhost:3000

---

### Opsi B: Manual

#### 1. Setup PostgreSQL
```bash
# Buat database
createdb attendance_db
```

#### 2. Backend
```bash
cd backend

# Install dependencies
# Catatan: face-recognition membutuhkan cmake dan dlib
pip install -r requirements.txt

# Set environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/attendance_db"

# Jalankan server
uvicorn main:app --reload --port 8000
```

#### 3. Frontend
```bash
cd frontend

npm install
npm run dev
# → http://localhost:3000
```

---

## Konfigurasi RFID Reader

Reader RFID/NFC fisik (RC522, PN532, ACR122U) umumnya bisa dikonfigurasi sebagai **HID Keyboard Emulator** — artinya ketika kartu ditap, UID langsung "diketik" ke input field aktif.

**Pastikan:**
1. Reader terhubung via USB
2. Halaman Terminal Absensi terbuka
3. Kursor fokus di field "Scan Kartu"
4. Tap kartu → UID otomatis terisi + Enter dikirim

Untuk reader yang membutuhkan driver khusus, gunakan library seperti:
- `nfcpy` (Python, terhubung via WebSocket ke frontend)
- `node-hid` (Node.js)

---

## Struktur Proyek

```
attendance-system/
├── backend/
│   ├── main.py              # FastAPI app & routes
│   ├── database.py          # Koneksi PostgreSQL
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── requirements.txt
│   ├── Dockerfile
│   └── services/
│       ├── face_service.py      # Face detection & matching
│       └── attendance_service.py # Business logic absensi
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root + navigasi sidebar
│   │   ├── main.jsx
│   │   ├── pages/
│   │   │   ├── ScanStation.jsx  # Terminal absensi
│   │   │   ├── Dashboard.jsx    # Statistik & grafik
│   │   │   ├── Employees.jsx    # Manajemen karyawan
│   │   │   └── Reports.jsx      # Laporan & export
│   │   ├── utils/
│   │   │   └── api.js           # API client layer
│   │   └── styles/
│   │       └── global.css       # Design system
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
│
└── docker-compose.yml
```

---

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/employees` | Tambah karyawan |
| GET  | `/api/employees` | Daftar karyawan |
| POST | `/api/employees/{id}/enroll-face` | Daftarkan wajah |
| POST | `/api/attendance/card-scan` | Step 1: Tap kartu |
| POST | `/api/attendance/verify-face` | Step 2: Verifikasi wajah |
| GET  | `/api/attendance/today` | Absensi hari ini |
| GET  | `/api/attendance/stats` | Statistik |
| GET  | `/api/attendance/export` | Export data |

Dokumentasi lengkap: http://localhost:8000/docs (Swagger UI)

---

## Tips Produksi

### Face Recognition
```
face_recognition menggunakan dlib — akurat tapi berat.
Untuk edge device (Raspberry Pi), pertimbangkan:
- InsightFace (lebih cepat, akurat)
- MediaPipe Face Mesh (ringan, cocok untuk Pi)
- DeepFace (wrapper berbagai model)
```

### Anti-Spoofing
Untuk keamanan lebih, integrasikan:
- **Silent-Face-Anti-Spoofing** (open source)
- **FaceAntiSpoofing** library
- Kamera IR (infrared) untuk depth sensing

### Hardware Rekomendasi
- **Kamera**: Logitech C920 atau Raspberry Pi Camera Module 3
- **RFID Reader**: ACR122U (USB) atau MFRC522 (GPIO untuk Pi)
- **Mini PC**: Raspberry Pi 4 (4GB RAM) atau Intel NUC

---

## Lisensi

MIT — Bebas digunakan dan dimodifikasi untuk kebutuhan internal perusahaan.
