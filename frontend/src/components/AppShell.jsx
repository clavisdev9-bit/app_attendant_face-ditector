import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../layouts/AdminLayout';

import Dashboard        from '../pages/Dashboard';
import ScanStation      from '../pages/ScanStation';
import Employees        from '../pages/Employees';
import Reports          from '../pages/Reports';
import MasterData       from '../pages/MasterData';
import LeaveManagement  from '../pages/LeaveManagement';
import OvertimeManagement from '../pages/OvertimeManagement';
import WFHManagement    from '../pages/WFHManagement';
import UserManagement   from '../pages/UserManagement';
import Shifts           from '../pages/Shifts';

export const NAV_GROUPS = [
  {
    label: 'UTAMA',
    items: [
      { id: 'dashboard', label: 'Dashboard',        icon: 'bx:grid-alt',        perm: null },
      { id: 'scan',      label: 'Terminal Absensi', icon: 'bx:scan',            perm: null },
    ],
  },
  {
    label: 'KARYAWAN',
    items: [
      { id: 'employees', label: 'Data Karyawan',    icon: 'bx:user-check',      perm: 'attendance:read_all' },
      { id: 'shifts',    label: 'Shift & Jadwal',   icon: 'bx:time-five',       perm: ['shift:view_team', 'shift:manage'] },
    ],
  },
  {
    label: 'PERMOHONAN',
    items: [
      {
        id: 'requests',
        label: 'Permohonan',
        icon: 'bx:message-alt-detail',
        perm: ['leave:request', 'leave:manage', 'leave:approve_all', 'leave:approve_team'],
        subItems: [
          { id: 'leave',    label: 'Cuti & Izin',    perm: ['leave:request', 'leave:manage', 'leave:approve_all', 'leave:approve_team'] },
          { id: 'overtime', label: 'Lembur',          perm: ['overtime:request', 'overtime:approve_team'] },
          { id: 'wfh',      label: 'Work From Home',  perm: ['shift:view_own', 'shift:view_team', 'shift:manage'] },
        ],
      },
    ],
  },
  {
    label: 'LAPORAN',
    items: [
      { id: 'reports', label: 'Laporan',             icon: 'bx:bar-chart-alt-2', perm: ['report:all', 'report:team'] },
    ],
  },
  {
    label: 'ADMINISTRASI',
    items: [
      { id: 'master', label: 'Master Data',          icon: 'bx:data',            perm: ['master:view', 'master:manage'] },
      { id: 'users',  label: 'User & Role',          icon: 'bx:shield',          perm: 'system:user_manage' },
    ],
  },
];

const PAGE_META = {};
NAV_GROUPS.forEach((g) =>
  g.items.forEach((item) => {
    PAGE_META[item.id] = { label: item.label, group: g.label };
    (item.subItems || []).forEach((sub) => {
      PAGE_META[sub.id] = { label: sub.label, group: item.label };
    });
  })
);

export default function AppShell() {
  const { can } = useAuth();
  const [page, setPage] = useState('dashboard');

  // supports single string or array (any match)
  const canItem = (perm) => {
    if (!perm) return true;
    if (Array.isArray(perm)) return perm.some((p) => can(p));
    return can(perm);
  };

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => canItem(item.perm))
      .map((item) =>
        item.subItems
          ? { ...item, subItems: item.subItems.filter((sub) => canItem(sub.perm)) }
          : item
      )
      .filter((item) => !item.subItems || item.subItems.length > 0),
  })).filter((group) => group.items.length > 0);

  const breadcrumb = PAGE_META[page] || { label: page, group: '' };

  return (
    <AdminLayout
      navGroups={visibleGroups}
      currentPage={page}
      onNavigate={setPage}
      breadcrumb={breadcrumb}
    >
      {page === 'dashboard'  && <Dashboard onNavigate={setPage} />}
      {page === 'scan'       && <ScanStation />}
      {page === 'employees'  && <Employees />}
      {page === 'shifts'     && <Shifts />}
      {page === 'reports'    && <Reports />}
      {page === 'leave'      && <LeaveManagement />}
      {page === 'overtime'   && <OvertimeManagement />}
      {page === 'wfh'        && <WFHManagement />}
      {page === 'master'     && <MasterData />}
      {page === 'users'      && <UserManagement />}
    </AdminLayout>
  );
}
