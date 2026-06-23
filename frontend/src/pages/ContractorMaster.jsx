import { useState, useEffect } from 'react';
import { contractorApi } from '../utils/api';
import IconifyIcon from '../components/wrappers/IconifyIcon';

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

const EMPTY_SKILL = {
  skill_code: '', skill_name: '', daily_rate: 0,
  overtime_rate_per_hour: 0, weekend_rate_per_hour: 0, holiday_rate_per_hour: 0,
  is_active: true,
};
const EMPTY_PROJECT = {
  project_code: '', project_name: '', description: '', location: '',
  start_date: '', end_date: '', is_active: true,
};
const EMPTY_SETTINGS = {
  work_start: '09:00', work_end: '18:00', overtime_start: '19:00',
  max_overtime_time: '22:00', meal_allowance_amount: 25000,
  meal_allowance_threshold: '22:00',
  weekday_ot_multiplier: 1.0, weekend_ot_multiplier: 1.5, holiday_ot_multiplier: 2.0,
  max_weekend_ot_hours: 8, meal_weekend_min_hours: 4,
};
const EMPTY_HOLIDAY = { date: '', name: '', holiday_type: 'national', applicable_project_ids: null };

const fmt = (n) => new Intl.NumberFormat('id-ID').format(n);
const TABS = ['skills', 'projects', 'settings', 'holidays'];
const TAB_LABELS = { skills: 'Skill Level', projects: 'Proyek', settings: 'Pengaturan', holidays: 'Hari Libur' };

export default function ContractorMaster() {
  const [tab, setTab] = useState('skills');
  const [backendDown, setBackendDown] = useState(false);

  // Skills
  const [skills, setSkills]         = useState([]);
  const [skillForm, setSkillForm]   = useState(EMPTY_SKILL);
  const [editSkill, setEditSkill]   = useState(null);
  const [skillMsg, setSkillMsg]     = useState(null);

  // Projects
  const [projects, setProjects]         = useState([]);
  const [projectForm, setProjectForm]   = useState(EMPTY_PROJECT);
  const [editProject, setEditProject]   = useState(null);
  const [projectMsg, setProjectMsg]     = useState(null);

  // Settings
  const [selProject, setSelProject]       = useState(null);
  const [settingsForm, setSettingsForm]   = useState(EMPTY_SETTINGS);
  const [settingsMsg, setSettingsMsg]     = useState(null);

  // Holidays
  const [holidays, setHolidays]         = useState([]);
  const [holidayYear, setHolidayYear]   = useState(new Date().getFullYear());
  const [holidayForm, setHolidayForm]   = useState(EMPTY_HOLIDAY);
  const [holidayMsg, setHolidayMsg]     = useState(null);
  const [importText, setImportText]     = useState('');

  const loadSkills   = () => contractorApi.listSkills().then(setSkills).catch((e) => {
    if (isNetworkError(e)) { setBackendDown(true); return; }
    console.error(e);
  });
  const loadProjects = () => contractorApi.listProjects().then(setProjects).catch((e) => {
    if (isNetworkError(e)) { setBackendDown(true); return; }
    console.error(e);
  });
  const loadHolidays = (y) => contractorApi.listHolidays(y).then(setHolidays).catch((e) => {
    if (isNetworkError(e)) { setBackendDown(true); return; }
    console.error(e);
  });

  useEffect(() => { loadSkills(); loadProjects(); }, []);
  useEffect(() => { if (tab === 'holidays') loadHolidays(holidayYear); }, [tab, holidayYear]);

  const loadSettings = (pid) => {
    setSelProject(pid);
    contractorApi.getSettings(pid)
      .then(s => setSettingsForm(s))
      .catch((e) => {
        if (isNetworkError(e)) { setBackendDown(true); return; }
        // 404 = no settings yet, reset to defaults is correct
        if (!e.message?.includes('404') && !e.message?.includes('not found')) {
          // unexpected error — still reset but note it
          console.warn('loadSettings error:', e.message);
        }
        setSettingsForm(EMPTY_SETTINGS);
      });
  };

  // ── Skills ──────────────────────────────────────────────────────────────────
  const saveSkill = async () => {
    try {
      if (editSkill) await contractorApi.updateSkill(editSkill.id, skillForm);
      else           await contractorApi.createSkill(skillForm);
      setSkillMsg({ type: 'ok', text: editSkill ? 'Skill diperbarui' : 'Skill ditambahkan' });
      setEditSkill(null); setSkillForm(EMPTY_SKILL); loadSkills();
    } catch (e) { setSkillMsg({ type: 'err', text: e.message }); }
  };

  const deleteSkill = async (id) => {
    if (!window.confirm('Hapus skill ini?')) return;
    try { await contractorApi.deleteSkill(id); loadSkills(); }
    catch (e) { setSkillMsg({ type: 'err', text: e.message }); }
  };

  // ── Projects ─────────────────────────────────────────────────────────────────
  const saveProject = async () => {
    try {
      const d = { ...projectForm, start_date: projectForm.start_date || null, end_date: projectForm.end_date || null };
      if (editProject) await contractorApi.updateProject(editProject.id, d);
      else             await contractorApi.createProject(d);
      setProjectMsg({ type: 'ok', text: editProject ? 'Proyek diperbarui' : 'Proyek ditambahkan' });
      setEditProject(null); setProjectForm(EMPTY_PROJECT); loadProjects();
    } catch (e) { setProjectMsg({ type: 'err', text: e.message }); }
  };

  // ── Settings ─────────────────────────────────────────────────────────────────
  const saveSettings = async () => {
    try {
      await contractorApi.upsertSettings(selProject, settingsForm);
      setSettingsMsg({ type: 'ok', text: 'Pengaturan disimpan' });
    } catch (e) { setSettingsMsg({ type: 'err', text: e.message }); }
  };

  // ── Holidays ─────────────────────────────────────────────────────────────────
  const saveHoliday = async () => {
    try {
      await contractorApi.createHoliday(holidayForm);
      setHolidayMsg({ type: 'ok', text: 'Hari libur ditambahkan' });
      setHolidayForm(EMPTY_HOLIDAY); loadHolidays(holidayYear);
    } catch (e) { setHolidayMsg({ type: 'err', text: e.message }); }
  };

  const deleteHoliday = async (id) => {
    if (!window.confirm('Hapus hari libur ini?')) return;
    try { await contractorApi.deleteHoliday(id); loadHolidays(holidayYear); }
    catch (e) { setHolidayMsg({ type: 'err', text: e.message }); }
  };

  const importHolidays = async () => {
    try {
      const lines = importText.trim().split('\n').filter(Boolean);
      const list = lines.map(line => {
        const [date, ...rest] = line.split(',');
        return { date: date.trim(), name: rest.join(',').trim() || 'Hari Libur', holiday_type: 'national' };
      });
      const r = await contractorApi.importHolidays(list);
      setHolidayMsg({ type: 'ok', text: `Import selesai: ${r.created} ditambahkan, ${r.skipped} dilewati` });
      setImportText(''); loadHolidays(holidayYear);
    } catch (e) { setHolidayMsg({ type: 'err', text: e.message }); }
  };

  const sfv = (key, val) => setSettingsForm(sf => ({ ...sf, [key]: val }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Master Kontraktor</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola skill level, proyek, pengaturan, dan kalender libur</p>
      </div>

      {backendDown && (
        <div className="alert-danger text-sm mb-4">
          <IconifyIcon icon="bx:error-circle" className="text-base flex-shrink-0" />
          Tidak dapat terhubung ke server. Periksa koneksi atau coba lagi nanti.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-6 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ═══ SKILLS ═══════════════════════════════════════════════════════════ */}
      {tab === 'skills' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="card-header"><h3 className="font-semibold">Daftar Skill Level</h3></div>
            <div className="card-body p-0">
              <MsgBar msg={skillMsg} />
              <table className="table text-sm">
                <thead><tr>
                  <th>Kode</th><th>Nama</th><th>Rate Harian</th>
                  <th>Lembur/Jam</th><th>Weekend/Jam</th><th>Libur/Jam</th>
                  <th>Status</th><th></th>
                </tr></thead>
                <tbody>
                  {skills.map(s => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">{s.skill_code}</td>
                      <td className="font-medium">{s.skill_name}</td>
                      <td>Rp {fmt(s.daily_rate)}</td>
                      <td>Rp {fmt(s.overtime_rate_per_hour)}</td>
                      <td className="text-orange-600">Rp {fmt(s.weekend_rate_per_hour)}</td>
                      <td className="text-red-600">Rp {fmt(s.holiday_rate_per_hour)}</td>
                      <td><span className={`badge ${s.is_active ? 'badge-success' : 'badge-secondary'}`}>{s.is_active ? 'Aktif' : 'Non-aktif'}</span></td>
                      <td>
                        <button className="btn-icon text-blue-500" onClick={() => { setEditSkill(s); setSkillForm(s); }}>
                          <IconifyIcon icon="bx:edit" />
                        </button>
                        <button className="btn-icon text-red-500" onClick={() => deleteSkill(s.id)}>
                          <IconifyIcon icon="bx:trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {skills.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-6">Belum ada skill level</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="font-semibold">{editSkill ? 'Edit' : 'Tambah'} Skill Level</h3></div>
            <div className="card-body space-y-3">
              <div>
                <label className="form-label">Kode Skill</label>
                <input className="form-control" value={skillForm.skill_code}
                  onChange={e => setSkillForm(f => ({...f, skill_code: e.target.value}))} placeholder="HELPER" />
              </div>
              <div>
                <label className="form-label">Nama Skill</label>
                <input className="form-control" value={skillForm.skill_name}
                  onChange={e => setSkillForm(f => ({...f, skill_name: e.target.value}))} placeholder="Helper" />
              </div>
              <div>
                <label className="form-label">Rate Harian (Rp)</label>
                <input type="number" className="form-control" value={skillForm.daily_rate}
                  onChange={e => setSkillForm(f => ({...f, daily_rate: +e.target.value}))} />
              </div>

              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1 border-t border-slate-100 dark:border-slate-700">Tarif Lembur per Jam</p>
              <div>
                <label className="form-label">Hari Kerja (Rp)</label>
                <input type="number" className="form-control" value={skillForm.overtime_rate_per_hour}
                  onChange={e => setSkillForm(f => ({...f, overtime_rate_per_hour: +e.target.value}))} />
              </div>
              <div>
                <label className="form-label">Weekend/Sabtu-Minggu (Rp)</label>
                <input type="number" className="form-control" value={skillForm.weekend_rate_per_hour}
                  onChange={e => setSkillForm(f => ({...f, weekend_rate_per_hour: +e.target.value}))} />
              </div>
              <div>
                <label className="form-label">Hari Libur (Rp)</label>
                <input type="number" className="form-control" value={skillForm.holiday_rate_per_hour}
                  onChange={e => setSkillForm(f => ({...f, holiday_rate_per_hour: +e.target.value}))} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="skill_active" checked={skillForm.is_active}
                  onChange={e => setSkillForm(f => ({...f, is_active: e.target.checked}))} />
                <label htmlFor="skill_active" className="form-label mb-0">Aktif</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button className="btn btn-primary flex-1" onClick={saveSkill}>Simpan</button>
                {editSkill && <button className="btn btn-secondary" onClick={() => { setEditSkill(null); setSkillForm(EMPTY_SKILL); }}>Batal</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PROJECTS ═════════════════════════════════════════════════════════ */}
      {tab === 'projects' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="card-header"><h3 className="font-semibold">Daftar Proyek</h3></div>
            <div className="card-body p-0">
              <MsgBar msg={projectMsg} />
              <table className="table text-sm">
                <thead><tr><th>Kode</th><th>Nama Proyek</th><th>Lokasi</th><th>Periode</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.project_code}</td>
                      <td className="font-medium">{p.project_name}</td>
                      <td className="text-sm text-slate-500">{p.location || '-'}</td>
                      <td className="text-sm">{p.start_date || '-'} s/d {p.end_date || '-'}</td>
                      <td><span className={`badge ${p.is_active ? 'badge-success' : 'badge-secondary'}`}>{p.is_active ? 'Aktif' : 'Selesai'}</span></td>
                      <td>
                        <button className="btn-icon text-blue-500" onClick={() => { setEditProject(p); setProjectForm({...p, start_date: p.start_date || '', end_date: p.end_date || ''}); }}>
                          <IconifyIcon icon="bx:edit" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {projects.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada proyek</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="font-semibold">{editProject ? 'Edit' : 'Tambah'} Proyek</h3></div>
            <div className="card-body space-y-3">
              {['project_code','project_name','description','location'].map(f => (
                <div key={f}>
                  <label className="form-label capitalize">{f.replace('_',' ')}</label>
                  <input className="form-control" value={projectForm[f]} onChange={e => setProjectForm(pf => ({...pf, [f]: e.target.value}))} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="form-label">Mulai</label>
                  <input type="date" className="form-control" value={projectForm.start_date} onChange={e => setProjectForm(f => ({...f, start_date: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">Selesai</label>
                  <input type="date" className="form-control" value={projectForm.end_date} onChange={e => setProjectForm(f => ({...f, end_date: e.target.value}))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="proj_active" checked={projectForm.is_active} onChange={e => setProjectForm(f => ({...f, is_active: e.target.checked}))} />
                <label htmlFor="proj_active" className="form-label mb-0">Aktif</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button className="btn btn-primary flex-1" onClick={saveProject}>Simpan</button>
                {editProject && <button className="btn btn-secondary" onClick={() => { setEditProject(null); setProjectForm(EMPTY_PROJECT); }}>Batal</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SETTINGS ═════════════════════════════════════════════════════════ */}
      {tab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-1">
            <div className="card-header"><h3 className="font-semibold">Pilih Proyek</h3></div>
            <div className="card-body space-y-2">
              {projects.filter(p => p.is_active).map(p => (
                <button key={p.id} onClick={() => loadSettings(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selProject === p.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                  <div className="font-medium">{p.project_name}</div>
                  <div className={`text-xs ${selProject === p.id ? 'text-blue-100' : 'text-slate-400'}`}>{p.project_code}</div>
                </button>
              ))}
              {projects.filter(p => p.is_active).length === 0 && <p className="text-sm text-slate-400">Belum ada proyek aktif</p>}
            </div>
          </div>

          <div className="card lg:col-span-2">
            <div className="card-header">
              <h3 className="font-semibold">Pengaturan Operasional</h3>
              {selProject && <span className="text-xs text-slate-400">{projects.find(p => p.id === selProject)?.project_name}</span>}
            </div>
            {!selProject ? (
              <div className="card-body text-center text-slate-400 py-12">Pilih proyek di sebelah kiri</div>
            ) : (
              <div className="card-body space-y-5">
                <MsgBar msg={settingsMsg} />

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Jam Kerja</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'work_start', label: 'Jam Masuk' },
                      { key: 'work_end', label: 'Jam Pulang' },
                      { key: 'overtime_start', label: 'Mulai Lembur' },
                      { key: 'max_overtime_time', label: 'Maks Lembur (Weekday)' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="form-label">{f.label}</label>
                        <input type="time" className="form-control" value={settingsForm[f.key]}
                          onChange={e => sfv(f.key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Multiplier Lembur</p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: 'weekday_ot_multiplier', label: 'Hari Kerja (×)' },
                      { key: 'weekend_ot_multiplier', label: 'Weekend (×)' },
                      { key: 'holiday_ot_multiplier', label: 'Hari Libur (×)' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="form-label">{f.label}</label>
                        <input type="number" step="0.1" min="1" className="form-control"
                          value={settingsForm[f.key]} onChange={e => sfv(f.key, +e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Weekend / Hari Libur</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Maks Jam Lembur Weekend/Libur</label>
                      <input type="number" step="0.5" min="1" className="form-control"
                        value={settingsForm.max_weekend_ot_hours} onChange={e => sfv('max_weekend_ot_hours', +e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Min Jam Kerja untuk Uang Makan (weekend)</label>
                      <input type="number" step="0.5" min="1" className="form-control"
                        value={settingsForm.meal_weekend_min_hours} onChange={e => sfv('meal_weekend_min_hours', +e.target.value)} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Uang Makan</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Nominal Uang Makan (Rp)</label>
                      <input type="number" className="form-control" value={settingsForm.meal_allowance_amount}
                        onChange={e => sfv('meal_allowance_amount', +e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Batas Jam Pulang (hari kerja)</label>
                      <input type="time" className="form-control" value={settingsForm.meal_allowance_threshold}
                        onChange={e => sfv('meal_allowance_threshold', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  <strong>Ringkasan:</strong> Weekday: grace {settingsForm.work_end}–{settingsForm.overtime_start},
                  lembur s/d {settingsForm.max_overtime_time} (×{settingsForm.weekday_ot_multiplier}).
                  Weekend: semua jam kerja = lembur, maks {settingsForm.max_weekend_ot_hours}j (×{settingsForm.weekend_ot_multiplier}).
                  Libur: maks {settingsForm.max_weekend_ot_hours}j (×{settingsForm.holiday_ot_multiplier}).
                </div>

                <button className="btn btn-primary" onClick={saveSettings}>Simpan Pengaturan</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ HOLIDAYS ═════════════════════════════════════════════════════════ */}
      {tab === 'holidays' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold">Kalender Hari Libur</h3>
              <select className="form-control w-28" value={holidayYear} onChange={e => setHolidayYear(+e.target.value)}>
                {[new Date().getFullYear()-1, new Date().getFullYear(), new Date().getFullYear()+1].map(y =>
                  <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="card-body p-0">
              <MsgBar msg={holidayMsg} />
              <table className="table text-sm">
                <thead><tr><th>Tanggal</th><th>Nama</th><th>Tipe</th><th>Proyek</th><th></th></tr></thead>
                <tbody>
                  {holidays.map(h => (
                    <tr key={h.id}>
                      <td className="font-mono">{h.date}</td>
                      <td className="font-medium">{h.name}</td>
                      <td>
                        <span className={`badge ${h.holiday_type === 'national' ? 'badge-danger' : 'badge-warning'}`}>
                          {h.holiday_type === 'national' ? 'Nasional' : 'Perusahaan'}
                        </span>
                      </td>
                      <td className="text-xs text-slate-400">
                        {h.applicable_project_ids ? `Proyek #${h.applicable_project_ids.join(', ')}` : 'Semua proyek'}
                      </td>
                      <td>
                        <button className="btn-icon text-red-500" onClick={() => deleteHoliday(h.id)}>
                          <IconifyIcon icon="bx:trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {holidays.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-slate-400 py-6">Tidak ada hari libur tahun {holidayYear}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            {/* Add single */}
            <div className="card">
              <div className="card-header"><h3 className="font-semibold text-sm">Tambah Hari Libur</h3></div>
              <div className="card-body space-y-3">
                <div>
                  <label className="form-label">Tanggal</label>
                  <input type="date" className="form-control" value={holidayForm.date}
                    onChange={e => setHolidayForm(f => ({...f, date: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">Nama</label>
                  <input className="form-control" value={holidayForm.name}
                    onChange={e => setHolidayForm(f => ({...f, name: e.target.value}))} placeholder="Hari Kemerdekaan" />
                </div>
                <div>
                  <label className="form-label">Tipe</label>
                  <select className="form-control" value={holidayForm.holiday_type}
                    onChange={e => setHolidayForm(f => ({...f, holiday_type: e.target.value}))}>
                    <option value="national">Nasional</option>
                    <option value="company">Perusahaan</option>
                  </select>
                </div>
                <button className="btn btn-primary w-full" onClick={saveHoliday}>Tambah</button>
              </div>
            </div>

            {/* Bulk import */}
            <div className="card">
              <div className="card-header"><h3 className="font-semibold text-sm">Import CSV</h3></div>
              <div className="card-body space-y-3">
                <p className="text-xs text-slate-400">Format per baris: <code>YYYY-MM-DD,Nama Libur</code></p>
                <textarea
                  className="form-control font-mono text-xs"
                  rows={6}
                  placeholder={"2026-01-01,Tahun Baru\n2026-08-17,Hari Kemerdekaan"}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                />
                <button className="btn btn-secondary w-full" onClick={importHolidays} disabled={!importText.trim()}>
                  <IconifyIcon icon="bx:upload" /> Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
