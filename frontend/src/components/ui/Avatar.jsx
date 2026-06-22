import clsx from 'clsx';

const SIZES = { sm: 'avatar-sm', md: 'avatar-md', lg: 'avatar-lg' };
const COLORS = ['bg-primary-600','bg-violet-600','bg-teal-600','bg-orange-500','bg-rose-500'];

function colorFor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function Avatar({ name = '', size = 'md', src, className }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const color    = colorFor(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx('rounded-full object-cover', SIZES[size], className)}
      />
    );
  }

  return (
    <span className={clsx(SIZES[size], color, className)}>
      {initials}
    </span>
  );
}
