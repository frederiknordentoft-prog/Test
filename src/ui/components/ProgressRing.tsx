export function ProgressRing({ value, size = 64, color, children }: {
  value: number
  size?: number
  color: string
  children?: React.ReactNode
}) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="relative grid place-items-center">{children}</div>
    </div>
  )
}
