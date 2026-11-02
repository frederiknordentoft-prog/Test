/** Odometer digits: each digit is a 0–9 strip moved with a CSS transform (220 ms). */
export function Roller({ value, className }: { value: number; className?: string }) {
  const s = String(Math.max(0, Math.round(value)));
  return (
    <span className={`roller ${className ?? ''}`} aria-label={s} role="text">
      {s.split('').map((ch, i) => (
        <span key={s.length - i} className="roller-d" aria-hidden="true">
          <span className="roller-s" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
            {'0123456789'.split('').map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
