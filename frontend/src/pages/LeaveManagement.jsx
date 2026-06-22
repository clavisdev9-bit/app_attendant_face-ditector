import { useState, useEffect } from 'react';
import { leaveApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import IconifyIcon from '../components/wrappers/IconifyIcon';
import Badge from '../components/ui/Badge';

const TABS = [
  { id: 'requests',   label: 'Permohonan Cuti' },
  { id: 'balances',   label: 'Saldo Cuti' },
  { id: 'types',      label: 'Jenis Cuti' },
  { id: 'permission', label: 'Izin' },
];

const STATUS_MAP = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'gray' };
const STATUS_LABEL = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' };

function MsgBar({ msg }) {
  if (!msg) return null;
  return (
    <div className={`${msg.type === 'ok' ? 'alert-success' : 'alert-danger'} text-sm mb-4`}>
      <IconifyIcon icon={msg.type === 'ok' ? 'bx:check-circle' : 'bx:error-circle'} className="text-base flex-shrink-0" />
      {msg.text}
    </div>
  );
}

export default function LeaveManagement() {
  const [tab, setTab] = useState('requests');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Manajemen Cuti &amp; Izin</h1>
        <p className="page-sub">Kelola permohonan cuti, saldo, dan jenis cuti</p>
      </div>

      <div className="tab-list">
        {TABS.map((t) => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'requests'   && <LeaveRequestsTab />}
      {tab === 'balances'   && <BalancesTab />}
      {tab === 'types'      && <LeaveTypesTab />}
      {tab === 'permission' && <PermissionTab />}
    </div>
  );
}

function LeaveRequestsTab() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const [items,  setItems]  = useState([]);
  const [filter, setFilter] = useState('pending');
  const [msg,    setMsg]    = useState(null);

  const load = () => leaveApi.listRequests(null, filter || null).then(setItems).catch(console.error);
  useEffect(() => { load(); }, [filter]);

  const handleAction = async (id, action) => {
    try {
      if (action === 'approve') await leaveApi.approve(id, null);
      else if (action === 'reject') await leaveApi.reject(id, null);
      else await leaveApi.cancel(id);
      setMsg({ type: 'ok', text: `Permohonan ${action === 'approve' ? 'disetujui' : 'ditolak'}` });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    try {
      await leaveApi.cancel(id);
      setMsg({ type: 'ok', text: 'Permohonan dibatalkan' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Permohonan Cuti</h3>
        <select className="input w-36" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Semua</option>
          <option value="pending">Pending</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
        </select>
      </div>
      <div className="p-5">
        <MsgBar msg={msg} />
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>ID Karyawan</th><th>Jenis</th><th>Dari</th><th>Sampai</th><th>Hari</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs text-slate-400">{r.employee_id}</td>
                <td>{r.leave_type_id}</td>
                <td className="font-mono text-sm">{r.start_date}</td>
                <td className="font-mono text-sm">{r.end_date}</td>
                <td className="font-mono text-sm text-primary-600 dark:text-primary-400">{r.total_days}</td>
                <td><Badge variant={STATUS_MAP[r.status] || 'gray'}>{STATUS_LABEL[r.status] || r.status}</Badge></td>
                <td>
                  <div className="flex gap-1.5">
                    {r.status === 'pending' && (
                      <>
                        <button className="btn-primary btn-sm text-xs" onClick={() => handleAction(r.id, 'approve')}>Setujui</button>
                        <button className="btn-danger btn-sm text-xs"  onClick={() => handleAction(r.id, 'reject')}>Tolak</button>
                      </>
                    )}
                    {canEdit && r.status === 'pending' && (
                      <button className="btn-outline btn-sm text-xs" onClick={() => handleDelete(r.id)}>
                        <IconifyIcon icon="bx:trash" className="text-sm" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={7}><div className="empty-state py-8"><p className="empty-title">Tidak ada data</p></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BalancesTab() {
  const [items, setItems] = useState([]);
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [msg,   setMsg]   = useState(null);

  useEffect(() => { leaveApi.listBalances(null, year).then(setItems).catch(console.error); }, [year]);

  const handleGenerate = async () => {
    try {
      const r = await leaveApi.generateAnnual(year);
      setMsg({ type: 'ok', text: r.message });
      leaveApi.listBalances(null, year).then(setItems);
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Saldo Cuti Tahun {year}</h3>
        <div className="flex gap-2">
          <input type="number" className="input w-24" value={year} onChange={(e) => setYear(+e.target.value)} />
          <button className="btn-outline btn-sm" onClick={handleGenerate}>Generate Tahunan</button>
        </div>
      </div>
      <div className="p-5"><MsgBar msg={msg} /></div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>ID Karyawan</th><th>Jenis Cuti</th><th>Total</th><th>Carry Over</th><th>Terpakai</th><th>Sisa</th></tr>
          </thead>
          <tbody>
            {items.map((b) => {
              const sisa = b.total_balance + b.carry_over_balance - b.used_balance;
              return (
                <tr key={b.id}>
                  <td className="font-mono text-xs text-slate-400">{b.employee_id}</td>
                  <td>{b.leave_type_id}</td>
                  <td className="font-mono text-sm">{b.total_balance}</td>
                  <td className="font-mono text-sm text-blue-600">{b.carry_over_balance}</td>
                  <td className="font-mono text-sm text-amber-600">{b.used_balance}</td>
                  <td className={`font-mono text-sm font-semibold ${sisa > 0 ? 'text-green-600' : 'text-red-600'}`}>{sisa}</td>
                </tr>
              );
            })}
            {!items.length && (
              <tr><td colSpan={6}><div className="empty-state py-8"><p className="empty-title">Tidak ada data. Klik "Generate Tahunan" untuk membuat saldo.</p></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaveTypesTab() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const INIT = { leave_code: '', leave_name: '', initial_balance_days: 12, max_balance_days: 24, min_advance_days: 1, requires_document: false, allow_half_day: true, carry_over: false, is_active: true };
  const [items,     setItems]     = useState([]);
  const [form,      setForm]      = useState(INIT);
  const [editItem,  setEditItem]  = useState(null);
  const [editForm,  setEditForm]  = useState(INIT);
  const [msg,       setMsg]       = useState(null);

  const load = () => leaveApi.listTypes().then(setItems).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      await leaveApi.createType(form);
      setMsg({ type: 'ok', text: 'Jenis cuti disimpan' });
      setForm(INIT);
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setEditForm({ ...item });
  };

  const handleEditSave = async () => {
    try {
      await leaveApi.updateType(editItem.id, editForm);
      setMsg({ type: 'ok', text: 'Jenis cuti diperbarui' });
      setEditItem(null);
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini? Jenis cuti akan dinonaktifkan.')) return;
    try {
      await leaveApi.deleteType(id);
      setMsg({ type: 'ok', text: 'Jenis cuti dinonaktifkan' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="card">
        <div className="card-header"><h3 className="card-title">Jenis Cuti</h3></div>
        <div className="p-4"><MsgBar msg={msg} /></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Kode</th><th>Nama</th><th>Saldo Awal</th><th>Carry Over</th><th>Status</th>{canEdit && <th>Aksi</th>}</tr></thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs text-slate-400">{d.leave_code}</td>
                  <td className="font-semibold">{d.leave_name}</td>
                  <td className="font-mono text-sm">{d.initial_balance_days} hari</td>
                  <td><Badge variant={d.carry_over ? 'success' : 'gray'}>{d.carry_over ? 'Ya' : 'Tidak'}</Badge></td>
                  <td><Badge variant={d.is_active ? 'success' : 'gray'} dot>{d.is_active ? 'Aktif' : '—'}</Badge></td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn-outline btn-sm text-xs" onClick={() => openEdit(d)}>
                          <IconifyIcon icon="bx:edit" className="text-sm" /> Edit
                        </button>
                        <button className="btn-danger btn-sm text-xs" onClick={() => handleDelete(d.id)}>
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
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{editItem ? 'Edit Jenis Cuti' : 'Tambah Jenis Cuti'}</h3>
          {editItem && (
            <button className="btn-ghost btn-sm text-xs" onClick={() => setEditItem(null)}>Batal</button>
          )}
        </div>
        <div className="modal-body space-y-3">
          {[['leave_code', 'Kode'], ['leave_name', 'Nama Cuti']].map(([k, l]) => (
            <div key={k}>
              <label className="input-label">{l}</label>
              <input className="input"
                value={(editItem ? editForm[k] : form[k]) || ''}
                onChange={(e) => editItem ? setEditForm({ ...editForm, [k]: e.target.value }) : setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          {[['initial_balance_days', 'Saldo Awal (hari)'], ['max_balance_days', 'Saldo Maksimal'], ['min_advance_days', 'Min Pengajuan (hari)']].map(([k, l]) => (
            <div key={k}>
              <label className="input-label">{l}</label>
              <input type="number" className="input"
                value={(editItem ? editForm[k] : form[k]) || 0}
                onChange={(e) => editItem ? setEditForm({ ...editForm, [k]: +e.target.value }) : setForm({ ...form, [k]: +e.target.value })} />
            </div>
          ))}
          <div className="flex flex-wrap gap-4">
            {[['carry_over', 'Carry Over'], ['allow_half_day', '½ Hari'], ['requires_document', 'Butuh Dokumen']].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  checked={!!(editItem ? editForm[k] : form[k])}
                  onChange={(e) => editItem ? setEditForm({ ...editForm, [k]: e.target.checked }) : setForm({ ...form, [k]: e.target.checked })} />
                {l}
              </label>
            ))}
          </div>
          {canEdit && (
            <button className="btn-primary w-full" onClick={editItem ? handleEditSave : handleSave}>
              <IconifyIcon icon="bx:save" className="text-base" /> {editItem ? 'Simpan Perubahan' : 'Simpan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionTab() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const INIT = { permission_code: '', permission_name: '', max_days_per_year: 3, requires_approval: true, requires_document: false, is_active: true };
  const [items,    setItems]    = useState([]);
  const [form,     setForm]     = useState(INIT);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState(INIT);
  const [msg,      setMsg]      = useState(null);

  const load = () => leaveApi.listPermissionTypes().then(setItems).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      await leaveApi.createPermissionType(form);
      setMsg({ type: 'ok', text: 'Jenis izin disimpan' });
      setForm(INIT);
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setEditForm({ ...item });
  };

  const handleEditSave = async () => {
    try {
      await leaveApi.updatePermissionType(editItem.id, editForm);
      setMsg({ type: 'ok', text: 'Jenis izin diperbarui' });
      setEditItem(null);
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini? Jenis izin akan dinonaktifkan.')) return;
    try {
      await leaveApi.deletePermissionType(id);
      setMsg({ type: 'ok', text: 'Jenis izin dinonaktifkan' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="card">
        <div className="card-header"><h3 className="card-title">Jenis Izin</h3></div>
        <div className="p-4"><MsgBar msg={msg} /></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Kode</th><th>Nama</th><th>Max/Tahun</th><th>Status</th>{canEdit && <th>Aksi</th>}</tr></thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs text-slate-400">{d.permission_code}</td>
                  <td className="font-semibold">{d.permission_name}</td>
                  <td className="font-mono text-sm">{d.max_days_per_year} hari</td>
                  <td><Badge variant={d.is_active ? 'success' : 'gray'} dot>{d.is_active ? 'Aktif' : '—'}</Badge></td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn-outline btn-sm text-xs" onClick={() => openEdit(d)}>
                          <IconifyIcon icon="bx:edit" className="text-sm" /> Edit
                        </button>
                        <button className="btn-danger btn-sm text-xs" onClick={() => handleDelete(d.id)}>
                          <IconifyIcon icon="bx:trash" className="text-sm" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={canEdit ? 5 : 4}><div className="empty-state py-8"><p className="empty-title">Belum ada jenis izin</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{editItem ? 'Edit Jenis Izin' : 'Tambah Jenis Izin'}</h3>
          {editItem && (
            <button className="btn-ghost btn-sm text-xs" onClick={() => setEditItem(null)}>Batal</button>
          )}
        </div>
        <div className="modal-body space-y-3">
          {[['permission_code', 'Kode'], ['permission_name', 'Nama Izin']].map(([k, l]) => (
            <div key={k}>
              <label className="input-label">{l}</label>
              <input className="input"
                value={(editItem ? editForm[k] : form[k]) || ''}
                onChange={(e) => editItem ? setEditForm({ ...editForm, [k]: e.target.value }) : setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          <div>
            <label className="input-label">Maks. Hari/Tahun</label>
            <input type="number" className="input"
              value={(editItem ? editForm.max_days_per_year : form.max_days_per_year) || 0}
              onChange={(e) => editItem ? setEditForm({ ...editForm, max_days_per_year: +e.target.value }) : setForm({ ...form, max_days_per_year: +e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-4">
            {[['requires_approval', 'Perlu Approval'], ['requires_document', 'Butuh Dokumen']].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  checked={!!(editItem ? editForm[k] : form[k])}
                  onChange={(e) => editItem ? setEditForm({ ...editForm, [k]: e.target.checked }) : setForm({ ...form, [k]: e.target.checked })} />
                {l}
              </label>
            ))}
          </div>
          {canEdit && (
            <button className="btn-primary w-full" onClick={editItem ? handleEditSave : handleSave}>
              <IconifyIcon icon="bx:save" className="text-base" /> {editItem ? 'Simpan Perubahan' : 'Simpan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
