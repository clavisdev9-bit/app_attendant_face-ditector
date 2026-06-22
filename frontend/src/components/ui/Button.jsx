import clsx from 'clsx';

const VARIANTS = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  danger:    'btn-danger',
  success:   'btn-success',
  outline:   'btn-outline',
  ghost:     'btn-ghost',
};

const SIZES = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
  icon: 'btn-icon',
};

export default function Button({
  variant = 'primary',
  size    = 'md',
  loading = false,
  icon,
  children,
  className,
  ...props
}) {
  return (
    <button
      className={clsx(VARIANTS[variant], SIZES[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="spinner w-4 h-4" />
      ) : icon ? (
        <span className="text-base leading-none">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
