import { useState, useEffect } from 'react';
import { contractorApi } from '../utils/api';
import IconifyIcon from '../components/wrappers/IconifyIcon';

const fmt = (n) => new Intl.NumberFormat('id-ID').format(Math.round(n || 0));

const now = new Date();
const CUR_MONTH = now.getMonth() + 1;
const CUR_YEAR  = now.getFullYear();
const MONTHS    = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

function exportCSV(filename, headers, rows) {
  const lines = [headers.join(','), ...rows.map(r => r.join(','))];
  const blob  = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function isNetworkError(e) {
  const msg = e?.message || '';
  return msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('NetworkError');
}

export default function ContractorReports() {
  const [tab, setTab]           = useState('attendance');
  const [projects, setProjects] = useState([]);
  const [selProject, setSelProject] = useState('');
  const [month, setMonth]       = useState(CUR_MONTH);
  const [year, setYear]         = useState(CUR_YEAR);
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    contractorApi.listProjects()
      .then(setProjects)
      .catch((e) => {
        if (isNetworkError(e)) { setBackendDown(true); return; }
        setError(e.message || 'Gagal memuat daftar proyek');
      });
  }, []);

  const load = async () => {
    if (!selProject) return;
    setLoading(true);
    setError(null);
    try {
      let res;
      if      (tab === 'attendance')   res = await contractorApi.reportAttendance(selProject, month, year);
      else if (tab === 'overtime')     res = await contractorApi.reportOvertime(selProject, month, year);
      else if (tab === 'payroll')      res = await contractorApi.reportPayroll(selProject, month, year);
      else                             res = await contractorApi.reportProductivity(selProject, month, year);
      setData(res.data || []);
    } catch (e) {
      if (isNetworkError(e)) { setBackendDown(true); return; }
      setError(e.message || 'Gagal memuat data');
      setData([]);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab, selProject, month, year]);

  const handleExport = () => {
    const proj = projects.find(p => String(p.id) === String(selProject));
    const suffix = `${proj?.project_code || 'proj'}_${year}-${String(month).padStart(2,'0')}`;

    if (tab === 'attendance') {
      exportCSV(`absensi_${suffix}.csv`,
        ['NIK','Nama','Skill','Hari Kerja','Terlambat','Alpha','Total Jam Kerja'],
        data.map(r => [r.employee_id, r.employee_name, r.skill || '', r.work_days, r.late_days, r.absent_days, r.total_work_hours])
      );
    } else if (tab === 'overtime') {
      exportCSV(`lembur_${suffix}.csv`,
        ['NIK','Nama','Tanggal','Mulai','Selesai','Total Jam','Status','Approver'],
        data.map(r => [r.employee_id, r.employee_name, r.date, r.ot_start, r.ot_end, r.total_hours, r.status, r.approved_by || ''])
      );
    } else if (tab === 'payroll') {
      exportCSV(`payroll_${suffix}.csv`,
        ['NIK','Nama','Hari Kerja','Gaji Pokok','Jam Lembur','Uang Lembur','Uang Makan','Potongan','Total','Status'],
        data.map(r => [r.employee_id, r.employee_name, r.work_days, r.base_salary, r.overtime_hours, r.overtime_amount, r.meal_allowance_amount, r.deductions, r.total_salary, r.status])
      );
    } else {
      exportCSV(`produktivitas_${suffix}.csv`,
        ['NIK','Nama','Skill','Jam Kerja','Jam Lembur','Biaya Tenaga Kerja'],
        data.map(r => [r.employee_id, r.employee_name, r.skill || '', r.work_hours, r.overtime_hours, r.labor_cost])
      );
    }
  };

  const TABS = [
    { id: 'attendance',   label: 'Absensi',       icon: 'bx:calendar-check' },
    { id: 'overtime',     label: 'Lembur',         icon: 'bx:time' },
    { id: 'payroll',      label: 'Payroll',        icon: 'bx:money' },
    { id: 'productivity', label: 'Produktivitas',  icon: 'bx:bar-chart' },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Laporan Kontraktor</h1>
          <p className="text-sm text-slate-500 mt-1">4 jenis laporan operasional pekerja kontraktor</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport} disabled={!selProject || !data.length}>
          <IconifyIcon icon="bx:download" /> Export CSV
        </button>
      </div>

      {backendDown && (
        <div className="alert-danger text-sm mb-4 flex items-center gap-2">
          <IconifyIcon icon="bx:wifi-off" className="text-base flex-shrink-0" />
          Tidak dapat terhubung ke server. Periksa koneksi atau coba beberapa saat lagi.
        </div>
      )}
      {error && !backendDown && (
        <div className="alert-danger text-sm mb-4 flex items-center gap-2">
          <IconifyIcon icon="bx:error-circle" className="text-base flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Tab + filter */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-600 dark:text-slate-300'}`}>
                  <IconifyIcon icon={t.icon} /> {t.label}
                </button>
              ))}
            </div>

            <select className="form-control w-48" value={selProject} onChange={e => setSelProject(e.target.value)}>
              <option value="">-- Pilih Proyek --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>

            <select className="form-control w-28" value={month} onChange={e => setMonth(+e.target.value)}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>

            <select className="form-control w-24" value={year} onChange={e => setYear(+e.target.value)}>
              {[CUR_YEAR-1, CUR_YEAR, CUR_YEAR+1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="spinner w-8 h-8" />
            </div>
          ) : (
            <>
              {/* Absensi */}
              {tab === 'attendance' && (
                <table className="table text-sm">
                  <thead><tr><th>NIK</th><th>Nama</th><th>Skill</th><th className="text-right">Hari Kerja</th><th className="text-right">Terlambat</th><th className="text-right">Alpha</th><th className="text-right">Total Jam</th></tr></thead>
                  <tbody>
                    {data.map(r => (
                      <tr key={r.employee_id}>
                        <td className="font-mono text-xs">{r.employee_id}</td>
                        <td className="font-medium">{r.employee_name}</td>
                        <td><span className="badge badge-info">{r.skill || '-'}</span></td>
                        <td className="text-right">{r.work_days}</td>
                        <td className="text-right text-orange-600">{r.late_days}</td>
                        <td className="text-right text-red-600">{r.absent_days}</td>
                        <td className="text-right">{r.total_work_hours} jam</td>
                      </tr>
                    ))}
                    {!data.length && <tr><td colSpan={7} className="text-center py-8 text-slate-400">Tidak ada data</td></tr>}
                  </tbody>
                </table>
              )}

              {/* Lembur */}
              {tab === 'overtime' && (
                <table className="table text-sm">
                  <thead><tr><th>NIK</th><th>Nama</th><th>Tanggal</th><th>Jam Mulai</th><th>Jam Selesai</th><th className="text-right">Total Jam</th><th>Status</th><th>Approver</th></tr></thead>
                  <tbody>
                    {data.map((r, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs">{r.employee_id}</td>
                        <td className="font-medium">{r.employee_name}</td>
                        <td>{r.date}</td>
                        <td>{r.ot_start}</td>
                        <td>{r.ot_end || '-'}</td>
                        <td className="text-right font-medium">{r.total_hours} jam</td>
                        <td>
                          <span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="text-slate-500">{r.approved_by || '-'}</td>
                      </tr>
                    ))}
                    {!data.length && <tr><td colSpan={8} className="text-center py-8 text-slate-400">Tidak ada data</td></tr>}
                  </tbody>
                </table>
              )}

              {/* Payroll */}
              {tab === 'payroll' && (
                <table className="table text-sm">
                  <thead><tr><th>NIK</th><th>Nama</th><th className="text-right">Hari</th><th className="text-right">Gaji Pokok</th><th className="text-right">Lembur</th><th className="text-right">Uang Makan</th><th className="text-right">Total</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.map(r => (
                      <tr key={r.employee_id}>
                        <td className="font-mono text-xs">{r.employee_id}</td>
                        <td className="font-medium">{r.employee_name}</td>
                        <td className="text-right">{r.work_days}</td>
                        <td className="text-right">Rp {fmt(r.base_salary)}</td>
                        <td className="text-right text-orange-600">Rp {fmt(r.overtime_amount)}</td>
                        <td className="text-right">Rp {fmt(r.meal_allowance_amount)}</td>
                        <td className="text-right font-bold text-green-600">Rp {fmt(r.total_salary)}</td>
                        <td><span className={`badge ${r.status === 'finalized' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span></td>
                      </tr>
                    ))}
                    {!data.length && <tr><td colSpan={8} className="text-center py-8 text-slate-400">Tidak ada data</td></tr>}
                  </tbody>
                </table>
              )}

              {/* Produktivitas */}
              {tab === 'productivity' && (
                <table className="table text-sm">
                  <thead><tr><th>NIK</th><th>Nama</th><th>Skill</th><th className="text-right">Jam Kerja</th><th className="text-right">Jam Lembur</th><th className="text-right">Biaya Tenaga Kerja</th></tr></thead>
                  <tbody>
                    {data.map(r => (
                      <tr key={r.employee_id}>
                        <td className="font-mono text-xs">{r.employee_id}</td>
                        <td className="font-medium">{r.employee_name}</td>
                        <td><span className="badge badge-info">{r.skill || '-'}</span></td>
                        <td className="text-right">{r.work_hours} jam</td>
                        <td className="text-right text-orange-600">{r.overtime_hours} jam</td>
                        <td className="text-right font-medium text-green-600">Rp {fmt(r.labor_cost)}</td>
                      </tr>
                    ))}
                    {!data.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Tidak ada data</td></tr>}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
