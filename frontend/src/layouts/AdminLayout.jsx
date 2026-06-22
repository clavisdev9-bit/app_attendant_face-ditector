import Sidebar from '../components/layout/Sidebar';
import TopBar  from '../components/layout/TopBar';

const AdminLayout = ({ children, navGroups, currentPage, onNavigate, breadcrumb }) => (
  <div className="page-wrapper">
    <Sidebar navGroups={navGroups} currentPage={currentPage} onNavigate={onNavigate} />
    <div className="main-content">
      <TopBar breadcrumb={breadcrumb} />
      <main className="page-body">
        <div className="p-6 max-w-screen-2xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  </div>
);

export default AdminLayout;
