import { useGameStore } from './store/gameStore'
import { usePersistence } from './db/usePersistence'
import { getLevel } from '../data/levels'
import { LevelSelect } from './components/LevelSelect'
import { GameView } from './components/GameView'

export default function App() {
  usePersistence()
  const view = useGameStore((s) => s.view)
  const currentLevelId = useGameStore((s) => s.currentLevelId)
  const level = getLevel(currentLevelId)

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-slate-900 text-slate-100">
      {view === 'game' && level ? <GameView level={level} /> : <LevelSelect />}
    </main>
  )
}
