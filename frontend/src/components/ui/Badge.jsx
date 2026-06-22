import clsx from 'clsx';

const MAP = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger:  'badge-danger',
  info:    'badge-info',
  gray:    'badge-gray',
  // status aliases
  PRESENT: 'badge-success',
  LATE:    'badge-warning',
  ABSENT:  'badge-danger',
  APPROVED:'badge-success',
  PENDING: 'badge-warning',
  REJECTED:'badge-danger',
  ACTIVE:  'badge-success',
  INACTIVE:'badge-gray',
};

export default function Badge({ variant = 'gray', dot = false, children, className }) {
  return (
    <span className={clsx(MAP[variant] || 'badge-gray', className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}
