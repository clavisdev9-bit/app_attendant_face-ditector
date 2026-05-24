import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import ScanStation from "./pages/ScanStation";
import Employees from "./pages/Employees";
import Reports from "./pages/Reports";
import "./styles/global.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "scan",      label: "Absensi",   icon: "⬢" },
  { id: "employees", label: "Karyawan",  icon: "◈" },
  { id: "reports",   label: "Laporan",   icon: "◉" },
];

export default function App() {
  const [page, setPage] = useState("scan");

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">◈</div>
          <div>
            <div className="brand-name">HADIR</div>
            <div className="brand-sub">Attendance System</div>
          </div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-dot" />
          <span>Sistem Online</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {page === "dashboard"  && <Dashboard  onNavigate={setPage} />}
        {page === "scan"       && <ScanStation />}
        {page === "employees"  && <Employees />}
        {page === "reports"    && <Reports />}
      </main>
    </div>
  );
}
