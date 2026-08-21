import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ISLAND_BY_ID } from '../../content/islands'
import { useProfile } from '../../state/useProfile'
import { Backdrop } from '../components/Backdrop'
import { Creature } from '../../art/Creature'
import { lookFor } from '../../art/creatureGen'
import { hueOf } from './RoundScreen'
import { speak } from '../../audio/speech'
import { sfx } from '../../audio/sfx'

/**
 * Where the talvenner live. Being able to move them around is the whole feature:
 * a place you arranged yourself is a place you come back to.
 */
export function MyIslandScreen({ onBack }: { onBack: () => void }) {
  const save = useProfile((s) => s.save)
  const place = useProfile((s) => s.place)
  const fieldRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const move = (uid: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = fieldRef.current?.getBoundingClientRect()
    if (!box || dragging !== uid) return
    place(uid, Math.min(0.92, Math.max(0.08, (e.clientX - box.left) / box.width)),
      Math.min(0.9, Math.max(0.25, (e.clientY - box.top) / box.height)))
  }

  return (
    <div className={`app-height relative overflow-hidden ${save.settings.motion ? '' : 'calm'}`}>
      <Backdrop palette={{ skyFrom: '#173a2c', skyTo: '#3f8f68', ground: '#0f2a20', accent: '#ffd166', glow: '#7df5b8' }} seed="min-oe" />

      <div className="safe-top safe-x safe-bottom relative z-10 flex h-full flex-col">
        <header className="flex items-center gap-3 px-4 pb-1 pt-3">
          <button type="button" onClick={onBack} aria-label="Tilbage"
            className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-black/25 text-xl ring-1 ring-white/20">‹</button>
          <div>
            <p className="text-xl font-black leading-tight">{save.avatar} Min ø</p>
            <p className="text-sm opacity-75">
              {save.creatures.length === 0 ? 'Vind din første talven på kortet' : 'Træk dine talvenner derhen du vil'}
            </p>
          </div>
        </header>

        <div ref={fieldRef} className="relative flex-1 touch-none">
          {save.creatures.map((c) => {
            const island = ISLAND_BY_ID.get(c.islandId)
            return (
              <div
                key={c.uid}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setDragging(c.uid)
                  sfx.pop()
                  speak(c.name)
                }}
                onPointerMove={move(c.uid)}
                onPointerUp={() => setDragging(null)}
                onPointerCancel={() => setDragging(null)}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{
                  left: `${c.x * 100}%`,
                  top: `${c.y * 100}%`,
                  zIndex: dragging === c.uid ? 30 : Math.round(c.y * 20),
                  transform: `translate(-50%, -50%) scale(${dragging === c.uid ? 1.15 : 1})`,
                  transition: dragging === c.uid ? 'none' : 'transform .2s ease',
                }}
              >
                <Creature look={lookFor(c.speciesId, c.variant, hueOf(island?.palette.glow ?? '#a78bfa'))}
                  size={74} golden={c.golden} mood={dragging === c.uid ? 'cheer' : 'idle'} />
                <span className="-mt-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-black">{c.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
