import { useState } from "react";
import { attendanceApi } from "../utils/api";
import * as XLSX from "xlsx";

const STATUS_LABELS = {
  present: "Hadir",
  late: "Terlambat",
  absent: "Tidak Hadir",
  half_day: "Setengah Hari",
};

export default function Reports() {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate]     = useState(today);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const handleLoad = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await attendanceApi.export(startDate, endDate);
      setData(result);
    } catch (e) {
      setError(e.message);
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!data?.length) return;

    const rows = data.map((r) => ({
      "Tanggal":     r.tanggal,
      "ID Karyawan": r.employee_id,
      "Nama":        r.nama,
      "Departemen":  r.departemen,
      "Jabatan":     r.jabatan,
      "Jam Masuk":   r.jam_masuk,
      "Jam Keluar":  r.jam_keluar,
      "Durasi":      r.durasi,
      "Status":      STATUS_LABELS[r.status] || r.status,
      "Metode":      r.metode,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 14 },
      { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 14 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");

    // Summary sheet
    const summary = buildSummary(data);
    const ws2 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws2, "Ringkasan");

    XLSX.writeFile(wb, `Laporan_Absensi_${startDate}_${endDate}.xlsx`);
  };

  const buildSummary = (rows) => {
    const byEmployee = {};
    rows.forEach((r) => {
      if (!byEmployee[r.employee_id]) {
        byEmployee[r.employee_id] = {
          "ID": r.employee_id, "Nama": r.nama,
          "Departemen": r.departemen,
          "Hadir": 0, "Terlambat": 0, "Tidak Hadir": 0, "Setengah Hari": 0
        };
      }
      const key = STATUS_LABELS[r.status] || r.status;
      if (byEmployee[r.employee_id][key] !== undefined) byEmployee[r.employee_id][key]++;
    });
    return Object.values(byEmployee);
  };

  // Quick presets
  const setPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  // Summary stats
  const stats = data ? {
    total: data.length,
    hadir: data.filter((r) => r.status === "present").length,
    terlambat: data.filter((r) => r.status === "late").length,
    absen: data.filter((r) => r.status === "absent").length,
  } : null;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Laporan Absensi</h1>
          <p className="page-sub">Filter, lihat, dan export data kehadiran</p>
        </div>
        {data?.length > 0 && (
          <button className="btn btn-primary" onClick={handleExportExcel}>
            ↓ Export Excel
          </button>
        )}
      </div>

      {/* Filter panel */}
      <div className="card mb-4">
        <p className="card-title">◈ Filter Tanggal</p>
        <div className="flex gap-4 items-center" style={{ flexWrap: "wrap" }}>
          <div className="input-group">
            <label className="input-label">Dari Tanggal</label>
            <input type="date" className="input" value={startDate}
              max={endDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Sampai Tanggal</label>
            <input type="date" className="input" value={endDate}
              min={startDate} max={today} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", paddingBottom: 0, marginTop: "auto" }}>
            {[
              { label: "Hari ini", days: 1 },
              { label: "7 hari",   days: 7 },
              { label: "30 hari",  days: 30 },
            ].map(({ label, days }) => (
              <button key={days} className="btn btn-outline" style={{ fontSize: 12, padding: "8px 12px" }}
                onClick={() => setPreset(days)}>
                {label}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleLoad} disabled={loading}
            style={{ marginTop: "auto" }}>
            {loading ? "Memuat..." : "Tampilkan"}
          </button>
        </div>
      </div>

      {error && !data && (
        <div style={{ background: "var(--red-dim)", border: "1px solid rgba(255,77,106,0.3)", borderRadius: "var(--radius)", padding: 12, marginBottom: 16, color: "var(--red)", fontSize: 13 }}>
          ⚠ {error} — Menampilkan data demo.
        </div>
      )}

      {/* Summary stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
          {[
            { label: "Total Catatan", value: stats.total, cls: "blue" },
            { label: "Hadir",         value: stats.hadir,     cls: "green" },
            { label: "Terlambat",     value: stats.terlambat, cls: "yellow" },
            { label: "Absen",         value: stats.absen,     cls: "red" },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`stat-card ${cls}`}>
              <p className="stat-label">{label}</p>
              <p className="stat-value">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Data table */}
      {data && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="card-title" style={{ margin: 0 }}>
              ◈ Detail Absensi ({data.length} record)
            </p>
          </div>
          <div className="table-wrap" style={{ maxHeight: 480, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama</th>
                  <th>Departemen</th>
                  <th>Jam Masuk</th>
                  <th>Jam Keluar</th>
                  <th>Durasi</th>
                  <th>Status</th>
                  <th>Metode</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.tanggal}</td>
                    <td style={{ fontWeight: 700 }}>{r.nama}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{r.departemen}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{r.jam_masuk}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{r.jam_keluar}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.durasi}</td>
                    <td>
                      <span className={`badge badge-${
                        r.status === "present"  ? "present" :
                        r.status === "late"     ? "late" :
                        r.status === "half_day" ? "half" : "absent"
                      }`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{r.metode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>◉</div>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.05em" }}>
            Pilih rentang tanggal dan klik Tampilkan
          </p>
        </div>
      )}
    </div>
  );
}

const DEMO_DATA = [
  { tanggal: new Date().toISOString().split("T")[0], employee_id: "EMP001", nama: "Budi Santoso",   departemen: "Engineering", jabatan: "Senior Engineer", jam_masuk: "07:58:23", jam_keluar: "17:02:11", durasi: "9j 3m",  status: "present",  metode: "card+face" },
  { tanggal: new Date().toISOString().split("T")[0], employee_id: "EMP002", nama: "Sari Dewi",      departemen: "Marketing",   jabatan: "Marketing Lead",  jam_masuk: "08:22:45", jam_keluar: "17:15:33", durasi: "8j 52m", status: "late",     metode: "card+face" },
  { tanggal: new Date().toISOString().split("T")[0], employee_id: "EMP003", nama: "Ahmad Rauf",     departemen: "HR",          jabatan: "HR Manager",      jam_masuk: "07:55:00", jam_keluar: "17:00:00", durasi: "9j 5m",  status: "present",  metode: "card+face" },
  { tanggal: new Date().toISOString().split("T")[0], employee_id: "EMP004", nama: "Linda Putri",    departemen: "Finance",     jabatan: "Accountant",      jam_masuk: "-",        jam_keluar: "-",        durasi: "-",      status: "absent",   metode: "-" },
  { tanggal: new Date().toISOString().split("T")[0], employee_id: "EMP005", nama: "Dian Purnama",   departemen: "Operations",  jabatan: "Ops Lead",        jam_masuk: "08:05:12", jam_keluar: "12:10:00", durasi: "4j 4m",  status: "half_day", metode: "card+face" },
];
