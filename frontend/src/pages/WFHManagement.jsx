import { useState, useEffect } from 'react';
import { wfhApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import IconifyIcon from '../components/wrappers/IconifyIcon';
import Badge from '../components/ui/Badge';

const STATUS_MAP   = { pending: 'warning', approved: 'success', rejected: 'danger' };
const STATUS_LABEL = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' };

function MsgBar({ msg }) {
  if (!msg) return null;
  return (
    <div className={`${msg.type === 'ok' ? 'alert-success' : 'alert-danger'} text-sm mb-4`}>
      <IconifyIcon icon={msg.type === 'ok' ? 'bx:check-circle' : 'bx:error-circle'} className="text-base flex-shrink-0" />
      {msg.text}
    </div>
  );
}

const EMPTY_RULE = {
  rule_name: '',
  max_wfh_days_per_week: 0,
  require_selfie: true,
  require_gps_validation: true,
  gps_radius_override_meters: null,
  requires_manager_approval: true,
  is_active: true,
};

export default function WFHManagement() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const [tab,      setTab]      = useState('requests');
  const [items,    setItems]    = useState([]);
  const [rules,    setRules]    = useState([]);
  const [filter,   setFilter]   = useState('pending');
  const [msg,      setMsg]      = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ employee_id: '', date: '', reason: '' });

  // Rule state
  const [ruleForm,     setRuleForm]     = useState(EMPTY_RULE);
  const [editRuleItem, setEditRuleItem] = useState(null);
  const [ruleMsg,      setRuleMsg]      = useState(null);

  const loadRequests = () => {
    wfhApi.listRequests(null, filter || null).then(setItems).catch(console.error);
  };
  const loadRules = () => {
    wfhApi.listRules().then(setRules).catch(console.error);
  };

  useEffect(() => { loadRequests(); }, [filter]);
  useEffect(() => { loadRules(); }, []);

  const handleAction = async (id, action) => {
    try {
      if (action === 'approve') await wfhApi.approve(id);
      else await wfhApi.reject(id);
      setMsg({ type: 'ok', text: `WFH ${action === 'approve' ? 'disetujui' : 'ditolak'}` });
      loadRequests();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDeleteRequest = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    try {
      await wfhApi.deleteRequest(id);
      setMsg({ type: 'ok', text: 'Permohonan WFH dihapus' });
      loadRequests();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleCreate = async () => {
    try {
      await wfhApi.createRequest(form);
      setMsg({ type: 'ok', text: 'Permohonan WFH dibuat' });
      setShowForm(false);
      setForm({ employee_id: '', date: '', reason: '' });
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
        await wfhApi.updateRule(editRuleItem.id, ruleForm);
        setRuleMsg({ type: 'ok', text: 'Aturan WFH diperbarui' });
        setEditRuleItem(null);
      } else {
        await wfhApi.createRule(ruleForm);
        setRuleMsg({ type: 'ok', text: 'Aturan WFH ditambahkan' });
      }
      setRuleForm(EMPTY_RULE);
      loadRules();
    } catch (e) { setRuleMsg({ type: 'err', text: e.message }); }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Hapus data ini? Aturan akan dinonaktifkan.')) return;
    try {
      await wfhApi.deleteRule(id);
      setRuleMsg({ type: 'ok', text: 'Aturan WFH dinonaktifkan' });
      loadRules();
    } catch (e) { setRuleMsg({ type: 'err', text: e.message }); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Work From Home</h1>
          <p className="page-sub">Kelola permohonan dan aturan WFH</p>
        </div>
        {tab === 'requests' && (
          <button className="btn-primary self-start sm:self-auto" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : <><IconifyIcon icon="bx:plus" className="text-base" /> Permohonan WFH</>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-list">
        {[{ id: 'requests', label: 'Permohonan' }, { id: 'rules', label: 'Aturan WFH' }].map((t) => (
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
            <div className="card max-w-sm">
              <div className="card-header"><h3 className="card-title">Permohonan WFH Baru</h3></div>
              <div className="modal-body space-y-3">
                {[['employee_id', 'ID Karyawan', 'text'], ['date', 'Tanggal', 'date']].map(([k, l, t]) => (
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

          {/* Requests list */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Daftar Permohonan WFH</h3>
              <select className="input w-36" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">Semua</option>
                <option value="pending">Pending</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>
            <div className="p-5"><MsgBar msg={msg} /></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>ID Karyawan</th><th>Tanggal</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs text-slate-400">{r.employee_id}</td>
                      <td className="font-mono text-sm">{r.date}</td>
                      <td className="text-slate-400 text-sm">{r.reason || '—'}</td>
                      <td><Badge variant={STATUS_MAP[r.status] || 'gray'}>{STATUS_LABEL[r.status] || r.status}</Badge></td>
                      <td>
                        <div className="flex gap-1.5">
                          {r.status === 'pending' && (
                            <>
                              <button className="btn-primary btn-sm text-xs" onClick={() => handleAction(r.id, 'approve')}>Setujui</button>
                              <button className="btn-danger btn-sm text-xs"  onClick={() => handleAction(r.id, 'reject')}>Tolak</button>
                            </>
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
                    <tr><td colSpan={5}><div className="empty-state py-8"><p className="empty-title">Tidak ada data</p></div></td></tr>
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
            <div className="card-header">
              <h3 className="card-title">Aturan WFH ({rules.length} rule)</h3>
            </div>
            <div className="p-4"><MsgBar msg={ruleMsg} /></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Nama</th><th>Max/Minggu</th><th>GPS</th><th>Selfie</th><th>Perlu Approval</th><th>Status</th>{canEdit && <th>Aksi</th>}</tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold">{r.rule_name}</td>
                      <td className="font-mono text-sm">{r.max_wfh_days_per_week === 99 ? '∞' : r.max_wfh_days_per_week} hari</td>
                      <td><Badge variant={r.require_gps_validation ? 'success' : 'gray'}>{r.require_gps_validation ? 'Ya' : 'Tidak'}</Badge></td>
                      <td><Badge variant={r.require_selfie ? 'success' : 'gray'}>{r.require_selfie ? 'Ya' : 'Tidak'}</Badge></td>
                      <td><Badge variant={r.requires_manager_approval ? 'warning' : 'info'}>{r.requires_manager_approval ? 'Ya' : 'Auto'}</Badge></td>
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
                    <tr><td colSpan={canEdit ? 7 : 6}><div className="empty-state py-8"><p className="empty-title">Belum ada aturan WFH</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {canEdit && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{editRuleItem ? 'Edit Aturan WFH' : 'Tambah Aturan WFH'}</h3>
                {editRuleItem && (
                  <button className="btn-ghost btn-sm text-xs" onClick={() => { setEditRuleItem(null); setRuleForm(EMPTY_RULE); }}>Batal</button>
                )}
              </div>
              <div className="modal-body space-y-3">
                <div>
                  <label className="input-label">Nama Aturan</label>
                  <input className="input" value={ruleForm.rule_name || ''} onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Max WFH per Minggu (hari)</label>
                  <input type="number" className="input" min={0}
                    value={ruleForm.max_wfh_days_per_week ?? 0}
                    onChange={(e) => setRuleForm({ ...ruleForm, max_wfh_days_per_week: +e.target.value })} />
                </div>
                <div>
                  <label className="input-label">GPS Radius Override (meter, opsional)</label>
                  <input type="number" className="input" min={0}
                    value={ruleForm.gps_radius_override_meters ?? ''}
                    onChange={(e) => setRuleForm({ ...ruleForm, gps_radius_override_meters: e.target.value ? +e.target.value : null })} />
                </div>
                <div className="flex flex-wrap gap-4">
                  {[['require_selfie', 'Wajib Selfie'], ['require_gps_validation', 'Validasi GPS'], ['requires_manager_approval', 'Perlu Approval Manager']].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        checked={!!ruleForm[k]}
                        onChange={(e) => setRuleForm({ ...ruleForm, [k]: e.target.checked })} />
                      {l}
                    </label>
                  ))}
                </div>
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
