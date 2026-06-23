import { useState, useEffect } from 'react';
import { contractorApi } from '../utils/api';
import IconifyIcon from '../components/wrappers/IconifyIcon';

const STATUS_COLOR = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };
const STATUS_LABEL = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' };

function isNetworkError(e) {
  const msg = e?.message || '';
  return msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('NetworkError');
}

function MsgBar({ msg }) {
  if (!msg) return null;
  return (
    <div className={`${msg.type === 'ok' ? 'alert-success' : 'alert-danger'} text-sm mb-4`}>
      <IconifyIcon icon={msg.type === 'ok' ? 'bx:check-circle' : 'bx:error-circle'} className="text-base flex-shrink-0" />
      {msg.text}
    </div>
  );
}

export default function OvertimeApproval() {
  const [tab, setTab]           = useState('pending');
  const [projects, setProjects] = useState([]);
  const [selProject, setSelProject] = useState('');
  const [items, setItems]       = useState([]);
  const [msg, setMsg]           = useState(null);
  const [backendDown, setBackendDown] = useState(false);
  const [noteModal, setNoteModal] = useState(null); // { id, action }
  const [notes, setNotes]       = useState('');
  const [histFilter, setHistFilter] = useState('');

  useEffect(() => {
    contractorApi.listProjects().then(setProjects).catch((e) => {
      if (isNetworkError(e)) { setBackendDown(true); return; }
      setMsg({ type: 'err', text: e.message });
    });
  }, []);

  const loadPending = () =>
    contractorApi.pendingOvertime(selProject || null).then(setItems).catch((e) => {
      if (isNetworkError(e)) { setBackendDown(true); return; }
      setMsg({ type: 'err', text: e.message });
    });

  const loadHistory = () =>
    contractorApi.overtimeHistory(selProject || null, histFilter || null).then(setItems).catch((e) => {
      if (isNetworkError(e)) { setBackendDown(true); return; }
      setMsg({ type: 'err', text: e.message });
    });

  useEffect(() => {
    if (tab === 'pending') loadPending();
    else loadHistory();
  }, [tab, selProject, histFilter]);

  const openModal = (id, action) => { setNoteModal({ id, action }); setNotes(''); };

  const submitAction = async () => {
    if (!noteModal) return;
    setMsg(null);
    try {
      if (noteModal.action === 'approve') await contractorApi.approveOvertime(noteModal.id, { notes });
      else                               await contractorApi.rejectOvertime(noteModal.id, { notes });
      setMsg({ type: 'ok', text: `Lembur ${noteModal.action === 'approve' ? 'disetujui' : 'ditolak'}` });
      setNoteModal(null);
      if (tab === 'pending') loadPending(); else loadHistory();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const fmtMinutes = (m) => m ? `${Math.floor(m/60)}j ${m%60}m` : '-';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Approval Lembur Kontraktor</h1>
        <p className="text-sm text-slate-500 mt-1">Review dan setujui lembur pekerja kontraktor</p>
      </div>

      {backendDown && (
        <div className="alert-danger text-sm mb-4">
          <IconifyIcon icon="bx:wifi-off" className="text-base flex-shrink-0" />
          <span>Server tidak dapat dijangkau — data tidak tersedia. Pastikan backend berjalan di <code>http://localhost:8000</code>.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {['pending', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-600 dark:text-slate-300'}`}>
              {t === 'pending' ? 'Menunggu Approval' : 'Riwayat'}
            </button>
          ))}
        </div>

        <select className="form-control w-48" value={selProject} onChange={e => setSelProject(e.target.value)}>
          <option value="">Semua Proyek</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>

        {tab === 'history' && (
          <select className="form-control w-36" value={histFilter} onChange={e => setHistFilter(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
        )}
      </div>

      <MsgBar msg={msg} />

      <div className="card">
        <div className="card-body p-0">
          <table className="table">
            <thead><tr>
              <th>Karyawan</th>
              <th>Tanggal</th>
              <th>Jam Lembur</th>
              <th>Total</th>
              <th>Keterangan</th>
              <th>Status</th>
              {tab === 'pending' && <th>Aksi</th>}
              {tab === 'history' && <th>Diproses oleh</th>}
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="font-medium">{item.employee_name || item.employee_id}</div>
                    <div className="text-xs text-slate-400">{item.employee_id}</div>
                  </td>
                  <td>{item.date}</td>
                  <td className="text-sm">{item.planned_start} – {item.planned_end || '...'}</td>
                  <td className="font-medium">{fmtMinutes(item.actual_duration_minutes)}</td>
                  <td className="text-sm text-slate-500 max-w-xs truncate">{item.reason || '-'}</td>
                  <td><span className={`badge ${STATUS_COLOR[item.status] || 'badge-secondary'}`}>{STATUS_LABEL[item.status] || item.status}</span></td>
                  {tab === 'pending' && (
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-success btn-sm" onClick={() => openModal(item.id, 'approve')}>
                          <IconifyIcon icon="bx:check" /> Setujui
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => openModal(item.id, 'reject')}>
                          <IconifyIcon icon="bx:x" /> Tolak
                        </button>
                      </div>
                    </td>
                  )}
                  {tab === 'history' && <td className="text-sm text-slate-500">{item.approved_by || '-'}</td>}
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-400 py-8">
                  {tab === 'pending' ? 'Tidak ada lembur yang menunggu approval' : 'Belum ada riwayat'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal konfirmasi */}
      {noteModal && (
        <div className="modal-backdrop">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">
              {noteModal.action === 'approve' ? '✅ Setujui Lembur' : '❌ Tolak Lembur'}
            </h3>
            <div>
              <label className="form-label">Catatan (opsional)</label>
              <textarea className="form-control" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tambahkan catatan..." />
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button className="btn btn-secondary" onClick={() => setNoteModal(null)}>Batal</button>
              <button
                className={`btn ${noteModal.action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={submitAction}>
                {noteModal.action === 'approve' ? 'Setujui' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
