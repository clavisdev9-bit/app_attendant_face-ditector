import { useState, useEffect } from 'react';
import { userApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import IconifyIcon from '../components/wrappers/IconifyIcon';
import Badge from '../components/ui/Badge';

function MsgBar({ msg }) {
  if (!msg) return null;
  return (
    <div className={`${msg.type === 'ok' ? 'alert-success' : 'alert-danger'} text-sm mb-4`}>
      <IconifyIcon icon={msg.type === 'ok' ? 'bx:check-circle' : 'bx:error-circle'} className="text-base flex-shrink-0" />
      {msg.text}
    </div>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const canEdit = ['super_admin', 'admin', 'hr_staff'].includes(currentUser?.role_code);

  const [users,    setUsers]    = useState([]);
  const [roles,    setRoles]    = useState([]);
  const [form,     setForm]     = useState({ username: '', password: '', role_id: '', employee_id: '' });
  const [msg,      setMsg]      = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ role_id: '', password: '' });

  const load = () => {
    userApi.listUsers().then(setUsers).catch(console.error);
    userApi.listRoles().then(setRoles).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.username || !form.password || !form.role_id) {
      setMsg({ type: 'err', text: 'Username, password, dan role wajib diisi' });
      return;
    }
    try {
      await userApi.createUser({ ...form, role_id: +form.role_id });
      setMsg({ type: 'ok', text: 'User berhasil dibuat' });
      setForm({ username: '', password: '', role_id: '', employee_id: '' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleToggle = async (user) => {
    try {
      await userApi.updateUser(user.id, { is_active: !user.is_active });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ role_id: String(u.role_id || ''), password: '' });
  };

  const handleEditSave = async () => {
    try {
      const payload = { role_id: +editForm.role_id };
      if (editForm.password) payload.password = editForm.password;
      await userApi.updateUser(editUser.id, payload);
      setMsg({ type: 'ok', text: 'User diperbarui' });
      setEditUser(null);
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDeactivate = async (u) => {
    if (!window.confirm('Hapus data ini? User akan dinonaktifkan.')) return;
    try {
      await userApi.updateUser(u.id, { is_active: false });
      setMsg({ type: 'ok', text: 'User dinonaktifkan' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleSeedRoles = async () => {
    setLoading(true);
    try {
      const r = await userApi.seedDefaults();
      setMsg({ type: 'ok', text: r.message });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">User &amp; Role</h1>
          <p className="page-sub">Kelola akun pengguna dan hak akses</p>
        </div>
        <button className="btn-outline self-start sm:self-auto" onClick={handleSeedRoles} disabled={loading}>
          {loading ? <><span className="spinner w-4 h-4" /> Memproses…</> : <><IconifyIcon icon="bx:data" className="text-base" /> Seed Default Roles</>}
        </button>
      </div>

      <MsgBar msg={msg} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* Users table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Daftar User ({users.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Username</th><th>ID Karyawan</th><th>Role</th><th>Status</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const role = roles.find((r) => r.id === u.role_id);
                  return (
                    <tr key={u.id}>
                      <td className="font-mono font-semibold text-sm">{u.username}</td>
                      <td className="font-mono text-xs text-slate-400">{u.employee_id || '—'}</td>
                      <td>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                          {role?.role_code || u.role_id}
                        </span>
                      </td>
                      <td><Badge variant={u.is_active ? 'success' : 'gray'} dot>{u.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                      <td>
                        <div className="flex gap-1.5">
                          <button
                            className={u.is_active ? 'btn-outline btn-sm text-xs' : 'btn-success btn-sm text-xs'}
                            onClick={() => handleToggle(u)}
                          >
                            {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          {canEdit && (
                            <>
                              <button className="btn-outline btn-sm text-xs" onClick={() => openEdit(u)}>
                                <IconifyIcon icon="bx:edit" className="text-sm" /> Edit
                              </button>
                              {u.is_active && (
                                <button className="btn-danger btn-sm text-xs" onClick={() => handleDeactivate(u)}>
                                  <IconifyIcon icon="bx:trash" className="text-sm" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!users.length && (
                  <tr><td colSpan={5}><div className="empty-state py-10"><p className="empty-title">Belum ada user</p><p className="empty-sub">Buat user baru di panel kanan</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add user form */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Tambah User</h3></div>
          <div className="modal-body space-y-3">
            {[['username', 'Username', 'text'], ['password', 'Password', 'password'], ['employee_id', 'ID Karyawan (opsional)', 'text']].map(([k, l, t]) => (
              <div key={k}>
                <label className="input-label">{l}</label>
                <input type={t} className="input" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} autoComplete="off" />
              </div>
            ))}
            <div>
              <label className="input-label">Role</label>
              <select className="input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                <option value="">— Pilih Role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.role_name} ({r.role_code})</option>
                ))}
              </select>
            </div>
            {canEdit && (
              <button className="btn-primary w-full" onClick={handleCreate}>
                <IconifyIcon icon="bx:user-plus" className="text-base" /> Buat User
              </button>
            )}

            {roles.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Permission Matrix</p>
                <div className="space-y-3">
                  {roles.map((r) => (
                    <div key={r.id}>
                      <div className="font-mono text-xs text-primary-600 dark:text-primary-400 mb-1.5">{r.role_code}</div>
                      <div className="flex flex-wrap gap-1">
                        {(r.permissions || []).map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-400">{p}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal animate-scale-in max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit User — {editUser.username}</h2>
              <button className="modal-close" onClick={() => setEditUser(null)}>
                <IconifyIcon icon="bx:x" className="text-lg" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="input-label">Role</label>
                <select className="input" value={editForm.role_id} onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}>
                  <option value="">— Pilih Role —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.role_name} ({r.role_code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Password Baru (kosongkan jika tidak diubah)</label>
                <input type="password" className="input" autoComplete="new-password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setEditUser(null)}>Batal</button>
              <button className="btn-primary" onClick={handleEditSave}>
                <IconifyIcon icon="bx:save" className="text-base" /> Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
