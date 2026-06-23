# System Standardization — Attendance Face+RFID

---

## 1. Arsitektur Endpoint

| Layer  | Prefix       | Auth         | Lokasi            |
|--------|--------------|--------------|-------------------|
| v1     | `/api/`      | Tidak ada    | `backend/main.py` |
| v2     | `/api/v2/`   | JWT required | `backend/routers/`|

> **Aturan**: Endpoint baru WAJIB dibuat di v2 (router) dengan `require_permission(...)`.
> Endpoint v1 di main.py hanya dipertahankan untuk backward-compat scanner hardware.

---

## 2. Pydantic Schema Rules

### 2.1 Sinkronisasi Model ↔ Schema
- `EmployeeCreate` HARUS mendefinisikan semua field yang dikirim frontend
- `EmployeeResponse` HARUS mencerminkan field yang dibutuhkan UI
- FK integer fields (mis: `skill_level_id`, `project_id`) wajib `Optional[int] = None`

### 2.2 Extra Fields
- Pydantic v2 default: extra fields diabaikan (`extra='ignore'`)
- Jangan rely pada behavior ini — definisikan field secara eksplisit jika frontend mengirimnya

### 2.3 SQLAlchemy + Migrations
- Kolom baru WAJIB ditambahkan via migration (Alembic), bukan hanya di model
- `Base.metadata.create_all()` hanya membuat tabel baru, tidak ALTER kolom existing
- Model yang referensi FK tabel belum ter-migrate → server error saat query

---

## 3. Frontend Form Data Rules

### 3.1 Payload Cleaning Sebelum Submit
```js
// ✅ BENAR — konversi empty string ke null untuk FK integer
const payload = {
  ...form,
  skill_level_id: form.skill_level_id ? Number(form.skill_level_id) : null,
  project_id:     form.project_id     ? Number(form.project_id)     : null,
};

// ❌ SALAH — mengirim empty string langsung
await api.create(form);
```

### 3.2 Error "Failed to fetch" — Deteksi Network Error
Gunakan helper `isNetworkError()` dan tampilkan pesan yang actionable:
```js
// Helper universal
function isNetworkError(e) {
  const msg = e?.message || '';
  return msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('NetworkError');
}

// Di form action
catch (e) {
  if (isNetworkError(e)) {
    setError('Tidak dapat terhubung ke server. Pastikan backend berjalan di http://localhost:8000.');
  } else {
    setError(e.message);
  }
}
```

### 3.3 Backend Unavailability — Pattern yang Benar
```jsx
// ✅ BENAR — page-level state + banner + error propagation
const [backendDown, setBackendDown] = useState(false);

const load = async () => {
  try {
    const data = await someApi.list();
    setData(data);
    setBackendDown(false);
  } catch (e) {
    if (isNetworkError(e)) {
      setBackendDown(true);         // tampilkan banner
      setData(DEMO_DATA);           // hanya jika ada demo data
    } else {
      setMsg({ type: 'err', text: e.message });  // HTTP error → inline
    }
  }
};

// JSX — banner di atas konten
{backendDown && (
  <div className="alert-danger text-sm">
    <IconifyIcon icon="bx:wifi-off" className="text-base flex-shrink-0" />
    <span>Server tidak dapat dijangkau. Pastikan backend berjalan di <code>http://localhost:8000</code>.</span>
  </div>
)}
```

**Aturan:**
- Network error → `backendDown=true` → banner; HTTP error (4xx/5xx) → `setMsg` inline
- Jangan `catch(console.error)` atau `catch(() => {})` — user harus tahu ada masalah
- Jangan silent fallback ke demo data tanpa banner peringatan

---

## 4. Update Employee — Whitelist Fields

Field yang boleh diupdate via `PUT /api/employees/:id`:
```python
allowed = [
    "name", "department", "position", "email", "phone", "card_uid",
    "work_start", "work_end", "late_tolerance", "is_active",
    "is_contractor", "skill_level_id", "project_id",  # contractor fields
]
```
Field FK integer harus dikonversi ke `None` jika nilai `""` (empty string).

---

## 5. Contractor Module Integration

Karyawan yang `is_contractor=True` harus memiliki:
- `skill_level_id` → FK ke `skill_levels.id`
- `project_id` → FK ke `projects.id`

Saat create/update, jika `is_contractor=False`, kedua field di atas boleh `None`.

---

## 6. CORS Configuration

```python
# ✅ BENAR — Bearer token auth tidak butuh cookie credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # Bearer token = tidak perlu cookie credentials
    allow_methods=["*"],
    allow_headers=["*"],
)

# ❌ SALAH — kombinasi dilarang browser spec; semua POST/PUT gagal dengan "Failed to fetch"
allow_credentials=True,
allow_origins=["*"],
```

**Aturan:**
- `allow_credentials=True` HANYA boleh dikombinasikan dengan explicit origin list (bukan `"*"`)
- Sistem ini memakai Bearer token di header `Authorization` — tidak ada cookie credentials → `allow_credentials=False`
- Jika `allow_credentials=True` + `allow_origins=["*"]`: browser tolak preflight → "Failed to fetch" pada semua non-simple request

---

## 7. Migration Checklist

Setiap kali menambah kolom ke model existing:
- [ ] Buat file migration baru di `backend/migrations/versions/`
- [ ] Jalankan `alembic upgrade head`
- [ ] Verifikasi kolom ada di DB sebelum restart server
- [ ] Update schema Pydantic (EmployeeCreate, EmployeeResponse, dll.)

---

## 8. API Layer Frontend (api.js)

Semua API call WAJIB melalui fungsi di `src/utils/api.js`. Dilarang raw `fetch()` di luar file ini kecuali untuk kasus khusus (mis: FormData upload dengan auth header manual).

### 7.1 URL Configuration

```js
// ✅ BENAR — relative URL by default, Vite proxy handles routing (no CORS)
const BASE_URL = import.meta.env.VITE_API_URL || "/api";
const BASE_V2  = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, "") + "/api/v2"
  : "/api/v2";

// ❌ SALAH — absolute URL bypass Vite proxy → CORS error di development
const BASE_URL = "http://localhost:8000/api";
```

**Kenapa relative?**  
Browser request ke `/api/...` ditangkap Vite dev server → proxy ke backend.
Tidak ada CORS karena browser hanya berkomunikasi dengan satu origin (Vite).

### 7.2 Vite Proxy Configuration

```js
// vite.config.js — WAJIB pakai env var atau localhost default
proxy: {
  "/api": {
    target: process.env.BACKEND_URL || "http://localhost:8000",
    changeOrigin: true,
  },
},

// ❌ SALAH — Docker hostname tidak resolve di luar Docker
proxy: { "/api": { target: "http://backend:8000" } }
```

### 7.3 Environment Variables

| Variable | Scope | Keterangan |
|----------|-------|------------|
| `BACKEND_URL` | Server (Node.js) | Proxy target untuk Vite dev server. Default: `http://localhost:8000` |
| `VITE_API_URL` | Client (browser) | Override BASE_URL untuk production build atau standalone mode |

```bash
# Local dev tanpa Docker — tidak perlu env var apa pun
npm run dev

# Dengan Docker — set BACKEND_URL untuk proxy
BACKEND_URL=http://backend:8000 npm run dev

# Production build dengan backend di URL berbeda
VITE_API_URL=http://prod.example.com/api npm run build
```
