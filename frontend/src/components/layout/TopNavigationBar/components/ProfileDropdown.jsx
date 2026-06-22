import { useState, useRef, useEffect } from 'react';
import IconifyIcon from '../../../wrappers/IconifyIcon';
import { useAuth } from '../../../../context/AuthContext';

const ProfileDropdown = () => {
  const { user, logout } = useAuth();
  const [open, setOpen]  = useState(false);
  const ref = useRef(null);

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

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
          className="topbar-button d-flex align-items-center gap-2 px-2"
          onClick={() => setOpen((v) => !v)}
          style={{ borderRadius: 8 }}
        >
          <div
            className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
            style={{ width: 32, height: 32, background: 'var(--bs-primary)', color: '#fff', fontSize: 12 }}
          >
            {initials}
          </div>
          <div className="d-none d-sm-block text-start" style={{ lineHeight: 1.2 }}>
            <div className="fw-semibold" style={{ fontSize: 13, color: 'var(--bs-topbar-item-color, inherit)' }}>
              {user?.username || 'User'}
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, color: 'var(--bs-topbar-item-color, inherit)' }}>
              {user?.role_name || user?.role_code || 'Staff'}
            </div>
          </div>
          <IconifyIcon icon="bx:chevron-down" className="d-none d-sm-block fs-16 text-muted" />
        </button>

        {open && (
          <ul className="dropdown-menu dropdown-menu-end show" style={{ minWidth: 200 }}>
            <li className="px-3 py-2">
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                  style={{ width: 40, height: 40, background: 'var(--bs-primary)', color: '#fff', fontSize: 14 }}
                >
                  {initials}
                </div>
                <div>
                  <div className="fw-semibold" style={{ fontSize: 14 }}>{user?.username || 'User'}</div>
                  <small className="text-muted">{user?.role_name || user?.role_code}</small>
                </div>
              </div>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <span className="dropdown-item d-flex align-items-center gap-2">
                <IconifyIcon icon="bx:user" className="fs-16 text-muted" />
                <span>Profil Saya</span>
              </span>
            </li>
            <li>
              <span className="dropdown-item d-flex align-items-center gap-2">
                <IconifyIcon icon="bx:cog" className="fs-16 text-muted" />
                <span>Pengaturan</span>
              </span>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button
                className="dropdown-item d-flex align-items-center gap-2 text-danger"
                onClick={logout}
              >
                <IconifyIcon icon="bx:log-out" className="fs-16" />
                <span>Keluar</span>
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
};

export default ProfileDropdown;
