export default function PageHeader({ title, subtitle, action, breadcrumb }) {
  return (
    <div className="page-header">
      <div>
        {breadcrumb && (
          <nav className="flex items-center gap-1 text-xs text-slate-400 mb-1">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span>/</span>}
                <span className={i === breadcrumb.length - 1 ? 'text-slate-600 dark:text-slate-300' : ''}>
                  {b}
                </span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  );
}
