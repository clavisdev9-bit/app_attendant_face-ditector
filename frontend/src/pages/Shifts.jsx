import { useState, useEffect } from 'react';
import { shiftApi, employeeApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import IconifyIcon from '../components/wrappers/IconifyIcon';
import Badge from '../components/ui/Badge';

const TABS = ['Shift', 'Jadwal Karyawan', 'Hari Libur'];
const WEEKDAY_LABELS = { MON: 'Sen', TUE: 'Sel', WED: 'Rab', THU: 'Kam', FRI: 'Jum', SAT: 'Sab', SUN: 'Min' };
const HOLIDAY_TYPE   = { national: 'Nasional', company: 'Perusahaan', collective_leave: 'Cuti Bersama' };

const EMPTY_SHIFT = {
  shift_code: '', shift_name: '', start_time: '08:00', end_time: '17:00',
  break_start: '12:00', break_end: '13:00', grace_period_minutes: 15,
  crosses_midnight: false, is_active: true,
};
const EMPTY_SCHED = {
  employee_id: '', shift_id: '', valid_from: '', valid_to: '',
  work_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], notes: '',
};
const EMPTY_HOL = { holiday_name: '', date: '', holiday_type: 'national' };

function MsgBar({ msg }) {
  if (!msg) return null;
  return (
    <div className={msg.type === 'ok' ? 'alert-success text-sm mb-4' : 'alert-danger text-sm mb-4'}>
      <IconifyIcon icon={msg.type === 'ok' ? 'bx:check-circle' : 'bx:error-circle'} className="text-base flex-shrink-0" />
      {msg.text}
    </div>
  );
}

export default function Shifts() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const [tab,       setTab]       = useState(0);
  const [shifts,    setShifts]    = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [holidays,  setHolidays]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [shiftModal, setShiftModal] = useState(false);
  const [editShiftItem, setEditShiftItem] = useState(null);
  const [schedModal, setSchedModal] = useState(false);
  const [holModal,   setHolModal]   = useState(false);
  const [form,       setForm]       = useState({});
  const [saving,     setSaving]     = useState(false);
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [schedEmp,   setSchedEmp]   = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [sh, sc, ho, em] = await Promise.all([
        shiftApi.listShifts(),
        shiftApi.listSchedules(),
        shiftApi.listHolidays(year),
        employeeApi.list(),
      ]);
      setShifts(sh); setSchedules(sc); setHolidays(ho); setEmployees(em);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadHolidays() {
    try { setHolidays(await shiftApi.listHolidays(year)); } catch {}
  }
  async function loadSchedules() {
    try { setSchedules(await shiftApi.listSchedules(schedEmp || undefined)); } catch {}
  }

  function openNewShift()  { setForm(EMPTY_SHIFT); setShiftModal(true); }
  function openEditShift(s) {
    setEditShiftItem(s);
    setForm({
      shift_code: s.shift_code,
      shift_name: s.shift_name,
      start_time: s.start_time,
      end_time: s.end_time,
      break_start: s.break_start || '',
      break_end: s.break_end || '',
      grace_period_minutes: s.grace_period_minutes,
      crosses_midnight: s.crosses_midnight,
      is_active: s.is_active,
    });
  }
  function openNewSched() { setForm(EMPTY_SCHED); setSchedModal(true); }
  function openNewHol()   { setForm(EMPTY_HOL);   setHolModal(true); }

  async function saveShift(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (editShiftItem) {
        await shiftApi.updateShift(editShiftItem.id, form);
        setEditShiftItem(null);
      } else {
        await shiftApi.createShift(form);
        setShiftModal(false);
      }
      setShifts(await shiftApi.listShifts());
    }
    catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }
  async function saveSched(e) {
    e.preventDefault(); setSaving(true);
    try { await shiftApi.createSchedule(form); setSchedModal(false); setSchedules(await shiftApi.listSchedules()); }
    catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }
  async function saveHol(e) {
    e.preventDefault(); setSaving(true);
    try { await shiftApi.createHoliday(form); setHolModal(false); setHolidays(await shiftApi.listHolidays(year)); }
    catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }
  async function deleteHol(id) {
    if (!window.confirm('Hapus data ini?')) return;
    try { await shiftApi.deleteHoliday(id); setHolidays((h) => h.filter((x) => x.id !== id)); }
    catch (err) { alert(err.message); }
  }
  async function handleDeleteShift(id) {
    if (!window.confirm('Hapus data ini? Shift akan dinonaktifkan.')) return;
    try { await shiftApi.deleteShift(id); setShifts(await shiftApi.listShifts()); }
    catch (err) { alert(err.message); }
  }
  async function handleDeleteSchedule(id) {
    if (!window.confirm('Hapus data ini?')) return;
    try { await shiftApi.deleteSchedule(id); setSchedules(await shiftApi.listSchedules()); }
    catch (err) { alert(err.message); }
  }

  function toggleDay(day) {
    setForm((f) => {
      const days = f.work_days || [];
      return { ...f, work_days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] };
    });
  }

  const empName   = (id) => employees.find((e) => e.employee_id === id)?.name || id;
  const shiftName = (id) => shifts.find((s) => s.id === parseInt(id))?.shift_name || id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Shift &amp; Jadwal</h1>
        <p className="page-sub">Kelola shift kerja, jadwal karyawan dan hari libur</p>
      </div>

      {error && (
        <div className="alert-danger text-sm">
          <IconifyIcon icon="bx:error-circle" className="text-base flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="tab-list">
        {TABS.map((t, i) => (
          <button key={t} className={`tab-btn ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ── TAB 0: SHIFT ── */}
      {tab === 0 && (
        <div className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <button className="btn-primary" onClick={openNewShift}>
                <IconifyIcon icon="bx:plus" className="text-base" /> Tambah Shift
              </button>
            </div>
          )}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode</th><th>Nama Shift</th><th>Jam Masuk</th><th>Jam Keluar</th>
                    <th>Istirahat</th><th>Grace (mnt)</th><th>Cross Midnight</th><th>Status</th>
                    {canEdit && <th>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={canEdit ? 9 : 8} className="text-center py-8 text-slate-400">Memuat...</td></tr>
                  ) : shifts.length === 0 ? (
                    <tr><td colSpan={canEdit ? 9 : 8} className="text-center py-8 text-slate-400">Belum ada shift</td></tr>
                  ) : shifts.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs text-slate-400">{s.shift_code}</td>
                      <td className="font-semibold">{s.shift_name}</td>
                      <td className="font-mono text-sm text-primary-600 dark:text-primary-400">{s.start_time}</td>
                      <td className="font-mono text-sm text-slate-500">{s.end_time}</td>
                      <td className="text-slate-500 text-sm">{s.break_start} – {s.break_end}</td>
                      <td className="font-mono text-sm">{s.grace_period_minutes}</td>
                      <td>{s.crosses_midnight ? <Badge variant="warning">Ya</Badge> : <span className="text-slate-400">—</span>}</td>
                      <td><Badge variant={s.is_active ? 'success' : 'gray'} dot>{s.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                      {canEdit && (
                        <td>
                          <div className="flex gap-1.5">
                            <button className="btn-outline btn-sm text-xs" onClick={() => openEditShift(s)}>
                              <IconifyIcon icon="bx:edit" className="text-sm" /> Edit
                            </button>
                            <button className="btn-danger btn-sm text-xs" onClick={() => handleDeleteShift(s.id)}>
                              <IconifyIcon icon="bx:trash" className="text-sm" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: JADWAL KARYAWAN ── */}
      {tab === 1 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <select className="input w-64" value={schedEmp} onChange={(e) => setSchedEmp(e.target.value)}>
                <option value="">Semua Karyawan</option>
                {employees.map((e) => (
                  <option key={e.employee_id} value={e.employee_id}>{e.employee_id} — {e.name}</option>
                ))}
              </select>
              <button className="btn-outline" onClick={loadSchedules}>Filter</button>
            </div>
            {canEdit && (
              <button className="btn-primary" onClick={openNewSched}>
                <IconifyIcon icon="bx:plus" className="text-base" /> Assign Jadwal
              </button>
            )}
          </div>
          <div className="card">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Karyawan</th><th>Shift</th><th>Berlaku Dari</th><th>Berlaku Sampai</th>
                    <th>Hari Kerja</th><th>Catatan</th>
                    {canEdit && <th>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={canEdit ? 7 : 6} className="text-center py-8 text-slate-400">Memuat...</td></tr>
                  ) : schedules.length === 0 ? (
                    <tr><td colSpan={canEdit ? 7 : 6} className="text-center py-8 text-slate-400">Belum ada jadwal</td></tr>
                  ) : schedules.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="font-semibold">{empName(s.employee_id)}</div>
                        <div className="font-mono text-xs text-slate-400">{s.employee_id}</div>
                      </td>
                      <td><Badge variant="info">{shiftName(s.shift_id)}</Badge></td>
                      <td className="font-mono text-sm">{s.valid_from}</td>
                      <td className="font-mono text-sm text-slate-400">{s.valid_to || '—'}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(s.work_days || []).map((d) => (
                            <span key={d} className="badge-info text-xs px-1.5 py-0.5 rounded">
                              {WEEKDAY_LABELS[d] || d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-slate-400 text-sm">{s.notes || '—'}</td>
                      {canEdit && (
                        <td>
                          <button className="btn-danger btn-sm text-xs" onClick={() => handleDeleteSchedule(s.id)}>
                            <IconifyIcon icon="bx:trash" className="text-sm" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: HARI LIBUR ── */}
      {tab === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <select className="input w-28" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}
              </select>
              <button className="btn-outline" onClick={loadHolidays}>Tampilkan</button>
            </div>
            {canEdit && (
              <button className="btn-primary" onClick={openNewHol}>
                <IconifyIcon icon="bx:plus" className="text-base" /> Tambah Hari Libur
              </button>
            )}
          </div>
          <div className="card">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Tanggal</th><th>Nama Hari Libur</th><th>Tipe</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400">Memuat...</td></tr>
                  ) : holidays.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400">Tidak ada hari libur tahun {year}</td></tr>
                  ) : holidays.map((h) => (
                    <tr key={h.id}>
                      <td className="font-mono text-sm">{h.date}</td>
                      <td className="font-medium">{h.holiday_name}</td>
                      <td>
                        <Badge variant={h.holiday_type === 'national' ? 'danger' : h.holiday_type === 'company' ? 'success' : 'warning'}>
                          {HOLIDAY_TYPE[h.holiday_type] || h.holiday_type}
                        </Badge>
                      </td>
                      <td>
                        {canEdit && (
                          <button
                            className="btn-icon text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition"
                            onClick={() => deleteHol(h.id)}
                          >
                            <IconifyIcon icon="bx:trash" className="text-base" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SHIFT (Add/Edit) ── */}
      {(shiftModal || editShiftItem) && (
        <div className="modal-overlay" onClick={() => { setShiftModal(false); setEditShiftItem(null); }}>
          <div className="modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editShiftItem ? 'Edit Shift' : 'Tambah Shift Baru'}</h2>
              <button className="modal-close" onClick={() => { setShiftModal(false); setEditShiftItem(null); }}>
                <IconifyIcon icon="bx:x" className="text-lg" />
              </button>
            </div>
            <form onSubmit={saveShift}>
              <div className="modal-body">
                <div className="form-grid">
                  <div>
                    <label className="input-label">Kode Shift</label>
                    <input className="input" placeholder="cth: SHIFT-A" required
                      value={form.shift_code || ''} onChange={(e) => setForm({ ...form, shift_code: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Nama Shift</label>
                    <input className="input" placeholder="cth: Shift Pagi" required
                      value={form.shift_name || ''} onChange={(e) => setForm({ ...form, shift_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Jam Masuk</label>
                    <input className="input" type="time" required
                      value={form.start_time || ''} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Jam Keluar</label>
                    <input className="input" type="time" required
                      value={form.end_time || ''} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Mulai Istirahat</label>
                    <input className="input" type="time"
                      value={form.break_start || ''} onChange={(e) => setForm({ ...form, break_start: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Selesai Istirahat</label>
                    <input className="input" type="time"
                      value={form.break_end || ''} onChange={(e) => setForm({ ...form, break_end: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Toleransi Keterlambatan (mnt)</label>
                    <input className="input" type="number" min={0} max={60}
                      value={form.grace_period_minutes || 0}
                      onChange={(e) => setForm({ ...form, grace_period_minutes: parseInt(e.target.value) })} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="cross-mid"
                      className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      checked={!!form.crosses_midnight}
                      onChange={(e) => setForm({ ...form, crosses_midnight: e.target.checked })}
                    />
                    <label htmlFor="cross-mid" className="text-sm text-slate-600 dark:text-slate-300">Melewati Tengah Malam</label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => { setShiftModal(false); setEditShiftItem(null); }}>Batal</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner w-4 h-4" /> Menyimpan…</> : (editShiftItem ? 'Simpan Perubahan' : 'Simpan Shift')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: JADWAL ── */}
      {schedModal && (
        <div className="modal-overlay" onClick={() => setSchedModal(false)}>
          <div className="modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Assign Jadwal Karyawan</h2>
              <button className="modal-close" onClick={() => setSchedModal(false)}>
                <IconifyIcon icon="bx:x" className="text-lg" />
              </button>
            </div>
            <form onSubmit={saveSched}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="input-label">Karyawan</label>
                  <select className="input" required value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                    <option value="">Pilih karyawan...</option>
                    {employees.map((e) => (
                      <option key={e.employee_id} value={e.employee_id}>{e.employee_id} — {e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Shift</label>
                  <select className="input" required value={form.shift_id || ''} onChange={(e) => setForm({ ...form, shift_id: parseInt(e.target.value) })}>
                    <option value="">Pilih shift...</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.shift_name} ({s.start_time}–{s.end_time})</option>
                    ))}
                  </select>
                </div>
                <div className="form-grid">
                  <div>
                    <label className="input-label">Berlaku Dari</label>
                    <input className="input" type="date" required value={form.valid_from || ''} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Berlaku Sampai (opsional)</label>
                    <input className="input" type="date" value={form.valid_to || ''} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="input-label">Hari Kerja</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {Object.entries(WEEKDAY_LABELS).map(([key, label]) => {
                      const active = (form.work_days || []).includes(key);
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-primary-400'}`}
                          onClick={() => toggleDay(key)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="input-label">Catatan</label>
                  <input className="input" placeholder="Opsional" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setSchedModal(false)}>Batal</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner w-4 h-4" /> Menyimpan…</> : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: HARI LIBUR ── */}
      {holModal && (
        <div className="modal-overlay" onClick={() => setHolModal(false)}>
          <div className="modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Tambah Hari Libur</h2>
              <button className="modal-close" onClick={() => setHolModal(false)}>
                <IconifyIcon icon="bx:x" className="text-lg" />
              </button>
            </div>
            <form onSubmit={saveHol}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="input-label">Nama Hari Libur</label>
                  <input className="input" placeholder="cth: Hari Natal" required
                    value={form.holiday_name || ''} onChange={(e) => setForm({ ...form, holiday_name: e.target.value })} />
                </div>
                <div className="form-grid">
                  <div>
                    <label className="input-label">Tanggal</label>
                    <input className="input" type="date" required value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Tipe</label>
                    <select className="input" value={form.holiday_type || 'national'} onChange={(e) => setForm({ ...form, holiday_type: e.target.value })}>
                      <option value="national">Nasional</option>
                      <option value="company">Perusahaan</option>
                      <option value="collective_leave">Cuti Bersama</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setHolModal(false)}>Batal</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner w-4 h-4" /> Menyimpan…</> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
