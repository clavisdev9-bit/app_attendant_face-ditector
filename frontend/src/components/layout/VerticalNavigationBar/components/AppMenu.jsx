import { useState } from 'react';
import { Collapse } from 'react-bootstrap';
import clsx from 'clsx';
import IconifyIcon from '../../../wrappers/IconifyIcon';

/* Single leaf menu item (no subItems) */
const MenuItem = ({ item, isActive, onNavigate }) => (
  <li className="nav-item">
    <button
      className={clsx('nav-link', { active: isActive })}
      onClick={() => onNavigate(item.id)}
      style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
    >
      <span className="nav-icon">
        <IconifyIcon icon={item.icon} />
      </span>
      <span className="nav-text">{item.label}</span>
    </button>
  </li>
);

/* Menu item with collapsible subItems */
const MenuItemWithSub = ({ item, currentPage, onNavigate }) => {
  const isChildActive = (item.subItems || []).some((s) => s.id === currentPage);
  const [open, setOpen] = useState(isChildActive);

  return (
    <li className="nav-item">
      <button
        className={clsx('nav-link', { active: isChildActive })}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', position: 'relative' }}
      >
        <span className="nav-icon">
          <IconifyIcon icon={item.icon} />
        </span>
        <span className="nav-text">{item.label}</span>
        <span className="menu-arrow">
          <IconifyIcon
            icon="bx:chevron-down"
            style={{ transition: 'transform 0.2s', transform: open ? 'rotate(-180deg)' : 'rotate(0deg)' }}
          />
        </span>
      </button>

      <Collapse in={open}>
        <div>
          <ul className="sub-navbar-nav list-unstyled mb-0">
            {(item.subItems || []).map((sub) => (
              <li key={sub.id} className="sub-nav-item">
                <button
                  className={clsx('sub-nav-link', { active: currentPage === sub.id })}
                  onClick={() => onNavigate(sub.id)}
                  style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
                >
                  <span className="nav-text">{sub.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Collapse>
    </li>
  );
};

const AppMenu = ({ navGroups, currentPage, onNavigate }) => {
  return (
    <ul className="navbar-nav" id="navbar-nav">
      {navGroups.map((group) => (
        <li key={group.label} className="nav-item">
          <div className="menu-title">{group.label}</div>
          <ul className="navbar-nav" style={{ paddingLeft: 0, listStyle: 'none' }}>
            {group.items.map((item) =>
              item.subItems && item.subItems.length > 0 ? (
                <MenuItemWithSub
                  key={item.id}
                  item={item}
                  currentPage={currentPage}
                  onNavigate={onNavigate}
                />
              ) : (
                <MenuItem
                  key={item.id}
                  item={item}
                  isActive={currentPage === item.id}
                  onNavigate={onNavigate}
                />
              )
            )}
          </ul>
        </li>
      ))}
    </ul>
  );
};

export default AppMenu;
