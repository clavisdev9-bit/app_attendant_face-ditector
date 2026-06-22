import clsx from 'clsx';

const VARIANTS = { danger: 'alert-danger', success: 'alert-success', warning: 'alert-warning', info: 'alert-info' };

export default function Alert({ variant = 'info', children, onClose }) {
  return (
    <div className={clsx(VARIANTS[variant])}>
      <span className="flex-1 text-sm">{children}</span>
      {onClose && (
        <button onClick={onClose} className="ml-auto -mr-1 p-0.5 rounded opacity-60 hover:opacity-100">✕</button>
      )}
    </div>
  );
}
