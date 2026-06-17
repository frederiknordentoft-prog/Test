import { cx } from '../lib/ui';

// Tasteful, deterministisk farvepalet til ejer-avatarer.
const PALETTE = [
  'bg-brand-600 text-white',
  'bg-accent-400 text-ink',
  'bg-teal-600 text-white',
  'bg-sky-600 text-white',
  'bg-violet-600 text-white',
  'bg-rose-500 text-white',
  'bg-amber-500 text-ink',
  'bg-emerald-600 text-white',
  'bg-indigo-600 text-white',
];

/** Udled initialer fra et navn ("Mette Holm (CEO)" → "MH"). */
function initials(name: string): string {
  const clean = name.replace(/\([^)]*\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function Avatar({
  name,
  size = 26,
  className,
  title,
}: {
  name: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const color = PALETTE[hash(name) % PALETTE.length];
  return (
    <span
      className={cx('inline-grid shrink-0 place-items-center rounded-full font-bold leading-none', color, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      title={title ?? name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
