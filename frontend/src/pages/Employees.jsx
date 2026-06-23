import { useState, useRef, useEffect, useCallback } from 'react';
import { employeeApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import IconifyIcon from '../components/wrappers/IconifyIcon';
import { PageSpinner } from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';

const DEPARTMENTS = ['Engineering', 'Marketing', 'HR', 'Finance', 'Operations', 'Sales', 'IT', 'Legal'];

function isNetworkError(e) {
  const msg = e?.message || '';
  return msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('NetworkError');
}

const EMPTY_FORM = {
  employee_id: '', name: '', department: '', position: '',
  email: '', phone: '', card_uid: '',
  work_start: '08:00', work_end: '17:00', late_tolerance: 15,
};

export default function Employees() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const [employees,    setEmployees]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [enrollModal,  setEnrollModal]  = useState(null);
  const [editItem,     setEditItem]     = useState(null);
  const [editForm,     setEditForm]     = useState(EMPTY_FORM);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);
  const [editError,    setEditError]    = useState(null);
  const [backendDown,  setBackendDown]  = useState(false);
  const [search,       setSearch]       = useState('');
  const [deptFilter,   setDeptFilter]   = useState('');
  const [rfidReading,  setRfidReading]  = useState(false);
  const rfidRef = useRef(null);
  const rfidBuf = useRef('');

  const startRfid = useCallback(() => {
    rfidBuf.current = '';
    if (rfidRef.current) rfidRef.current.value = '';
    setRfidReading(true);
    setTimeout(() => rfidRef.current?.focus(), 50);
  }, []);

  const stopRfid = useCallback(() => {
    setRfidReading(false);
    rfidBuf.current = '';
    if (rfidRef.current) rfidRef.current.value = '';
  }, []);

  const onRfidKey = useCallback((e) => {
    if (e.key === 'Enter') {
      const uid = rfidBuf.current.trim();
      if (uid) setForm((f) => ({ ...f, card_uid: uid }));
      stopRfid();
    } else if (e.key.length === 1) {
      rfidBuf.current += e.key;
    }
  }, [stopRfid]);

  const load = useCallback(async () => {
    try {
      const data = await employeeApi.list(deptFilter || undefined);
      setEmployees(data);
      setBackendDown(false);
    } catch (e) {
      if (isNetworkError(e)) {
        setBackendDown(true);
        setEmployees(DEMO_EMPLOYEES);
      } else {
        console.error(e);
      }
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
      stopRfid();
      load();
    } catch (e) {
      if (isNetworkError(e)) {
        setError('Tidak dapat terhubung ke server. Pastikan backend berjalan.');
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (emp) => {
    setEditItem(emp);
    setEditForm({
      employee_id: emp.employee_id,
      name: emp.name || '',
      department: emp.department || '',
      position: emp.position || '',
      email: emp.email || '',
      phone: emp.phone || '',
      card_uid: emp.card_uid || '',
      work_start: emp.work_start || '08:00',
      work_end: emp.work_end || '17:00',
      late_tolerance: emp.late_tolerance ?? 15,
      is_active: emp.is_active !== undefined ? emp.is_active : true,
    });
    setEditError(null);
  };

  const handleEditSave = async () => {
    setSaving(true);
    setEditError(null);
    try {
      await employeeApi.update(editItem.employee_id, editForm);
      setEditItem(null);
      load();
    } catch (e) {
      if (isNetworkError(e)) {
        setEditError('Tidak dapat terhubung ke server. Pastikan backend berjalan.');
      } else {
        setEditError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus permanen karyawan ini? Seluruh data termasuk riwayat absensi akan dihapus dan tidak dapat dikembalikan.')) return;
    try {
      await employeeApi.delete(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Karyawan</h1>
          <p className="page-sub">{employees.length} karyawan terdaftar</p>
        </div>
        {canEdit && (
          <button className="btn-primary self-start sm:self-auto" onClick={() => { setShowModal(true); setError(null); }}>
            <IconifyIcon icon="bx:plus" className="text-base" />
            Tambah Karyawan
          </button>
        )}
      </div>

      {/* Backend down banner */}
      {backendDown && (
        <div className="alert-danger text-sm">
          <IconifyIcon icon="bx:wifi-off" className="text-base flex-shrink-0" />
          <span>Server tidak dapat dijangkau. Pastikan backend berjalan di <code>http://localhost:8000</code>. Data yang ditampilkan adalah data contoh.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <IconifyIcon icon="bx:search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
          <input
            className="input pl-9 w-64"
            placeholder="Cari nama atau ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-48" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">Semua Departemen</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID Karyawan</th>
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
                  <td className="font-mono text-xs text-slate-400">{emp.employee_id}</td>
                  <td className="font-semibold text-slate-800 dark:text-slate-100">{emp.name}</td>
                  <td>{emp.department}</td>
                  <td className="text-slate-500">{emp.position || '—'}</td>
                  <td className="font-mono text-xs text-slate-500">{emp.card_uid || '—'}</td>
                  <td>
                    <Badge variant={emp.face_enrolled ? 'success' : 'danger'} dot>
                      {emp.face_enrolled ? 'Terdaftar' : 'Belum'}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={emp.is_active ? 'success' : 'gray'} dot>
                      {emp.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        className="btn-outline btn-sm text-xs"
                        onClick={() => setEnrollModal(emp)}
                      >
                        <IconifyIcon icon="bx:face" className="text-sm" />
                        {emp.face_enrolled ? 'Update Wajah' : 'Daftarkan Wajah'}
                      </button>
                      {canEdit && (
                        <>
                          <button className="btn-outline btn-sm text-xs" onClick={() => openEdit(emp)}>
                            <IconifyIcon icon="bx:edit" className="text-sm" /> Edit
                          </button>
                          <button className="btn-danger btn-sm text-xs" onClick={() => handleDelete(emp.employee_id)}>
                            <IconifyIcon icon="bx:trash" className="text-sm" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state py-10">
                      <IconifyIcon icon="bx:user-x" className="empty-icon" />
                      <p className="empty-title">Tidak ada karyawan ditemukan</p>
                      <p className="empty-sub">Coba ubah filter pencarian</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); stopRfid(); }}>
          <div className="modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Tambah Karyawan</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); stopRfid(); }}>
                <IconifyIcon icon="bx:x" className="text-lg" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {error && (
                <div className="alert-danger text-sm">
                  <IconifyIcon icon="bx:error-circle" className="text-base flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="form-grid">
                {[
                  { key: 'employee_id', label: 'ID Karyawan',  placeholder: 'EMP001' },
                  { key: 'name',        label: 'Nama Lengkap', placeholder: 'Budi Santoso' },
                  { key: 'email',       label: 'Email',        placeholder: 'budi@company.com' },
                  { key: 'phone',       label: 'No. HP',       placeholder: '08123456789' },
                  { key: 'position',    label: 'Jabatan',      placeholder: 'Senior Engineer' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="input-label">{label}</label>
                    <input
                      className="input"
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}

                {/* UID Kartu RFID — tap-to-read dari physical card */}
                <div>
                  <label className="input-label">UID Kartu RFID</label>
                  <div className="flex gap-2">
                    <input
                      className={`input font-mono flex-1 ${rfidReading ? 'ring-2 ring-amber-400 border-amber-400' : ''}`}
                      placeholder={rfidReading ? 'Tap kartu sekarang…' : 'Tap kartu atau ketik UID'}
                      value={form.card_uid}
                      readOnly={rfidReading}
                      onChange={(e) => !rfidReading && setForm({ ...form, card_uid: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={rfidReading ? stopRfid : startRfid}
                      className={rfidReading ? 'btn-danger btn-sm whitespace-nowrap' : 'btn-outline btn-sm whitespace-nowrap'}
                    >
                      <IconifyIcon icon={rfidReading ? 'bx:x' : 'bx:credit-card'} className="text-base" />
                      {rfidReading ? 'Batal' : 'Tap Kartu'}
                    </button>
                  </div>
                  {rfidReading && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Menunggu tap kartu RFID pada reader…
                    </p>
                  )}
                  {/* Hidden input — fokus saat mode tap, menangkap keystroke dari HID reader */}
                  <input
                    ref={rfidRef}
                    type="text"
                    className="sr-only"
                    tabIndex={-1}
                    onKeyDown={onRfidKey}
                    onChange={(e) => { rfidBuf.current = e.target.value; }}
                  />
                </div>

                <div>
                  <label className="input-label">Departemen</label>
                  <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                    <option value="">Pilih departemen</option>
                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="input-label">Toleransi Terlambat (menit)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.late_tolerance}
                    min={0}
                    max={60}
                    onChange={(e) => setForm({ ...form, late_tolerance: +e.target.value })}
                  />
                </div>

                <div>
                  <label className="input-label">Jam Masuk</label>
                  <input
                    type="time"
                    className="input"
                    value={form.work_start}
                    onChange={(e) => setForm({ ...form, work_start: e.target.value })}
                  />
                </div>

                <div>
                  <label className="input-label">Jam Pulang</label>
                  <input
                    type="time"
                    className="input"
                    value={form.work_end}
                    onChange={(e) => setForm({ ...form, work_end: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => { setShowModal(false); stopRfid(); }}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <><span className="spinner w-4 h-4" /> Menyimpan…</>
                ) : (
                  <><IconifyIcon icon="bx:save" className="text-base" /> Simpan Karyawan</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Karyawan</h2>
              <button className="modal-close" onClick={() => setEditItem(null)}>
                <IconifyIcon icon="bx:x" className="text-lg" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {editError && (
                <div className="alert-danger text-sm">
                  <IconifyIcon icon="bx:error-circle" className="text-base flex-shrink-0" />
                  {editError}
                </div>
              )}

              <div className="form-grid">
                {[
                  { key: 'name',     label: 'Nama Lengkap', placeholder: 'Budi Santoso' },
                  { key: 'email',    label: 'Email',        placeholder: 'budi@company.com' },
                  { key: 'phone',    label: 'No. HP',       placeholder: '08123456789' },
                  { key: 'position', label: 'Jabatan',      placeholder: 'Senior Engineer' },
                  { key: 'card_uid', label: 'UID Kartu RFID', placeholder: 'A1B2C3D4' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="input-label">{label}</label>
                    <input
                      className="input"
                      placeholder={placeholder}
                      value={editForm[key] || ''}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    />
                  </div>
                ))}

                <div>
                  <label className="input-label">Departemen</label>
                  <select className="input" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}>
                    <option value="">Pilih departemen</option>
                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="input-label">Toleransi Terlambat (menit)</label>
                  <input
                    type="number"
                    className="input"
                    value={editForm.late_tolerance}
                    min={0}
                    max={60}
                    onChange={(e) => setEditForm({ ...editForm, late_tolerance: +e.target.value })}
                  />
                </div>

                <div>
                  <label className="input-label">Jam Masuk</label>
                  <input
                    type="time"
                    className="input"
                    value={editForm.work_start}
                    onChange={(e) => setEditForm({ ...editForm, work_start: e.target.value })}
                  />
                </div>

                <div>
                  <label className="input-label">Jam Pulang</label>
                  <input
                    type="time"
                    className="input"
                    value={editForm.work_end}
                    onChange={(e) => setEditForm({ ...editForm, work_end: e.target.value })}
                  />
                </div>

                {/* Status toggle */}
                <div className="col-span-full">
                  <label className="input-label">Status Karyawan</label>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${editForm.is_active ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${editForm.is_active ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                    <span className={`text-sm font-medium ${editForm.is_active ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                      {editForm.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setEditItem(null)}>Batal</button>
              <button className="btn-primary" onClick={handleEditSave} disabled={saving}>
                {saving ? (
                  <><span className="spinner w-4 h-4" /> Menyimpan…</>
                ) : (
                  <><IconifyIcon icon="bx:save" className="text-base" /> Simpan Perubahan</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Face Enrollment Modal */}
      {enrollModal && (
        <FaceEnrollModal
          employee={enrollModal}
          onClose={() => { setEnrollModal(null); load(); }}
        />
      )}
    </div>
  );
}

/* ── Face Enrollment Modal ──────────────────────────────────────────────────── */
function FaceEnrollModal({ employee, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [status,   setStatus]   = useState('idle'); // idle | capturing | success | error
  const [message,  setMessage]  = useState('');

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
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
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    setStatus('capturing');
    canvas.toBlob(async (blob) => {
      try {
        await employeeApi.enrollFace(employee.employee_id, blob);
        setStatus('success');
        setMessage('Wajah berhasil didaftarkan!');
        stopCamera();
      } catch (e) {
        setStatus('error');
        setMessage(e.message);
      }
    }, 'image/jpeg', 0.9);
  };

  useEffect(() => { startCamera(); return stopCamera; }, []);

  return (
    <div className="modal-overlay">
      <div className="modal animate-scale-in">
        <div className="modal-header">
          <h2 className="modal-title">Daftarkan Wajah — {employee.name}</h2>
          <button className="modal-close" onClick={onClose}>
            <IconifyIcon icon="bx:x" className="text-lg" />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {/* Camera viewport */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {cameraOn && (
              <>
                {/* Corner guides */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary-400 rounded-tl-sm" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary-400 rounded-tr-sm" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary-400 rounded-bl-sm" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary-400 rounded-br-sm" />
              </>
            )}
          </div>

          {status === 'success' && (
            <div className="alert-success text-sm">
              <IconifyIcon icon="bx:check-circle" className="text-base flex-shrink-0" />
              {message}
            </div>
          )}
          {status === 'error' && (
            <div className="alert-danger text-sm">
              <IconifyIcon icon="bx:error-circle" className="text-base flex-shrink-0" />
              {message}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Pastikan wajah terlihat jelas, pencahayaan cukup, dan tidak ada obstruksi.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>
            {status === 'success' ? 'Selesai' : 'Batal'}
          </button>
          {status !== 'success' && (
            <button
              className="btn-primary"
              onClick={capture}
              disabled={!cameraOn || status === 'capturing'}
            >
              {status === 'capturing' ? (
                <><span className="spinner w-4 h-4" /> Memproses…</>
              ) : (
                <><IconifyIcon icon="bx:camera" className="text-base" /> Ambil Foto &amp; Daftarkan</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const DEMO_EMPLOYEES = [
  { employee_id: 'EMP001', name: 'Budi Santoso', department: 'Engineering', position: 'Senior Engineer', card_uid: 'A1B2C3D4', face_enrolled: true,  is_active: true  },
  { employee_id: 'EMP002', name: 'Sari Dewi',    department: 'Marketing',   position: 'Marketing Lead',  card_uid: 'B2C3D4E5', face_enrolled: true,  is_active: true  },
  { employee_id: 'EMP003', name: 'Ahmad Rauf',   department: 'HR',          position: 'HR Manager',      card_uid: 'C3D4E5F6', face_enrolled: false, is_active: true  },
  { employee_id: 'EMP004', name: 'Linda Putri',  department: 'Finance',     position: 'Accountant',      card_uid: 'D4E5F6A7', face_enrolled: true,  is_active: true  },
];
