import { useState, useRef, useEffect, useCallback } from "react";
import { employeeApi } from "../utils/api";

const DEPARTMENTS = ["Engineering", "Marketing", "HR", "Finance", "Operations", "Sales", "IT", "Legal"];

const EMPTY_FORM = {
  employee_id: "", name: "", department: "", position: "",
  email: "", phone: "", card_uid: "",
  work_start: "08:00", work_end: "17:00", late_tolerance: 15,
};

export default function Employees() {
  const [employees, setEmployees]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [enrollModal, setEnrollModal] = useState(null); // employee object
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await employeeApi.list(deptFilter || undefined);
      setEmployees(data);
    } catch {
      setEmployees(DEMO_EMPLOYEES);
    } finally {
      setLoading(false);
    }
  }, [deptFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await employeeApi.create(form);
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Karyawan</h1>
          <p className="page-sub">{employees.length} karyawan terdaftar</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setError(null); }}>
          + Tambah Karyawan
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input
          className="input"
          placeholder="Cari nama atau ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <select className="input" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Semua Departemen</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <p style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Memuat data...</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nama</th>
                  <th>Departemen</th>
                  <th>Jabatan</th>
                  <th>UID Kartu</th>
                  <th>Wajah</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{emp.employee_id}</td>
                    <td style={{ fontWeight: 700 }}>{emp.name}</td>
                    <td>{emp.department}</td>
                    <td style={{ color: "var(--text-muted)" }}>{emp.position || "-"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{emp.card_uid}</td>
                    <td>
                      <span className={`badge ${emp.face_enrolled ? "badge-present" : "badge-absent"}`}>
                        {emp.face_enrolled ? "✓ Terdaftar" : "✕ Belum"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${emp.is_active ? "badge-present" : "badge-absent"}`}>
                        {emp.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "5px 12px", fontSize: 12 }}
                        onClick={() => setEnrollModal(emp)}
                      >
                        {emp.face_enrolled ? "Update Wajah" : "Daftarkan Wajah"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                      Tidak ada karyawan ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Tambah Karyawan</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {error && (
              <div style={{ background: "var(--red-dim)", border: "1px solid rgba(255,77,106,0.3)", borderRadius: "var(--radius)", padding: 12, marginBottom: 16, color: "var(--red)", fontSize: 13 }}>
                {error}
              </div>
            )}

            <div className="form-grid">
              {[
                { key: "employee_id", label: "ID Karyawan", placeholder: "EMP001" },
                { key: "name",        label: "Nama Lengkap", placeholder: "Budi Santoso" },
                { key: "email",       label: "Email",        placeholder: "budi@company.com" },
                { key: "phone",       label: "No. HP",       placeholder: "08123456789" },
                { key: "position",    label: "Jabatan",      placeholder: "Senior Engineer" },
                { key: "card_uid",    label: "UID Kartu RFID", placeholder: "A1B2C3D4" },
              ].map(({ key, label, placeholder }) => (
                <div className="input-group" key={key}>
                  <label className="input-label">{label}</label>
                  <input
                    className="input"
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}

              <div className="input-group">
                <label className="input-label">Departemen</label>
                <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  <option value="">Pilih departemen</option>
                  {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Toleransi Terlambat (menit)</label>
                <input type="number" className="input" value={form.late_tolerance} min={0} max={60}
                  onChange={(e) => setForm({ ...form, late_tolerance: +e.target.value })} />
              </div>

              <div className="input-group">
                <label className="input-label">Jam Masuk</label>
                <input type="time" className="input" value={form.work_start}
                  onChange={(e) => setForm({ ...form, work_start: e.target.value })} />
              </div>

              <div className="input-group">
                <label className="input-label">Jam Pulang</label>
                <input type="time" className="input" value={form.work_end}
                  onChange={(e) => setForm({ ...form, work_end: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-2 mt-6" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Karyawan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Face Enrollment Modal */}
      {enrollModal && <FaceEnrollModal employee={enrollModal} onClose={() => { setEnrollModal(null); load(); }} />}
    </div>
  );
}

// ─── Face Enrollment Modal ──────────────────────────────────────────────────

function FaceEnrollModal({ employee, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus]     = useState("idle"); // idle | capturing | success | error
  const [message, setMessage]   = useState("");

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    if (videoRef.current) videoRef.current.srcObject = stream;
    streamRef.current = stream;
    setCameraOn(true);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraOn(false);
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    setStatus("capturing");
    canvas.toBlob(async (blob) => {
      try {
        await employeeApi.enrollFace(employee.employee_id, blob);
        setStatus("success");
        setMessage("Wajah berhasil didaftarkan!");
        stopCamera();
      } catch (e) {
        setStatus("error");
        setMessage(e.message);
      }
    }, "image/jpeg", 0.9);
  };

  useEffect(() => { startCamera(); return stopCamera; }, []);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Daftarkan Wajah — {employee.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{
          background: "var(--bg)", borderRadius: "var(--radius)", overflow: "hidden",
          marginBottom: 16, aspectRatio: "4/3", position: "relative"
        }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          {cameraOn && (
            <>
              <div className="corner corner-tl" style={{ top: 20, left: 20 }} />
              <div className="corner corner-tr" style={{ top: 20, right: 20 }} />
              <div className="corner corner-bl" style={{ bottom: 20, left: 20 }} />
              <div className="corner corner-br" style={{ bottom: 20, right: 20 }} />
            </>
          )}
        </div>

        {status === "success" && (
          <div style={{ background: "var(--accent-dim)", border: "1px solid rgba(0,229,176,0.3)", borderRadius: "var(--radius)", padding: 12, marginBottom: 12, color: "var(--accent)", fontSize: 13, textAlign: "center" }}>
            ✓ {message}
          </div>
        )}
        {status === "error" && (
          <div style={{ background: "var(--red-dim)", border: "1px solid rgba(255,77,106,0.3)", borderRadius: "var(--radius)", padding: 12, marginBottom: 12, color: "var(--red)", fontSize: 13 }}>
            ✕ {message}
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Pastikan wajah terlihat jelas, pencahayaan cukup, dan tidak ada obstruksi.
        </p>

        <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>
            {status === "success" ? "Selesai" : "Batal"}
          </button>
          {status !== "success" && (
            <button className="btn btn-primary" onClick={capture} disabled={!cameraOn || status === "capturing"}>
              {status === "capturing" ? "Memproses..." : "⬡ Ambil Foto & Daftarkan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Demo data for when API is unavailable
const DEMO_EMPLOYEES = [
  { employee_id: "EMP001", name: "Budi Santoso", department: "Engineering", position: "Senior Engineer", card_uid: "A1B2C3D4", face_enrolled: true,  is_active: true },
  { employee_id: "EMP002", name: "Sari Dewi",    department: "Marketing",   position: "Marketing Lead",  card_uid: "B2C3D4E5", face_enrolled: true,  is_active: true },
  { employee_id: "EMP003", name: "Ahmad Rauf",   department: "HR",          position: "HR Manager",      card_uid: "C3D4E5F6", face_enrolled: false, is_active: true },
  { employee_id: "EMP004", name: "Linda Putri",  department: "Finance",     position: "Accountant",      card_uid: "D4E5F6A7", face_enrolled: true,  is_active: true },
];
