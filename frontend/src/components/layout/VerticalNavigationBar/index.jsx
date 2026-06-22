import { Suspense, lazy, useState, useRef, useEffect } from 'react';
import FallbackLoading from '../../FallbackLoading';
import SimplebarReactClient from '../../wrappers/SimplebarReactClient';
import { appName } from '../../../context/constants';
import IconifyIcon from '../../wrappers/IconifyIcon';
import { useAuth } from '../../../context/AuthContext';

const AppMenu = lazy(() => import('./components/AppMenu'));

const VerticalNavigationBar = ({ navGroups, currentPage, onNavigate }) => {
  const { user, logout } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="main-nav" id="leftside-menu-container">
      {/* Logo */}
      <div className="logo-box">
        <a href="/" className="logo-dark d-flex align-items-center gap-2" style={{ textDecoration: 'none' }}>
          <IconifyIcon icon="bx:fingerprint" className="text-primary fs-26" />
          <span className="fw-bold text-primary fs-18 logo-lg">{appName}</span>
        </a>
        <a href="/" className="logo-light d-flex align-items-center gap-2" style={{ textDecoration: 'none' }}>
          <IconifyIcon icon="bx:fingerprint" className="text-primary fs-26" />
          <span className="fw-bold text-white fs-18 logo-lg">{appName}</span>
        </a>
      </div>

      {/* Scrollable menu */}
      <SimplebarReactClient className="scrollbar">
        <Suspense fallback={<FallbackLoading />}>
          <AppMenu navGroups={navGroups} currentPage={currentPage} onNavigate={onNavigate} />
        </Suspense>
      </SimplebarReactClient>

      {/* Sidebar user footer */}
      <div
        className="border-top p-3 d-flex align-items-center gap-2"
        style={{ position: 'sticky', bottom: 0, background: 'var(--bs-main-nav-bg, inherit)' }}
        ref={dropRef}
      >
        {/* Avatar */}
        <div
          className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
          style={{
            width: 36, height: 36,
            background: 'var(--bs-primary)',
            color: '#fff', fontSize: 13,
          }}
        >
          {initials}
        </div>

        {/* Name + role */}
        <div className="flex-grow-1 overflow-hidden logo-lg">
          <div className="fw-semibold text-truncate" style={{ fontSize: 13, color: 'var(--bs-main-nav-item-hover-color, inherit)' }}>
            {user?.username || 'User'}
          </div>
          <div className="text-truncate" style={{ fontSize: 11, opacity: 0.6, color: 'var(--bs-main-nav-item-color, inherit)' }}>
            {user?.role_name || user?.role_code || 'Staff'}
          </div>
        </div>

        {/* Logout button */}
        <div className="logo-lg">
          <button
            type="button"
            className="btn btn-sm p-1"
            style={{ background: 'transparent', border: 'none', color: 'var(--bs-main-nav-item-color, inherit)', opacity: 0.7 }}
            onClick={logout}
            title="Keluar"
          >
            <IconifyIcon icon="bx:log-out" style={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerticalNavigationBar;
