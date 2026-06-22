import clsx from 'clsx';

export default function Input({ label, error, className, ...props }) {
  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <input className={clsx('input', error && 'border-red-400 focus:border-red-500', className)} {...props} />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

Input.Select = function SelectInput({ label, error, children, className, ...props }) {
  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <select className={clsx('input', error && 'border-red-400', className)} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
};

Input.Textarea = function TextareaInput({ label, error, className, ...props }) {
  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <textarea className={clsx('input', error && 'border-red-400', className)} {...props} />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
};
