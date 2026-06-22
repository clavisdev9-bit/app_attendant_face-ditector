import { useState, useEffect } from 'react';
import { masterApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import IconifyIcon from '../components/wrappers/IconifyIcon';
import Badge from '../components/ui/Badge';

const TABS = [
  { id: 'company',  label: 'Perusahaan' },
  { id: 'dept',     label: 'Departemen' },
  { id: 'location', label: 'Lokasi Kerja' },
  { id: 'position', label: 'Jabatan' },
];

function MsgBar({ msg }) {
  if (!msg) return null;
  return (
    <div className={`${msg.type === 'ok' ? 'alert-success' : 'alert-danger'} text-sm mb-4`}>
      <IconifyIcon icon={msg.type === 'ok' ? 'bx:check-circle' : 'bx:error-circle'} className="text-base flex-shrink-0" />
      {msg.text}
    </div>
  );
}

export default function MasterData() {
  const [tab, setTab] = useState('company');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Master Data</h1>
        <p className="page-sub">Kelola data referensi perusahaan</p>
      </div>

      <div className="tab-list">
        {TABS.map((t) => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company'  && <CompanyTab />}
      {tab === 'dept'     && <DeptTab />}
      {tab === 'location' && <LocationTab />}
      {tab === 'position' && <PositionTab />}
    </div>
  );
}

// ── Company ───────────────────────────────────────────────────────────────────
function CompanyTab() {
  const [form,    setForm]    = useState({ company_name: '', company_code: '', address: '', city: '', province: '', phone: '', npwp: '', timezone: 'Asia/Jakarta' });
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState(null);

  useEffect(() => { masterApi.getCompany().then(setForm).catch(() => {}); }, []);

  const handleSave = async () => {
    setLoading(true); setMsg(null);
    try {
      await masterApi.upsertCompany(form);
      setMsg({ type: 'ok', text: 'Data perusahaan disimpan' });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setLoading(false); }
  };

  const FIELDS = [
    ['company_name', 'Nama Perusahaan'],
    ['company_code', 'Kode Perusahaan'],
    ['address',      'Alamat'],
    ['city',         'Kota'],
    ['province',     'Provinsi'],
    ['phone',        'Telepon'],
    ['npwp',         'NPWP'],
    ['timezone',     'Timezone'],
  ];

  return (
    <div className="card max-w-xl">
      <div className="card-header"><h3 className="card-title">Data Perusahaan</h3></div>
      <div className="modal-body space-y-4">
        <MsgBar msg={msg} />
        <div className="form-grid">
          {FIELDS.map(([key, label]) => (
            <div key={key}>
              <label className="input-label">{label}</label>
              <input className="input" value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? <><span className="spinner w-4 h-4" /> Menyimpan…</> : <><IconifyIcon icon="bx:save" className="text-base" /> Simpan</>}
        </button>
      </div>
    </div>
  );
}

// ── Department ────────────────────────────────────────────────────────────────
function DeptTab() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const INIT = { dept_code: '', dept_name: '', is_active: true };
  const [items,   setItems]   = useState([]);
  const [form,    setForm]    = useState(INIT);
  const [editing, setEditing] = useState(null);
  const [msg,     setMsg]     = useState(null);

  const load = () => masterApi.listDepts().then(setItems).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (editing) await masterApi.updateDept(editing, form);
      else await masterApi.createDept(form);
      setMsg({ type: 'ok', text: editing ? 'Departemen diperbarui' : 'Departemen ditambahkan' });
      setForm(INIT); setEditing(null); load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    try {
      await masterApi.deleteDept(id);
      setMsg({ type: 'ok', text: 'Departemen dihapus' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="card">
        <div className="card-header"><h3 className="card-title">Daftar Departemen</h3></div>
        <div className="p-4"><MsgBar msg={msg} /></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Kode</th><th>Nama</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs text-slate-400">{d.dept_code}</td>
                  <td className="font-semibold">{d.dept_name}</td>
                  <td><Badge variant={d.is_active ? 'success' : 'gray'} dot>{d.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn-outline btn-sm text-xs" onClick={() => { setForm(d); setEditing(d.id); }}>
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
                <tr><td colSpan={canEdit ? 4 : 3}><div className="empty-state py-8"><p className="empty-title">Belum ada departemen</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{editing ? 'Edit Departemen' : 'Tambah Departemen'}</h3>
          {editing && <button className="btn-ghost btn-sm text-xs" onClick={() => { setEditing(null); setForm(INIT); }}>Batal</button>}
        </div>
        <div className="modal-body space-y-4">
          {[['dept_code', 'Kode'], ['dept_name', 'Nama Departemen']].map(([k, l]) => (
            <div key={k}>
              <label className="input-label">{l}</label>
              <input className="input" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          {canEdit && (
            <button className="btn-primary" onClick={handleSave}>
              <IconifyIcon icon={editing ? 'bx:save' : 'bx:plus'} className="text-base" />
              {editing ? 'Update' : 'Tambah'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Work Location ─────────────────────────────────────────────────────────────
function LocationTab() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const INIT = { location_code: '', location_name: '', address: '', latitude: '', longitude: '', gps_radius_meters: 100, is_active: true };
  const [items,   setItems]   = useState([]);
  const [form,    setForm]    = useState(INIT);
  const [editing, setEditing] = useState(null);
  const [msg,     setMsg]     = useState(null);

  const load = () => masterApi.listLocations().then(setItems).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      const payload = { ...form, latitude: form.latitude ? parseFloat(form.latitude) : null, longitude: form.longitude ? parseFloat(form.longitude) : null };
      if (editing) await masterApi.updateLocation(editing, payload);
      else await masterApi.createLocation(payload);
      setMsg({ type: 'ok', text: editing ? 'Lokasi diperbarui' : 'Lokasi ditambahkan' });
      setForm(INIT); setEditing(null); load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    try {
      await masterApi.deleteLocation(id);
      setMsg({ type: 'ok', text: 'Lokasi dihapus' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="card">
        <div className="card-header"><h3 className="card-title">Daftar Lokasi</h3></div>
        <div className="p-4"><MsgBar msg={msg} /></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Kode</th><th>Nama</th><th>Radius (m)</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs text-slate-400">{d.location_code}</td>
                  <td className="font-semibold">{d.location_name}</td>
                  <td className="font-mono text-sm">{d.gps_radius_meters}</td>
                  <td><Badge variant={d.is_active ? 'success' : 'gray'} dot>{d.is_active ? 'Aktif' : '—'}</Badge></td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn-outline btn-sm text-xs" onClick={() => { setForm(d); setEditing(d.id); }}>
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
                <tr><td colSpan={canEdit ? 5 : 4}><div className="empty-state py-8"><p className="empty-title">Belum ada lokasi</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{editing ? 'Edit Lokasi' : 'Tambah Lokasi'}</h3>
          {editing && <button className="btn-ghost btn-sm text-xs" onClick={() => { setEditing(null); setForm(INIT); }}>Batal</button>}
        </div>
        <div className="modal-body space-y-3">
          {[
            ['location_code',    'Kode'],
            ['location_name',    'Nama Lokasi'],
            ['address',          'Alamat'],
            ['latitude',         'Latitude'],
            ['longitude',        'Longitude'],
            ['gps_radius_meters','Radius GPS (meter)'],
          ].map(([k, l]) => (
            <div key={k}>
              <label className="input-label">{l}</label>
              <input className="input" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          {canEdit && (
            <button className="btn-primary" onClick={handleSave}>
              <IconifyIcon icon={editing ? 'bx:save' : 'bx:plus'} className="text-base" />
              {editing ? 'Update' : 'Tambah'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Job Position ──────────────────────────────────────────────────────────────
function PositionTab() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(user?.role_code);

  const INIT = { position_code: '', position_name: '', level: '', is_active: true };
  const [items,   setItems]   = useState([]);
  const [form,    setForm]    = useState(INIT);
  const [editing, setEditing] = useState(null);
  const [msg,     setMsg]     = useState(null);

  const load = () => masterApi.listPositions().then(setItems).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (editing) await masterApi.updatePosition(editing, form);
      else await masterApi.createPosition(form);
      setMsg({ type: 'ok', text: 'Jabatan disimpan' });
      setForm(INIT); setEditing(null); load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    try {
      await masterApi.deletePosition(id);
      setMsg({ type: 'ok', text: 'Jabatan dihapus' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="card">
        <div className="card-header"><h3 className="card-title">Daftar Jabatan</h3></div>
        <div className="p-4"><MsgBar msg={msg} /></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Kode</th><th>Nama</th><th>Level</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs text-slate-400">{d.position_code}</td>
                  <td className="font-semibold">{d.position_name}</td>
                  <td className="text-slate-400 text-sm">{d.level || '—'}</td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn-outline btn-sm text-xs" onClick={() => { setForm(d); setEditing(d.id); }}>
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
                <tr><td colSpan={canEdit ? 4 : 3}><div className="empty-state py-8"><p className="empty-title">Belum ada jabatan</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{editing ? 'Edit Jabatan' : 'Tambah Jabatan'}</h3>
          {editing && <button className="btn-ghost btn-sm text-xs" onClick={() => { setEditing(null); setForm(INIT); }}>Batal</button>}
        </div>
        <div className="modal-body space-y-3">
          {[['position_code', 'Kode'], ['position_name', 'Nama Jabatan'], ['level', 'Level/Grade']].map(([k, l]) => (
            <div key={k}>
              <label className="input-label">{l}</label>
              <input className="input" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          {canEdit && (
            <button className="btn-primary" onClick={handleSave}>
              <IconifyIcon icon={editing ? 'bx:save' : 'bx:plus'} className="text-base" />
              {editing ? 'Update' : 'Tambah'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
