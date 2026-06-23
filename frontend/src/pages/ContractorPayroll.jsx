import React, { useState, useEffect } from 'react';
import { contractorApi } from '../utils/api';
import IconifyIcon from '../components/wrappers/IconifyIcon';

const fmt = (n) => new Intl.NumberFormat('id-ID').format(Math.round(n || 0));
const fmtH = (h) => `${parseFloat(h || 0).toFixed(1)}j`;

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

const now = new Date();
const CUR_MONTH = now.getMonth() + 1;
const CUR_YEAR  = now.getFullYear();

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
const YEARS  = [CUR_YEAR - 1, CUR_YEAR, CUR_YEAR + 1];

export default function ContractorPayroll() {
  const [projects, setProjects]     = useState([]);
  const [selProject, setSelProject] = useState('');
  const [month, setMonth]           = useState(CUR_MONTH);
  const [year, setYear]             = useState(CUR_YEAR);
  const [payrolls, setPayrolls]     = useState([]);
  const [msg, setMsg]               = useState(null);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded]     = useState(null); // payroll id with breakdown open
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    contractorApi.listProjects().then(setProjects).catch((e) => {
      if (isNetworkError(e)) { setBackendDown(true); return; }
      console.error(e);
    });
  }, []);

  const loadPayroll = () => {
    if (!selProject) return;
    contractorApi.listPayroll(selProject, month, year).then(setPayrolls).catch((e) => {
      if (isNetworkError(e)) { setBackendDown(true); return; }
      console.error(e);
    });
  };

  useEffect(() => { loadPayroll(); }, [selProject, month, year]);

  const generate = async () => {
    if (!selProject) { setMsg({ type: 'err', text: 'Pilih proyek terlebih dahulu' }); return; }
    setGenerating(true);
    try {
      const result = await contractorApi.generatePayroll({ project_id: +selProject, period_month: +month, period_year: +year });
      setMsg({ type: 'ok', text: `${result.length} payslip berhasil digenerate` });
      loadPayroll();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setGenerating(false); }
  };

  const finalize = async (id) => {
    if (!window.confirm('Finalisasi payroll ini? Tidak dapat dibatalkan.')) return;
    try {
      await contractorApi.finalizePayroll(id);
      setMsg({ type: 'ok', text: 'Payroll difinalisasi' });
      loadPayroll();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const totals = payrolls.reduce((acc, p) => ({
    work_days:             acc.work_days + (p.work_days || 0),
    weekend_days:          acc.weekend_days + (p.weekend_attendance_days || 0),
    holiday_days:          acc.holiday_days + (p.holiday_attendance_days || 0),
    base_salary:           acc.base_salary + (p.base_salary || 0),
    weekday_ot_amount:     acc.weekday_ot_amount + (p.weekday_ot_amount || 0),
    weekend_ot_amount:     acc.weekend_ot_amount + (p.weekend_ot_amount || 0),
    holiday_ot_amount:     acc.holiday_ot_amount + (p.holiday_ot_amount || 0),
    overtime_amount:       acc.overtime_amount + (p.overtime_amount || 0),
    meal_allowance_amount: acc.meal_allowance_amount + (p.meal_allowance_amount || 0),
    total_salary:          acc.total_salary + (p.total_salary || 0),
  }), { work_days:0, weekend_days:0, holiday_days:0, base_salary:0, weekday_ot_amount:0,
        weekend_ot_amount:0, holiday_ot_amount:0, overtime_amount:0, meal_allowance_amount:0, total_salary:0 });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Payroll Kontraktor</h1>
        <p className="text-sm text-slate-500 mt-1">Generate dan kelola payslip pekerja kontraktor</p>
      </div>

      {backendDown && (
        <div className="alert-danger text-sm mb-4">
          <IconifyIcon icon="bx:error-circle" className="text-base flex-shrink-0" />
          Tidak dapat terhubung ke server. Periksa koneksi atau coba lagi nanti.
        </div>
      )}

      {/* Filter bar */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="form-label">Proyek</label>
              <select className="form-control w-52" value={selProject} onChange={e => setSelProject(e.target.value)}>
                <option value="">-- Pilih Proyek --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Bulan</label>
              <select className="form-control w-32" value={month} onChange={e => setMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Tahun</label>
              <select className="form-control w-28" value={year} onChange={e => setYear(+e.target.value)}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={generate} disabled={generating || !selProject}>
              {generating
                ? <><span className="spinner w-4 h-4" /> Memproses…</>
                : <><IconifyIcon icon="bx:refresh" /> Generate Payroll</>}
            </button>
          </div>
        </div>
      </div>

      <MsgBar msg={msg} />

      {/* Summary cards */}
      {payrolls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Pekerja',   value: payrolls.length,                      suffix: 'orang', color: 'text-blue-600'  },
            { label: 'Gaji Pokok',      value: `Rp ${fmt(totals.base_salary)}`,       suffix: '',      color: 'text-slate-700' },
            { label: 'Lembur Weekday',  value: `Rp ${fmt(totals.weekday_ot_amount)}`, suffix: '',      color: 'text-amber-600' },
            { label: 'Lembur Weekend/Libur', value: `Rp ${fmt(totals.weekend_ot_amount + totals.holiday_ot_amount)}`, suffix: '', color: 'text-orange-600' },
            { label: 'Total Payroll',   value: `Rp ${fmt(totals.total_salary)}`,      suffix: '',      color: 'text-green-600' },
          ].map(c => (
            <div key={c.label} className="card">
              <div className="card-body py-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{c.label}</p>
                <p className={`text-lg font-bold mt-1 ${c.color}`}>{c.value} <span className="text-sm font-normal">{c.suffix}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="card-body p-0">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th className="text-right">Hari Hadir</th>
                <th className="text-right">Gaji Pokok</th>
                <th className="text-right">Lembur Weekday</th>
                <th className="text-right">Lembur Weekend</th>
                <th className="text-right">Lembur Libur</th>
                <th className="text-right">Uang Makan</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map(p => (
                <React.Fragment key={p.id}>
                  <tr className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    <td>
                      <div className="font-medium">{p.employee_name || p.employee_id}</div>
                      <div className="text-xs text-slate-400">{p.employee_id}</div>
                    </td>
                    <td className="text-right">
                      <div>{p.work_days}h</div>
                      {(p.weekend_attendance_days > 0 || p.holiday_attendance_days > 0) && (
                        <div className="text-xs text-slate-400">
                          {p.weekend_attendance_days > 0 && `+${p.weekend_attendance_days}wknd`}
                          {p.holiday_attendance_days > 0 && ` +${p.holiday_attendance_days}lib`}
                        </div>
                      )}
                    </td>
                    <td className="text-right">Rp {fmt(p.base_salary)}</td>
                    <td className="text-right text-amber-600">
                      {p.weekday_ot_hours > 0
                        ? <>Rp {fmt(p.weekday_ot_amount)}<div className="text-xs text-slate-400">{fmtH(p.weekday_ot_hours)}</div></>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="text-right text-orange-600">
                      {p.weekend_ot_hours > 0
                        ? <>Rp {fmt(p.weekend_ot_amount)}<div className="text-xs text-slate-400">{fmtH(p.weekend_ot_hours)}</div></>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="text-right text-red-600">
                      {p.holiday_ot_hours > 0
                        ? <>Rp {fmt(p.holiday_ot_amount)}<div className="text-xs text-slate-400">{fmtH(p.holiday_ot_hours)}</div></>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="text-right">
                      Rp {fmt(p.meal_allowance_amount)}
                      <div className="text-xs text-slate-400">{p.meal_allowance_days} hari</div>
                    </td>
                    <td className="text-right font-bold text-green-600">Rp {fmt(p.total_salary)}</td>
                    <td>
                      <span className={`badge ${p.status === 'finalized' ? 'badge-success' : 'badge-warning'}`}>
                        {p.status === 'finalized' ? 'Final' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      {p.status === 'draft' && (
                        <button className="btn btn-success btn-sm" onClick={e => { e.stopPropagation(); finalize(p.id); }}>
                          <IconifyIcon icon="bx:lock" /> Finalisasi
                        </button>
                      )}
                      {p.status === 'finalized' && (
                        <span className="text-xs text-slate-400">{p.finalized_by}</span>
                      )}
                    </td>
                  </tr>
                  {expanded === p.id && (
                    <tr key={`${p.id}-detail`} className="bg-slate-50 dark:bg-slate-900">
                      <td colSpan={10} className="px-6 py-3">
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Lembur Hari Kerja</p>
                            <p>Jam lembur: <b>{fmtH(p.weekday_ot_hours)}</b></p>
                            <p>Jumlah: <b className="text-amber-600">Rp {fmt(p.weekday_ot_amount)}</b></p>
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Lembur Weekend (Sabtu/Minggu)</p>
                            <p>Hadir weekend: <b>{p.weekend_attendance_days} hari</b></p>
                            <p>Jam lembur: <b>{fmtH(p.weekend_ot_hours)}</b></p>
                            <p>Jumlah: <b className="text-orange-600">Rp {fmt(p.weekend_ot_amount)}</b></p>
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Lembur Hari Libur</p>
                            <p>Hadir hari libur: <b>{p.holiday_attendance_days} hari</b></p>
                            <p>Jam lembur: <b>{fmtH(p.holiday_ot_hours)}</b></p>
                            <p>Jumlah: <b className="text-red-600">Rp {fmt(p.holiday_ot_amount)}</b></p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {payrolls.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-slate-400 py-8">
                    {selProject ? 'Belum ada payroll. Klik "Generate Payroll" untuk membuat.' : 'Pilih proyek untuk melihat payroll'}
                  </td>
                </tr>
              )}
            </tbody>
            {payrolls.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold text-sm">
                <tr>
                  <td>Total ({payrolls.length} orang)</td>
                  <td className="text-right">{totals.work_days}</td>
                  <td className="text-right">Rp {fmt(totals.base_salary)}</td>
                  <td className="text-right text-amber-600">Rp {fmt(totals.weekday_ot_amount)}</td>
                  <td className="text-right text-orange-600">Rp {fmt(totals.weekend_ot_amount)}</td>
                  <td className="text-right text-red-600">Rp {fmt(totals.holiday_ot_amount)}</td>
                  <td className="text-right">Rp {fmt(totals.meal_allowance_amount)}</td>
                  <td className="text-right text-green-600">Rp {fmt(totals.total_salary)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-3">Klik baris untuk melihat rincian lembur per tipe hari.</p>
    </div>
  );
}
