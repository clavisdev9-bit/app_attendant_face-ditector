import { useState, useEffect } from 'react';
import { overtimeApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import IconifyIcon from '../components/wrappers/IconifyIcon';
import Badge from '../components/ui/Badge';

const STATUS_MAP   = { pending: 'warning', approved: 'success', rejected: 'danger', completed: 'info' };
const STATUS_LABEL = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak', completed: 'Selesai' };

function MsgBar({ msg }) {
  if (!msg) return null;
  return (
    <div className={`${msg.type === 'ok' ? 'alert-success' : 'alert-danger'} text-sm mb-4`}>
      <IconifyIcon icon={msg.type === 'ok' ? 'bx:check-circle' : 'bx:error-circle'} className="text-base flex-shrink-0" />
      {msg.text}
    </div>
  );
}

const EMPTY_FORM = { employee_id: '', date: '', planned_start: '', planned_end: '', planned_duration_minutes: '', reason: '' };

const EMPTY_RULE = {
  rule_name: '',
  min_duration_minutes: 30,
  max_daily_hours: 3.0,
  max_weekly_hours: 14.0,
  weekday_multiplier: 1.5,
  holiday_multiplier: 2.0,
  requires_pre_approval: true,
  is_active: true,
};

export default function OvertimeManagement() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const [tab,      setTab]      = useState('requests');
  const [items,    setItems]    = useState([]);
  const [rules,    setRules]    = useState([]);
  const [filter,   setFilter]   = useState('pending');
  const [msg,      setMsg]      = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);

  // Rule state
  const [ruleForm,     setRuleForm]     = useState(EMPTY_RULE);
  const [editRuleItem, setEditRuleItem] = useState(null);
  const [ruleMsg,      setRuleMsg]      = useState(null);

  const loadRequests = () => overtimeApi.listRequests(null, filter || null).then(setItems).catch(console.error);
  const loadRules    = () => overtimeApi.listRules().then(setRules).catch(console.error);

  useEffect(() => { loadRequests(); }, [filter]);
  useEffect(() => { loadRules(); }, []);

  const handleAction = async (id, action) => {
    try {
      if (action === 'approve')  await overtimeApi.approve(id);
      else if (action === 'reject') await overtimeApi.reject(id);
      else await overtimeApi.complete(id);
      setMsg({ type: 'ok', text: `Lembur ${action === 'approve' ? 'disetujui' : action === 'reject' ? 'ditolak' : 'selesai'}` });
      loadRequests();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDeleteRequest = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    try {
      await overtimeApi.deleteRequest(id);
      setMsg({ type: 'ok', text: 'Permohonan dihapus' });
      loadRequests();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleCreate = async () => {
    try {
      await overtimeApi.createRequest({ ...form, planned_duration_minutes: form.planned_duration_minutes ? +form.planned_duration_minutes : null });
      setMsg({ type: 'ok', text: 'Permohonan lembur dibuat' });
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadRequests();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const openEditRule = (r) => {
    setEditRuleItem(r);
    setRuleForm({ ...r });
  };

  const handleSaveRule = async () => {
    try {
      if (editRuleItem) {
        await overtimeApi.updateRule(editRuleItem.id, ruleForm);
        setRuleMsg({ type: 'ok', text: 'Aturan lembur diperbarui' });
        setEditRuleItem(null);
      } else {
        await overtimeApi.createRule(ruleForm);
        setRuleMsg({ type: 'ok', text: 'Aturan lembur ditambahkan' });
      }
      setRuleForm(EMPTY_RULE);
      loadRules();
    } catch (e) { setRuleMsg({ type: 'err', text: e.message }); }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Hapus data ini? Aturan akan dinonaktifkan.')) return;
    try {
      await overtimeApi.deleteRule(id);
      setRuleMsg({ type: 'ok', text: 'Aturan dinonaktifkan' });
      loadRules();
    } catch (e) { setRuleMsg({ type: 'err', text: e.message }); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Manajemen Lembur</h1>
          <p className="page-sub">Persetujuan dan pencatatan lembur karyawan</p>
        </div>
        {tab === 'requests' && (
          <button className="btn-primary self-start sm:self-auto" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : <><IconifyIcon icon="bx:plus" className="text-base" /> Permohonan Baru</>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-list">
        {[{ id: 'requests', label: 'Permohonan' }, { id: 'rules', label: 'Aturan Lembur' }].map((t) => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <>
          {/* New request form */}
          {showForm && (
            <div className="card max-w-lg">
              <div className="card-header">
                <h3 className="card-title">Permohonan Lembur Baru</h3>
              </div>
              <div className="modal-body space-y-3">
                {[
                  ['employee_id', 'ID Karyawan', 'text'],
                  ['date', 'Tanggal', 'date'],
                  ['planned_start', 'Jam Mulai Rencana', 'time'],
                  ['planned_end', 'Jam Selesai Rencana', 'time'],
                  ['planned_duration_minutes', 'Durasi Rencana (menit)', 'number'],
                ].map(([k, l, t]) => (
                  <div key={k}>
                    <label className="input-label">{l}</label>
                    <input type={t} className="input" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </div>
                ))}
                <div>
                  <label className="input-label">Alasan</label>
                  <textarea className="input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </div>
                <button className="btn-primary" onClick={handleCreate}>
                  <IconifyIcon icon="bx:send" className="text-base" /> Ajukan
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Daftar Permohonan Lembur</h3>
              <select className="input w-36" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">Semua</option>
                <option value="pending">Pending</option>
                <option value="approved">Disetujui</option>
                <option value="completed">Selesai</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>
            <div className="p-5"><MsgBar msg={msg} /></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID Karyawan</th><th>Tanggal</th><th>Rencana</th>
                    <th>Aktual (mnt)</th><th>Status</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs text-slate-400">{r.employee_id}</td>
                      <td className="font-mono text-sm">{r.date}</td>
                      <td className="font-mono text-sm">
                        {r.planned_start || '—'} – {r.planned_end || '—'}
                        {r.planned_duration_minutes && (
                          <span className="text-slate-400 ml-1.5">({r.planned_duration_minutes}m)</span>
                        )}
                      </td>
                      <td className="font-mono text-sm text-primary-600 dark:text-primary-400">
                        {r.actual_duration_minutes ?? '—'}
                      </td>
                      <td><Badge variant={STATUS_MAP[r.status] || 'gray'}>{STATUS_LABEL[r.status] || r.status}</Badge></td>
                      <td>
                        <div className="flex gap-1.5">
                          {r.status === 'pending' && (
                            <>
                              <button className="btn-primary btn-sm text-xs" onClick={() => handleAction(r.id, 'approve')}>Setujui</button>
                              <button className="btn-danger btn-sm text-xs"  onClick={() => handleAction(r.id, 'reject')}>Tolak</button>
                            </>
                          )}
                          {r.status === 'approved' && (
                            <button className="btn-outline btn-sm text-xs" onClick={() => handleAction(r.id, 'complete')}>Selesai</button>
                          )}
                          {canEdit && (
                            <button className="btn-outline btn-sm text-xs" onClick={() => handleDeleteRequest(r.id)}>
                              <IconifyIcon icon="bx:trash" className="text-sm" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr><td colSpan={6}><div className="empty-state py-8"><p className="empty-title">Tidak ada data</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── RULES TAB ── */}
      {tab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card">
            <div className="card-header"><h3 className="card-title">Aturan Lembur</h3></div>
            <div className="p-4"><MsgBar msg={ruleMsg} /></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Nama</th><th>Max/Hari</th><th>Multiplier</th><th>Status</th>{canEdit && <th>Aksi</th>}</tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold">{r.rule_name}</td>
                      <td className="font-mono text-sm">{r.max_daily_hours} jam</td>
                      <td className="font-mono text-sm">{r.weekday_multiplier}x / {r.holiday_multiplier}x</td>
                      <td><Badge variant={r.is_active ? 'success' : 'gray'} dot>{r.is_active ? 'Aktif' : '—'}</Badge></td>
                      {canEdit && (
                        <td>
                          <div className="flex gap-1.5">
                            <button className="btn-outline btn-sm text-xs" onClick={() => openEditRule(r)}>
                              <IconifyIcon icon="bx:edit" className="text-sm" /> Edit
                            </button>
                            <button className="btn-danger btn-sm text-xs" onClick={() => handleDeleteRule(r.id)}>
                              <IconifyIcon icon="bx:trash" className="text-sm" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!rules.length && (
                    <tr><td colSpan={canEdit ? 5 : 4}><div className="empty-state py-8"><p className="empty-title">Belum ada aturan lembur</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {canEdit && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{editRuleItem ? 'Edit Aturan Lembur' : 'Tambah Aturan Lembur'}</h3>
                {editRuleItem && (
                  <button className="btn-ghost btn-sm text-xs" onClick={() => { setEditRuleItem(null); setRuleForm(EMPTY_RULE); }}>Batal</button>
                )}
              </div>
              <div className="modal-body space-y-3">
                <div>
                  <label className="input-label">Nama Aturan</label>
                  <input className="input" value={ruleForm.rule_name || ''} onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })} />
                </div>
                {[
                  ['min_duration_minutes', 'Min Durasi (menit)', 'number'],
                  ['max_daily_hours',      'Max Harian (jam)',   'number'],
                  ['max_weekly_hours',     'Max Mingguan (jam)', 'number'],
                  ['weekday_multiplier',   'Multiplier Hari Kerja', 'number'],
                  ['holiday_multiplier',   'Multiplier Hari Libur', 'number'],
                ].map(([k, l, t]) => (
                  <div key={k}>
                    <label className="input-label">{l}</label>
                    <input type={t} className="input" step="0.1"
                      value={ruleForm[k] ?? ''}
                      onChange={(e) => setRuleForm({ ...ruleForm, [k]: +e.target.value })} />
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={!!ruleForm.requires_pre_approval}
                    onChange={(e) => setRuleForm({ ...ruleForm, requires_pre_approval: e.target.checked })} />
                  Perlu Pre-Approval
                </label>
                <button className="btn-primary w-full" onClick={handleSaveRule}>
                  <IconifyIcon icon="bx:save" className="text-base" /> {editRuleItem ? 'Simpan Perubahan' : 'Tambah Aturan'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
