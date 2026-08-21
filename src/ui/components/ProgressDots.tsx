/** How far through the round we are. Filled dots only ever go up — misses cost nothing here. */
export function ProgressDots({ done, total, accent }: { done: number; total: number; accent: string }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${done} af ${total} klaret`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-2.5 rounded-full transition-all duration-300"
          style={{
            width: i < done ? 18 : 10,
            background: i < done ? accent : 'rgba(255,255,255,0.22)',
          }}
        />
      ))}
    </div>
  )
}
