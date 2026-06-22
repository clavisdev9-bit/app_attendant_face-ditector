import { useState } from 'react';
import { attendanceApi, reportsApi } from '../utils/api';
import * as XLSX from 'xlsx';
import IconifyIcon from '../components/wrappers/IconifyIcon';
import Badge from '../components/ui/Badge';

const TABS = [
  { id: 'attendance', label: 'Kehadiran' },
  { id: 'department', label: 'Departemen' },
  { id: 'leave',      label: 'Cuti' },
  { id: 'overtime',   label: 'Lembur' },
  { id: 'payroll',    label: 'Payroll' },
];

const STATUS_LABELS = {
  present: 'Hadir',
  late: 'Terlambat',
  absent: 'Tidak Hadir',
  half_day: 'Setengah Hari',
};

const STATUS_VARIANT = { present: 'success', late: 'warning', absent: 'danger', half_day: 'info' };

export default function Reports() {
  const today    = new Date().toISOString().split('T')[0];
  const thisYear = new Date().getFullYear();

  const [activeTab,    setActiveTab]    = useState('attendance');
  const [startDate,    setStartDate]    = useState(today);
  const [endDate,      setEndDate]      = useState(today);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [deptData,     setDeptData]     = useState(null);
  const [leaveData,    setLeaveData]    = useState(null);
  const [otData,       setOtData]       = useState(null);
  const [payrollData,  setPayrollData]  = useState(null);

  const handleLoad = async () => {
    if (!startDate || !endDate) return;
    setLoading(true); setError(null);
    try {
      if (activeTab === 'attendance') {
        setData(await attendanceApi.export(startDate, endDate));
      } else if (activeTab === 'department') {
        setDeptData(await reportsApi.departmentSummary(startDate, endDate));
      } else if (activeTab === 'leave') {
        setLeaveData(await reportsApi.leaveSummary(thisYear));
      } else if (activeTab === 'overtime') {
        setOtData(await reportsApi.overtimeSummary(startDate, endDate));
      } else if (activeTab === 'payroll') {
        setPayrollData(await reportsApi.payrollExport(startDate, endDate));
      }
    } catch (e) {
      setError(e.message);
      if (activeTab === 'attendance') setData(DEMO_DATA);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (data?.length) {
      const rows = data.map((r) => ({
        'Tanggal': r.tanggal, 'ID Karyawan': r.employee_id, 'Nama': r.nama,
        'Departemen': r.departemen, 'Jabatan': r.jabatan,
        'Jam Masuk': r.jam_masuk, 'Jam Keluar': r.jam_keluar,
        'Durasi': r.durasi, 'Status': STATUS_LABELS[r.status] || r.status, 'Metode': r.metode,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Absensi');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSummary(data)), 'Ringkasan');
    }
    if (leaveData?.length) {
      const rows = leaveData.flatMap((emp) => emp.leaves.map((l) => ({
        'ID': emp.employee_id, 'Jenis Cuti': l.leave_type,
        'Saldo': l.total_balance, 'Carry Over': l.carry_over_balance,
        'Terpakai': l.used_balance, 'Sisa': l.remaining_balance,
      })));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Cuti');
    }
    if (otData?.length) {
      const rows = otData.map((r) => ({
        'ID': r.employee_id, 'Nama': r.employee_name, 'Departemen': r.department,
        'Total Request': r.total_requests, 'Total Jam': r.total_actual_hours,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Lembur');
    }
    if (payrollData?.length) {
      const rows = payrollData.map((r) => ({
        'ID': r.employee_id, 'Nama': r.nama, 'Departemen': r.departemen,
        'Tipe': r.employment_type, 'Hari Hadir': r.hari_hadir,
        'Terlambat': r.hari_terlambat, 'WFH': r.hari_wfh, 'Cuti': r.hari_cuti,
        'Lembur (Jam)': r.total_lembur_jam, 'Saldo Cuti Terpakai': r.saldo_cuti_terpakai,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Payroll');
    }
    if (wb.SheetNames.length === 0) return;
    XLSX.writeFile(wb, `Laporan_${startDate}_${endDate}.xlsx`);
  };

  const buildSummary = (rows) => {
    const byEmp = {};
    rows.forEach((r) => {
      if (!byEmp[r.employee_id]) {
        byEmp[r.employee_id] = { 'ID': r.employee_id, 'Nama': r.nama, 'Departemen': r.departemen, 'Hadir': 0, 'Terlambat': 0, 'Tidak Hadir': 0, 'Setengah Hari': 0 };
      }
      const key = STATUS_LABELS[r.status] || r.status;
      if (byEmp[r.employee_id][key] !== undefined) byEmp[r.employee_id][key]++;
    });
    return Object.values(byEmp);
  };

  const setPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const stats = data ? {
    total:     data.length,
    hadir:     data.filter((r) => r.status === 'present').length,
    terlambat: data.filter((r) => r.status === 'late').length,
    absen:     data.filter((r) => r.status === 'absent').length,
  } : null;

  const hasData = data?.length || deptData?.length || leaveData?.length || otData?.length || payrollData?.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Laporan</h1>
          <p className="page-sub">Filter, analisis, dan export data kehadiran, cuti &amp; lembur</p>
        </div>
        {hasData && (
          <button className="btn-primary self-start sm:self-auto" onClick={handleExportExcel}>
            <IconifyIcon icon="bx:download" className="text-base" />
            Export Excel
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-list">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter panel */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Filter Tanggal</h3>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="input-label">Dari Tanggal</label>
              <input type="date" className="input" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="input-label">Sampai Tanggal</label>
              <input type="date" className="input" value={endDate} min={startDate} max={today} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {[{ label: 'Hari ini', days: 1 }, { label: '7 hari', days: 7 }, { label: '30 hari', days: 30 }].map(({ label, days }) => (
                <button key={days} className="btn-outline btn-sm" onClick={() => setPreset(days)}>{label}</button>
              ))}
            </div>
            <button className="btn-primary" onClick={handleLoad} disabled={loading}>
              {loading ? <><span className="spinner w-4 h-4" /> Memuat…</> : <><IconifyIcon icon="bx:search" className="text-base" /> Tampilkan</>}
            </button>
          </div>
        </div>
      </div>

      {error && !data && (
        <div className="alert-warning text-sm">
          <IconifyIcon icon="bx:error" className="text-base flex-shrink-0" />
          {error} — Menampilkan data demo.
        </div>
      )}

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Total Catatan', value: stats.total,     icon: 'bx:list-ul',     color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
            { label: 'Hadir',         value: stats.hadir,     icon: 'bx:user-check',  color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
            { label: 'Terlambat',     value: stats.terlambat, icon: 'bx:time',        color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
            { label: 'Absen',         value: stats.absen,     icon: 'bx:user-x',      color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="card p-5">
              <div className="flex items-start gap-4">
                <div className={`stat-icon text-xl ${color}`}><IconifyIcon icon={icon} /></div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attendance tab data */}
      {activeTab === 'attendance' && data && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Detail Absensi ({data.length} record)</h3>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th><th>Nama</th><th>Departemen</th>
                  <th>Jam Masuk</th><th>Jam Keluar</th><th>Durasi</th><th>Status</th><th>Metode</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{r.tanggal}</td>
                    <td className="font-semibold">{r.nama}</td>
                    <td className="text-slate-400 text-xs">{r.departemen}</td>
                    <td className="font-mono text-sm text-primary-600 dark:text-primary-400">{r.jam_masuk}</td>
                    <td className="font-mono text-sm text-slate-400">{r.jam_keluar}</td>
                    <td className="font-mono text-xs">{r.durasi}</td>
                    <td><Badge variant={STATUS_VARIANT[r.status] || 'gray'}>{STATUS_LABELS[r.status] || r.status}</Badge></td>
                    <td className="font-mono text-xs text-slate-400">{r.metode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Department tab */}
      {activeTab === 'department' && deptData && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Ringkasan per Departemen ({deptData.length} dept)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Departemen</th><th>Karyawan</th><th>Hadir</th>
                  <th>Terlambat</th><th>Cuti</th><th>Absen</th><th>Tingkat Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {deptData.map((d) => {
                  const pct = d.attendance_rate;
                  const barColor = pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <tr key={d.department_id}>
                      <td className="font-semibold">{d.department_name}</td>
                      <td className="font-mono text-sm">{d.total_employees}</td>
                      <td className="font-mono text-sm text-green-600">{d.present}</td>
                      <td className="font-mono text-sm text-amber-600">{d.late}</td>
                      <td className="font-mono text-sm text-blue-600">{d.leave}</td>
                      <td className="font-mono text-sm text-red-600">{d.absent}</td>
                      <td>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 progress-bar">
                            <div className={`progress-fill ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-xs text-slate-400 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave tab */}
      {activeTab === 'leave' && leaveData && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Saldo &amp; Penggunaan Cuti {thisYear}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Karyawan</th><th>Jenis Cuti</th><th>Total Saldo</th>
                  <th>Carry Over</th><th>Terpakai</th><th>Sisa</th>
                </tr>
              </thead>
              <tbody>
                {leaveData.flatMap((emp) =>
                  emp.leaves.map((l, i) => (
                    <tr key={`${emp.employee_id}-${i}`}>
                      {i === 0 && (
                        <td rowSpan={emp.leaves.length} className="font-semibold align-top pt-3">
                          {emp.employee_id}
                        </td>
                      )}
                      <td>{l.leave_type}</td>
                      <td className="font-mono text-sm">{l.total_balance}</td>
                      <td className="font-mono text-sm text-blue-600">{l.carry_over_balance}</td>
                      <td className="font-mono text-sm text-amber-600">{l.used_balance}</td>
                      <td className={`font-mono text-sm font-semibold ${l.remaining_balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {l.remaining_balance}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overtime tab */}
      {activeTab === 'overtime' && otData && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Ringkasan Lembur ({otData.length} karyawan)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Nama</th><th>Departemen</th><th>Total Request</th><th>Total Jam</th></tr>
              </thead>
              <tbody>
                {otData.map((r) => (
                  <tr key={r.employee_id}>
                    <td className="font-mono text-xs text-slate-400">{r.employee_id}</td>
                    <td className="font-semibold">{r.employee_name}</td>
                    <td className="text-slate-400">{r.department}</td>
                    <td className="font-mono text-sm">{r.total_requests}</td>
                    <td className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">{r.total_actual_hours}j</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll tab */}
      {activeTab === 'payroll' && payrollData && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Data Payroll ({payrollData.length} karyawan)</h3>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Nama</th><th>Dept</th><th>Tipe</th>
                  <th>Hadir</th><th>Terlambat</th><th>WFH</th><th>Cuti</th>
                  <th>Lembur (jam)</th><th>Saldo Cuti</th>
                </tr>
              </thead>
              <tbody>
                {payrollData.map((r) => (
                  <tr key={r.employee_id}>
                    <td className="font-mono text-xs text-slate-400">{r.employee_id}</td>
                    <td className="font-semibold">{r.nama}</td>
                    <td className="text-slate-400 text-xs">{r.departemen}</td>
                    <td><Badge variant="info">{r.employment_type}</Badge></td>
                    <td className="font-mono text-sm text-green-600">{r.hari_hadir}</td>
                    <td className="font-mono text-sm text-amber-600">{r.hari_terlambat}</td>
                    <td className="font-mono text-sm text-blue-600">{r.hari_wfh}</td>
                    <td className="font-mono text-sm">{r.hari_cuti}</td>
                    <td className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">{r.total_lembur_jam}</td>
                    <td className="font-mono text-sm text-slate-400">{r.saldo_cuti_terpakai}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasData && !loading && (
        <div className="card">
          <div className="empty-state py-16">
            <IconifyIcon icon="bx:bar-chart-alt-2" className="empty-icon" />
            <p className="empty-title">Belum ada data</p>
            <p className="empty-sub">Pilih rentang tanggal dan klik Tampilkan</p>
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_DATA = [
  { tanggal: new Date().toISOString().split('T')[0], employee_id: 'EMP001', nama: 'Budi Santoso',  departemen: 'Engineering', jabatan: 'Senior Engineer', jam_masuk: '07:58:23', jam_keluar: '17:02:11', durasi: '9j 3m',  status: 'present',  metode: 'card+face' },
  { tanggal: new Date().toISOString().split('T')[0], employee_id: 'EMP002', nama: 'Sari Dewi',     departemen: 'Marketing',   jabatan: 'Marketing Lead',  jam_masuk: '08:22:45', jam_keluar: '17:15:33', durasi: '8j 52m', status: 'late',     metode: 'card+face' },
  { tanggal: new Date().toISOString().split('T')[0], employee_id: 'EMP003', nama: 'Ahmad Rauf',    departemen: 'HR',          jabatan: 'HR Manager',      jam_masuk: '07:55:00', jam_keluar: '17:00:00', durasi: '9j 5m',  status: 'present',  metode: 'card+face' },
  { tanggal: new Date().toISOString().split('T')[0], employee_id: 'EMP004', nama: 'Linda Putri',   departemen: 'Finance',     jabatan: 'Accountant',      jam_masuk: '-',        jam_keluar: '-',        durasi: '-',      status: 'absent',   metode: '-'         },
  { tanggal: new Date().toISOString().split('T')[0], employee_id: 'EMP005', nama: 'Dian Purnama',  departemen: 'Operations',  jabatan: 'Ops Lead',        jam_masuk: '08:05:12', jam_keluar: '12:10:00', durasi: '4j 4m',  status: 'half_day', metode: 'card+face' },
];
