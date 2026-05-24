import { useState, useEffect } from "react";
import { attendanceApi } from "../utils/api";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const MOCK_STATS = {
  today: { total_employees: 42, present: 38, absent: 4, late: 5, on_time: 33, attendance_rate: 90.5 },
  departments: [
    { department: "Engineering",  total: 12, present: 11, absent: 1 },
    { department: "Marketing",    total: 8,  present: 7,  absent: 1 },
    { department: "HR",           total: 5,  present: 5,  absent: 0 },
    { department: "Finance",      total: 7,  present: 6,  absent: 1 },
    { department: "Operations",   total: 10, present: 9,  absent: 1 },
  ],
  daily_trend: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    present: Math.floor(Math.random() * 8) + 34,
  })),
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "8px 12px",
      fontFamily: "var(--font-mono)", fontSize: 12
    }}>
      <p style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi.stats()
      .then(setStats)
      .catch(() => setStats(MOCK_STATS))
      .finally(() => setLoading(false));
  }, []);

  const s = stats?.today || MOCK_STATS.today;
  const depts = stats?.departments || MOCK_STATS.departments;
  const trend = stats?.daily_trend || MOCK_STATS.daily_trend;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: 13, letterSpacing: "0.1em" }}>
        Memuat data...
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate("scan")}>
          ⬢ Buka Terminal Absensi
        </button>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card green">
          <p className="stat-label">Hadir Hari Ini</p>
          <p className="stat-value">{s.present}</p>
          <p className="stat-meta">dari {s.total_employees} karyawan</p>
        </div>
        <div className="stat-card red">
          <p className="stat-label">Tidak Hadir</p>
          <p className="stat-value">{s.absent}</p>
          <p className="stat-meta">karyawan</p>
        </div>
        <div className="stat-card yellow">
          <p className="stat-label">Terlambat</p>
          <p className="stat-value">{s.late}</p>
          <p className="stat-meta">karyawan</p>
        </div>
        <div className="stat-card blue">
          <p className="stat-label">Kehadiran</p>
          <p className="stat-value">{s.attendance_rate}%</p>
          <p className="stat-meta">tingkat kehadiran</p>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Trend chart */}
        <div className="card">
          <p className="card-title">◈ Tren Kehadiran 14 Hari</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "Space Mono" }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone" dataKey="present" name="Hadir"
                stroke="var(--accent)" strokeWidth={2}
                dot={{ fill: "var(--accent)", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Dept chart */}
        <div className="card">
          <p className="card-title">◈ Kehadiran per Departemen</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={depts} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="department"
                tick={{ fill: "var(--text-muted)", fontSize: 9, fontFamily: "Space Mono" }}
                interval={0} angle={-20} textAnchor="end"
              />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="present" name="Hadir" fill="var(--accent)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="absent"  name="Absen"  fill="var(--red)"    radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department table */}
      <div className="card">
        <p className="card-title">◈ Ringkasan Departemen</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Departemen</th>
                <th>Total</th>
                <th>Hadir</th>
                <th>Absen</th>
                <th>Kehadiran</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => {
                const pct = Math.round((d.present / d.total) * 100);
                return (
                  <tr key={d.department}>
                    <td style={{ fontWeight: 700 }}>{d.department}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{d.total}</td>
                    <td style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{d.present}</td>
                    <td style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}>{d.absent}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{pct}%</td>
                    <td style={{ width: 160 }}>
                      <div style={{
                        height: 6, borderRadius: 3, background: "var(--bg-raised)",
                        overflow: "hidden"
                      }}>
                        <div style={{
                          width: `${pct}%`, height: "100%",
                          background: pct >= 90 ? "var(--accent)" : pct >= 70 ? "var(--yellow)" : "var(--red)",
                          borderRadius: 3, transition: "width 0.5s ease"
                        }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
