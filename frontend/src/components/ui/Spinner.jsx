import clsx from 'clsx';

export default function Spinner({ size = 6, className }) {
  return (
    <span
      className={clsx('spinner', `w-${size} h-${size}`, className)}
      role="status"
      aria-label="Memuat…"
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <Spinner size={8} />
    </div>
  );
}
