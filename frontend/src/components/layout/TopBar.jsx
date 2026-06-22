import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { useLayoutContext } from '../../context/useLayoutContext';
import { useAuth }         from '../../context/AuthContext';
import IconifyIcon         from '../wrappers/IconifyIcon';
import Avatar              from '../ui/Avatar';

/* ── Notifications ───────────────────────────────────────────────────────── */
const NOTIFS = [
  { id: 1, icon: 'bx:user-check', color: 'text-green-500 bg-green-50 dark:bg-green-900/30', text: 'Andi Wijaya telah absen masuk', time: '2 mnt lalu' },
  { id: 2, icon: 'bx:time',       color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30', text: '3 karyawan terlambat hari ini', time: '15 mnt lalu' },
  { id: 3, icon: 'bx:calendar',   color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',   text: 'Pengajuan cuti baru — Sari D.',  time: '1 jam lalu' },
];

function NotifDropdown() {
  const [open, setOpen]   = useState(false);
  const [read, setRead]   = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="topbar-btn relative"
        onClick={() => { setOpen((v) => !v); setRead(true); }}
      >
        <IconifyIcon icon="bx:bell" className="text-xl" />
        {!read && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-800" />
        )}
      </button>

      {open && (
        <div className="dropdown-panel w-80 animate-scale-in">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="font-semibold text-sm">Notifikasi</span>
            <span className="badge-info text-xs">{NOTIFS.length}</span>
          </div>
          {NOTIFS.map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition">
              <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm', n.color)}>
                <IconifyIcon icon={n.icon} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{n.text}</p>
                <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
              </div>
            </div>
          ))}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 text-center">
            <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">Lihat semua</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Profile dropdown ────────────────────────────────────────────────────── */
function ProfileDropdown() {
  const { user, logout } = useAuth();
  const [open, setOpen]  = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={user?.username} size="sm" />
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">
            {user?.username}
          </p>
          <p className="text-xs text-slate-400 leading-tight">
            {user?.role_name || user?.role_code}
          </p>
        </div>
        <IconifyIcon icon="bx:chevron-down" className="text-slate-400 text-sm hidden sm:block" />
      </button>

      {open && (
        <div className="dropdown-panel w-52 animate-scale-in">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{user?.username}</p>
            <p className="text-xs text-slate-400">{user?.role_name || user?.role_code}</p>
          </div>
          <div className="py-1">
            <DropItem icon="bx:user" label="Profil Saya" />
            <DropItem icon="bx:cog"  label="Pengaturan" />
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700 py-1">
            <button
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              onClick={logout}
            >
              <IconifyIcon icon="bx:log-out" className="text-base" />
              Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropItem({ icon, label }) {
  return (
    <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
      <IconifyIcon icon={icon} className="text-slate-400 text-base" />
      {label}
    </button>
  );
}

/* ── Theme toggle ────────────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, changeTheme } = useLayoutContext();
  return (
    <button
      className="topbar-btn"
      onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
    >
      <IconifyIcon
        icon={theme === 'dark' ? 'bx:sun' : 'bx:moon'}
        className="text-xl"
      />
    </button>
  );
}

/* ── TopBar ──────────────────────────────────────────────────────────────── */
export default function TopBar({ breadcrumb }) {
  const { toggleSidebar, toggleMobile } = useLayoutContext();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="topbar-height flex items-center border-b border-[var(--topbar-border)] bg-[var(--topbar-bg)] px-4 gap-3 flex-shrink-0 sticky top-0 z-30">
      {/* Hamburger */}
      <button
        className="topbar-btn"
        onClick={() => { toggleSidebar(); toggleMobile(); }}
      >
        <IconifyIcon icon="bx:menu" className="text-xl" />
      </button>

      {/* Breadcrumb */}
      {breadcrumb && (
        <nav className="hidden sm:flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          {breadcrumb.group && (
            <>
              <span>{breadcrumb.group}</span>
              <IconifyIcon icon="bx:chevron-right" className="text-sm text-slate-300" />
            </>
          )}
          <span className="font-medium text-slate-700 dark:text-slate-200">{breadcrumb.label}</span>
        </nav>
      )}

      <div className="flex-1" />

      {/* Search (desktop) */}
      <div className="hidden md:flex relative">
        <IconifyIcon icon="bx:search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
        <input
          type="text"
          placeholder="Cari karyawan, laporan…"
          className="pl-9 pr-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border-0 rounded-lg w-56
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:w-72 transition-all
                     text-slate-700 dark:text-slate-200 placeholder-slate-400"
        />
      </div>

      <ThemeToggle />
      <NotifDropdown />
      <ProfileDropdown />
    </header>
  );
}
