export default function EmptyState({ icon = '📭', title = 'Tidak ada data', subtitle, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <p className="empty-title">{title}</p>
      {subtitle && <p className="empty-sub">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
