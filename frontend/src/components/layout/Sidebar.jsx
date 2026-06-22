import { useState } from 'react';
import clsx from 'clsx';
import { useLayoutContext } from '../../context/useLayoutContext';
import { useAuth }         from '../../context/AuthContext';
import IconifyIcon         from '../wrappers/IconifyIcon';

/* ── icons ──────────────────────────────────────────────────────────────── */
function Icon({ name, className }) {
  return <IconifyIcon icon={name} className={clsx('flex-shrink-0', className)} />;
}

/* ── nav item ───────────────────────────────────────────────────────────── */
function NavItem({ item, currentPage, onNavigate, collapsed }) {
  const isActive = currentPage === item.id ||
    (item.subItems || []).some((s) => s.id === currentPage);
  const [open, setOpen] = useState(isActive);

  const hasSub = item.subItems && item.subItems.length > 0;

  const baseClass = clsx(
    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group',
    isActive
      ? 'bg-primary-600 text-white'
      : 'text-sidebar-text hover:bg-white/6 hover:text-white',
    collapsed && 'justify-center px-0'
  );

  if (hasSub) {
    return (
      <li>
        <button
          className={baseClass}
          onClick={() => setOpen((v) => !v)}
          title={collapsed ? item.label : undefined}
        >
          <Icon name={item.icon} className="text-lg" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              <Icon
                name="bx:chevron-down"
                className={clsx('text-base transition-transform', open && 'rotate-180')}
              />
            </>
          )}
          {collapsed && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-md
                             whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-lg">
              {item.label}
            </span>
          )}
        </button>

        {!collapsed && open && (
          <ul className="mt-1 space-y-0.5 pl-10">
            {item.subItems.map((sub) => (
              <li key={sub.id}>
                <button
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm rounded-lg transition-all',
                    currentPage === sub.id
                      ? 'text-white font-medium'
                      : 'text-sidebar-text hover:text-white hover:bg-white/6'
                  )}
                  onClick={() => onNavigate(sub.id)}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                    {sub.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        className={baseClass}
        onClick={() => onNavigate(item.id)}
        title={collapsed ? item.label : undefined}
      >
        <Icon name={item.icon} className="text-lg" />
        {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
        {collapsed && (
          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-md
                           whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-lg">
            {item.label}
          </span>
        )}
      </button>
    </li>
  );
}

/* ── sidebar ─────────────────────────────────────────────────────────────── */
export default function Sidebar({ navGroups, currentPage, onNavigate }) {
  const { sidebarOpen, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useLayoutContext();
  const { user, logout } = useAuth();

  const collapsed = !sidebarOpen;

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  const sidebarClass = clsx(
    'h-screen flex flex-col flex-shrink-0 bg-[#042C53] transition-all duration-300 overflow-hidden z-40',
    /* desktop */
    collapsed ? 'w-16' : 'w-64',
    /* mobile: hidden by default, shown as overlay */
    'hidden lg:flex',
    mobileSidebarOpen && '!flex fixed inset-y-0 left-0 w-64 z-40 shadow-2xl'
  );

  return (
    <>
      {/* Mobile overlay sidebar */}
      <div
        className={clsx(
          'lg:hidden fixed inset-y-0 left-0 z-40 flex flex-col bg-[#042C53] w-64 transition-transform duration-300 shadow-2xl',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent
          navGroups={navGroups}
          currentPage={currentPage}
          onNavigate={(id) => { onNavigate(id); setMobileSidebarOpen(false); }}
          collapsed={false}
          user={user}
          initials={initials}
          logout={logout}
          toggleSidebar={toggleSidebar}
          isMobile
        />
      </div>

      {/* Desktop sidebar */}
      <div className={sidebarClass}>
        <SidebarContent
          navGroups={navGroups}
          currentPage={currentPage}
          onNavigate={onNavigate}
          collapsed={collapsed}
          user={user}
          initials={initials}
          logout={logout}
          toggleSidebar={toggleSidebar}
        />
      </div>
    </>
  );
}

function SidebarContent({ navGroups, currentPage, onNavigate, collapsed, user, initials, logout, toggleSidebar, isMobile }) {
  return (
    <>
      {/* Logo */}
      <div className={clsx(
        'flex items-center h-[60px] px-4 border-b border-[#0d3d6e] flex-shrink-0',
        collapsed ? 'justify-center' : 'gap-2.5'
      )}>
        <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
          <IconifyIcon icon="bx:fingerprint" className="text-white text-lg" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-base tracking-wide">HADIR</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4
                      [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1 text-2xs font-semibold uppercase tracking-widest text-[#4a6580]">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  currentPage={currentPage}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-[#0d3d6e] p-3">
        <div className={clsx('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className={clsx(
            'w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
          )}>
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{user?.username}</p>
              <p className="text-2xs text-[#4a6580] truncate">{user?.role_name || user?.role_code}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[#4a6580] hover:text-white transition"
              title="Keluar"
            >
              <IconifyIcon icon="bx:log-out" className="text-base" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
