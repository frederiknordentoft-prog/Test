import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { usePersistence } from './db/usePersistence'
import { getLevel } from '../data/levels'
import { setMuted } from './game/audio'
import { LevelSelect } from './components/LevelSelect'
import { GameView } from './components/GameView'

export default function App() {
  usePersistence()
  const view = useGameStore((s) => s.view)
  const currentLevelId = useGameStore((s) => s.currentLevelId)
  const muted = useGameStore((s) => s.muted)
  const level = getLevel(currentLevelId)

  useEffect(() => setMuted(muted), [muted])

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-slate-950 bg-[radial-gradient(ellipse_at_top,rgba(30,58,95,0.55),transparent_60%)] text-slate-100">
      {view === 'game' && level ? <GameView level={level} /> : <LevelSelect />}
    </main>
  )
}
