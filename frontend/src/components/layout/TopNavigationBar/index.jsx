import { useState, useRef, useEffect } from 'react';
import LeftSideBarToggle from './components/LeftSideBarToggle';
import ProfileDropdown   from './components/ProfileDropdown';
import ThemeModeToggle   from './components/ThemeModeToggle';
import IconifyIcon       from '../../wrappers/IconifyIcon';

const NOTIFICATIONS = [
  { id: 1, icon: 'bx:user-check',      color: 'success', text: 'Andi Wijaya telah absen masuk',     time: '2 menit lalu' },
  { id: 2, icon: 'bx:time',            color: 'warning', text: '3 karyawan terlambat hari ini',     time: '15 menit lalu' },
  { id: 3, icon: 'bx:calendar-check',  color: 'info',    text: 'Pengajuan cuti baru dari Sari D.',  time: '1 jam lalu' },
  { id: 4, icon: 'bx:user-x',          color: 'danger',  text: 'Budi Santoso belum absen',          time: '2 jam lalu' },
];

const NotificationDropdown = () => {
  const [open, setOpen]   = useState(false);
  const [read, setRead]   = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="topbar-item" ref={ref}>
      <div className={`dropdown${open ? ' show' : ''}`}>
        <button
          type="button"
          className="topbar-button position-relative"
          onClick={() => { setOpen((v) => !v); setRead(true); }}
        >
          <IconifyIcon icon="bx:bell" className="fs-22 align-middle" />
          {!read && (
            <span
              className="badge bg-danger rounded-circle topbar-badge"
              style={{ width: 8, height: 8, padding: 0, position: 'absolute', top: 8, right: 8 }}
            />
          )}
        </button>

        {open && (
          <div
            className="dropdown-menu dropdown-menu-end show"
            style={{ minWidth: 320, maxWidth: 360 }}
          >
            <div className="dropdown-header d-flex align-items-center justify-content-between px-3 py-2">
              <h6 className="mb-0 fw-semibold">Notifikasi</h6>
              <span className="badge bg-primary-subtle text-primary rounded-pill">
                {NOTIFICATIONS.length}
              </span>
            </div>
            <div className="dropdown-divider my-0" />

            {NOTIFICATIONS.map((n) => (
              <div key={n.id} className="dropdown-item d-flex align-items-start gap-3 py-2">
                <div
                  className={`avatar-xs rounded-circle d-flex align-items-center justify-content-center flex-shrink-0`}
                  style={{
                    width: 36, height: 36,
                    background: `rgba(var(--bs-${n.color}-rgb), 0.15)`,
                  }}
                >
                  <IconifyIcon icon={n.icon} className={`text-${n.color} fs-16`} />
                </div>
                <div className="flex-grow-1 overflow-hidden">
                  <p className="mb-0 text-truncate" style={{ fontSize: 13 }}>{n.text}</p>
                  <small className="text-muted">{n.time}</small>
                </div>
              </div>
            ))}

            <div className="dropdown-divider my-0" />
            <div className="text-center py-2">
              <button className="btn btn-sm btn-link text-muted" style={{ fontSize: 12 }}>
                Lihat semua notifikasi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TopNavigationBar = ({ breadcrumb }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal,  setSearchVal]  = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  return (
    <header className="topbar">
      <div className="container-xxl">
        <div className="navbar-header">
          {/* ── Left ── */}
          <div className="d-flex align-items-center gap-2">
            <LeftSideBarToggle />

            {/* Search (desktop) */}
            <div className="app-search d-none d-md-flex position-relative align-items-center">
              <IconifyIcon icon="bx:search" className="search-widget-icon" />
              <input
                type="text"
                className="form-control"
                placeholder="Cari karyawan, laporan..."
                style={{ width: 240 }}
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
            </div>

            {/* Breadcrumb */}
            {!searchOpen && breadcrumb && (
              <div className="d-none d-sm-flex d-md-none align-items-center gap-1 ms-1">
                {breadcrumb.group && (
                  <>
                    <span className="text-muted small">{breadcrumb.group}</span>
                    <IconifyIcon icon="bx:chevron-right" className="text-muted fs-14" />
                  </>
                )}
                <span className="fw-semibold small">{breadcrumb.label}</span>
              </div>
            )}
          </div>

          {/* ── Right ── */}
          <div className="d-flex align-items-center gap-1">
            {/* Mobile search toggle */}
            <div className="topbar-item d-flex d-md-none">
              <button className="topbar-button" onClick={() => setSearchOpen((v) => !v)}>
                <IconifyIcon icon={searchOpen ? 'bx:x' : 'bx:search'} className="fs-22 align-middle" />
              </button>
            </div>

            <ThemeModeToggle />
            <NotificationDropdown />
            <ProfileDropdown />
          </div>
        </div>

        {/* Mobile search bar (expands below on small screens) */}
        {searchOpen && (
          <div className="pb-2 d-md-none">
            <div className="app-search position-relative">
              <IconifyIcon icon="bx:search" className="search-widget-icon" />
              <input
                ref={searchRef}
                type="text"
                className="form-control"
                placeholder="Cari karyawan, laporan..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopNavigationBar;
