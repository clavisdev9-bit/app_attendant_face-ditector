import { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { attendanceApi } from '../utils/api';
import IconifyIcon from '../components/wrappers/IconifyIcon';
import { PageSpinner } from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';

/* ── mock data ───────────────────────────────────────────────────────────── */
const MOCK = {
  today: { total_employees: 42, present: 38, absent: 4, late: 5, on_time: 33, attendance_rate: 90.5 },
  departments: [
    { department: 'Engineering', total: 12, present: 11, absent: 1 },
    { department: 'Marketing',   total: 8,  present: 7,  absent: 1 },
    { department: 'HR',          total: 5,  present: 5,  absent: 0 },
    { department: 'Finance',     total: 7,  present: 6,  absent: 1 },
    { department: 'Operations',  total: 10, present: 9,  absent: 1 },
  ],
  daily_trend: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    present: Math.floor(Math.random() * 8) + 34,
  })),
  recent: [
    { name: 'Andi Wijaya',   dept: 'Engineering', time: '07:52', status: 'PRESENT' },
    { name: 'Sari Dewi',     dept: 'HR',          time: '08:03', status: 'PRESENT' },
    { name: 'Budi Santoso',  dept: 'Finance',     time: '08:21', status: 'LATE'    },
    { name: 'Maya Putri',    dept: 'Marketing',   time: '07:45', status: 'PRESENT' },
    { name: 'Rizki Pratama', dept: 'Operations',  time: '—',     status: 'ABSENT'  },
  ],
};

/* ── stat cards ──────────────────────────────────────────────────────────── */
const STATS = (s) => [
  { label: 'Hadir Hari Ini', value: s.present,          sub: `dari ${s.total_employees} karyawan`, icon: 'bx:user-check',   color: 'text-green-600  bg-green-100  dark:bg-green-900/30' },
  { label: 'Tidak Hadir',    value: s.absent,           sub: 'karyawan',                            icon: 'bx:user-x',       color: 'text-red-600    bg-red-100    dark:bg-red-900/30'   },
  { label: 'Terlambat',      value: s.late,             sub: 'karyawan',                            icon: 'bx:time',         color: 'text-amber-600  bg-amber-100  dark:bg-amber-900/30' },
  { label: 'Tingkat Hadir',  value: `${s.attendance_rate}%`, sub: 'hari ini',                  icon: 'bx:trending-up',  color: 'text-primary-600 bg-primary-100 dark:bg-primary-900/30' },
];

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className={`stat-icon text-xl ${color}`}>
          <IconifyIcon icon={icon} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
        </div>
      </div>
    </div>
  );
}

/* ── trend chart ─────────────────────────────────────────────────────────── */
function TrendChart({ data }) {
  const opt = {
    chart: { type: 'area', toolbar: { show: false }, sparkline: { enabled: false } },
    stroke: { curve: 'smooth', width: 2 },
    fill:   { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02 } },
    xaxis:  { categories: data.map((d) => d.date), labels: { style: { fontSize: '11px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis:  { labels: { style: { fontSize: '11px', colors: '#94a3b8' } } },
    colors: ['#185FA5'],
    grid:   { borderColor: '#e2e8f0', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v) => `${v} orang` } },
  };
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Tren Kehadiran 14 Hari</h3>
      </div>
      <div className="p-4">
        <ReactApexChart options={opt} series={[{ name: 'Hadir', data: data.map((d) => d.present) }]} type="area" height={220} />
      </div>
    </div>
  );
}

/* ── donut chart ─────────────────────────────────────────────────────────── */
function DonutChart({ present, total }) {
  const absent = total - present;
  const opt = {
    chart: { type: 'donut' },
    labels: ['Hadir', 'Tidak Hadir'],
    colors: ['#185FA5', '#ef4444'],
    legend: { position: 'bottom', fontSize: '12px' },
    dataLabels: { enabled: true, formatter: (v) => `${v.toFixed(0)}%` },
    plotOptions: { pie: { donut: { size: '60%' } } },
    stroke: { width: 0 },
  };
  return (
    <div className="card h-full">
      <div className="card-header">
        <h3 className="card-title">Distribusi Kehadiran</h3>
      </div>
      <div className="p-4 flex items-center justify-center">
        <ReactApexChart options={opt} series={[present, absent]} type="donut" height={240} />
      </div>
    </div>
  );
}

/* ── dept bar chart ──────────────────────────────────────────────────────── */
function DeptChart({ data }) {
  const opt = {
    chart: { type: 'bar', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
    dataLabels: { enabled: false },
    xaxis: { categories: data.map((d) => d.department), labels: { style: { fontSize: '11px', colors: '#94a3b8' } } },
    yaxis: { labels: { style: { fontSize: '11px', colors: '#94a3b8' } } },
    colors: ['#185FA5', '#ef4444'],
    grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
    legend: { position: 'top' },
    tooltip: { y: { formatter: (v) => `${v} orang` } },
  };
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Kehadiran per Departemen</h3>
      </div>
      <div className="p-4">
        <ReactApexChart
          options={opt}
          series={[{ name: 'Hadir', data: data.map((d) => d.present) }, { name: 'Absen', data: data.map((d) => d.absent) }]}
          type="bar"
          height={220}
        />
      </div>
    </div>
  );
}

/* ── recent table ────────────────────────────────────────────────────────── */
function RecentTable({ data }) {
  const MAP = { PRESENT: 'success', LATE: 'warning', ABSENT: 'danger' };
  const LABEL = { PRESENT: 'Hadir', LATE: 'Terlambat', ABSENT: 'Absen' };
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Absensi Terkini</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Departemen</th>
              <th>Waktu</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i}>
                <td className="font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                <td className="text-slate-500">{r.dept}</td>
                <td className="font-mono text-sm">{r.time}</td>
                <td><Badge variant={MAP[r.status]} dot>{LABEL[r.status]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── dept progress table ─────────────────────────────────────────────────── */
function DeptProgress({ data }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Ringkasan Departemen</h3>
      </div>
      <div className="p-5 space-y-4">
        {data.map((d) => {
          const pct = Math.round((d.present / d.total) * 100);
          const color = pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
          const textColor = pct >= 90 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600';
          return (
            <div key={d.department}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{d.department}</span>
                <span className={`text-xs font-semibold ${textColor}`}>{pct}%</span>
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-400">{d.present}/{d.total} hadir</span>
                {d.absent > 0 && <span className="text-xs text-red-400">{d.absent} absen</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── main ────────────────────────────────────────────────────────────────── */
export default function Dashboard({ onNavigate }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi.stats().then(setStats).catch(() => setStats(MOCK)).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  const s     = stats?.today      || MOCK.today;
  const depts = stats?.departments || MOCK.departments;
  const trend = stats?.daily_trend || MOCK.daily_trend;
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{today}</p>
        </div>
        <button className="btn-primary self-start sm:self-auto" onClick={() => onNavigate('scan')}>
          <IconifyIcon icon="bx:scan" className="text-base" />
          Terminal Absensi
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS(s).map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><TrendChart data={trend} /></div>
        <div><DonutChart present={s.present} total={s.total_employees} /></div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DeptChart data={depts} />
        <DeptProgress data={depts} />
      </div>

      {/* Recent table */}
      <RecentTable data={MOCK.recent} />
    </div>
  );
}
